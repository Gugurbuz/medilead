import * as ort from 'onnxruntime-web';

// --- CRITICAL FIX: WASM DOSYA YOLUNU AYARLA ---
// Bu satır, tarayıcının .wasm dosyalarını doğru yerden çekmesini sağlar.
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/";

const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';
const MODEL_INPUT_SIZE = 512;
const HAIR_CLASS_INDEX = 17;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let sessionPromise: Promise<ort.InferenceSession> | null = null;

const getSession = async (): Promise<ort.InferenceSession> => {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all',
    }).catch((err) => {
      sessionPromise = null;
      throw err;
    });
  }
  return sessionPromise;
};

const resizeImage = (img: HTMLImageElement, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context error');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
};

const resizeImageForStorage = (source: HTMLImageElement, maxWidth = 800): string => {
  const canvas = document.createElement('canvas');
  let width = source.width;
  let height = source.height;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(source, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
};

const preprocess = (ctx: CanvasRenderingContext2D, width: number, height: number): ort.Tensor => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  const inputTensor = new Float32Array(3 * width * height);
  const size = width * height;

  for (let i = 0; i < size; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;
    inputTensor[i] = (r - MEAN[0]) / STD[0];
    inputTensor[i + size] = (g - MEAN[1]) / STD[1];
    inputTensor[i + 2 * size] = (b - MEAN[2]) / STD[2];
  }
  return new ort.Tensor('float32', inputTensor, [1, 3, height, width]);
};

const postprocess = (outputTensor: ort.Tensor, originalWidth: number, originalHeight: number) => {
  const data = outputTensor.data as Float32Array;
  const numClasses = 19; 
  const height = MODEL_INPUT_SIZE;
  const width = MODEL_INPUT_SIZE;
  const size = height * width;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) throw new Error('Mask context failed');

  const maskImgData = maskCtx.createImageData(width, height);
  const pixelData = maskImgData.data;
  let hairPixelCount = 0;

  for (let i = 0; i < size; i++) {
    let maxVal = -Infinity;
    let maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const val = data[c * size + i];
      if (val > maxVal) { maxVal = val; maxClass = c; }
    }
    const pixelIndex = i * 4;
    if (maxClass === HAIR_CLASS_INDEX) {
      hairPixelCount++;
      pixelData[pixelIndex] = 0;
      pixelData[pixelIndex + 1] = 255;
      pixelData[pixelIndex + 2] = 0;
      pixelData[pixelIndex + 3] = 140;
    } else {
      pixelData[pixelIndex + 3] = 0;
    }
  }

  maskCtx.putImageData(maskImgData, 0, 0);
  const finalMaskCanvas = document.createElement('canvas');
  finalMaskCanvas.width = originalWidth;
  finalMaskCanvas.height = originalHeight;
  const finalCtx = finalMaskCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Final context failed');
  finalCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

  const densityRaw = (hairPixelCount / (size * 0.25)) * 100;
  const densityScore = Math.min(100, Math.round(densityRaw));
  let coverageLabel = 'Seyrek';
  if (densityScore > 75) coverageLabel = 'Yoğun';
  else if (densityScore > 40) coverageLabel = 'Orta';

  return {
    segmentationMask: finalMaskCanvas.toDataURL('image/png'),
    densityScore: densityScore,
    coverageLabel: coverageLabel
  };
};

export const processHairImage = async (imageSource: string) => {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      // FIX: Data URL'ler için crossOrigin ayarını atla
      if (!imageSource.startsWith('data:')) {
        i.crossOrigin = "Anonymous";
      }
      i.src = imageSource;
      i.onload = () => resolve(i);
      i.onerror = (e) => {
        console.error("Image load failed details:", e);
        reject(new Error("Failed to load image for processing."));
      };
    });

    const session = await getSession();
    const resizedCanvas = resizeImage(img, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const ctx = resizedCanvas.getContext('2d')!;
    const inputTensor = preprocess(ctx, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

    const feeds: Record<string, ort.Tensor> = {};
    feeds[session.inputNames[0]] = inputTensor;
    const results = await session.run(feeds);
    const outputTensor = results[session.outputNames[0]];
    
    const processedData = postprocess(outputTensor, img.width, img.height);

    return {
      original: resizeImageForStorage(img),
      ...processedData
    };
  } catch (error) {
    console.error("Hair Analysis Error:", error);
    throw error;
  }
};