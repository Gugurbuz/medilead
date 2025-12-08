import * as ort from 'onnxruntime-web';

// ONNX Runtime Web için WASM dosyalarını CDN'den çekmek (Vite config ile uğraşmamak için en stabil yöntem)
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/";

/**
 * BiSeNet Face Parsing ONNX Implementation
 */

const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';

const MODEL_INPUT_SIZE = 512;
const HAIR_CLASS_INDEX = 17;

// ImageNet Normalizasyon Değerleri
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

// Singleton Session
let sessionPromise: Promise<ort.InferenceSession> | null = null;

const getSession = async (): Promise<ort.InferenceSession> => {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['webgl', 'wasm'], // WebGL öncelikli, yoksa WASM
      graphOptimizationLevel: 'all',
    }).catch((err) => {
      sessionPromise = null; // Hata olursa null'a çek ki tekrar denenebilsin
      throw err;
    });
  }
  return sessionPromise;
};

const resizeImage = (img: HTMLImageElement | HTMLVideoElement, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Canvas context error');
  ctx.drawImage(img, 0, 0, width, height);
  return canvas;
};

const resizeImageForStorage = (source: HTMLImageElement | HTMLVideoElement, maxWidth = 800): string => {
  const canvas = document.createElement('canvas');
  let width = (source instanceof HTMLVideoElement) ? source.videoWidth : source.width;
  let height = (source instanceof HTMLVideoElement) ? source.videoHeight : source.height;

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

/**
 * Preprocess: ImageNet Normalizasyonu
 * Optimize edilmiş döngü yapısı.
 */
const preprocess = (ctx: CanvasRenderingContext2D, width: number, height: number): ort.Tensor => {
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  const inputTensor = new Float32Array(3 * width * height);
  const size = width * height;

  for (let i = 0; i < size; i++) {
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // NCHW Layout: [Batch, Channel, Height, Width]
    // R Channel
    inputTensor[i] = (r - MEAN[0]) / STD[0];
    // G Channel
    inputTensor[i + size] = (g - MEAN[1]) / STD[1];
    // B Channel
    inputTensor[i + 2 * size] = (b - MEAN[2]) / STD[2];
  }

  return new ort.Tensor('float32', inputTensor, [1, 3, height, width]);
};

/**
 * Postprocess: ArgMax ve Maskeleme
 */
const postprocess = (
  outputTensor: ort.Tensor, 
  originalWidth: number, 
  originalHeight: number
) => {
  const data = outputTensor.data as Float32Array;
  const numClasses = 19; 
  const height = MODEL_INPUT_SIZE;
  const width = MODEL_INPUT_SIZE;
  const size = height * width;

  // Maske Canvas'ı oluştur (512x512)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const maskCtx = maskCanvas.getContext('2d');
  if (!maskCtx) throw new Error('Mask context failed');

  const maskImgData = maskCtx.createImageData(width, height);
  const pixelData = maskImgData.data;

  let hairPixelCount = 0;

  // Hızlı ArgMax işlemi
  for (let i = 0; i < size; i++) {
    let maxVal = -Infinity;
    let maxClass = 0;

    // Her piksel için 19 sınıfı kontrol et
    for (let c = 0; c < numClasses; c++) {
      const val = data[c * size + i]; // Offset: c * H * W + pixelIndex
      if (val > maxVal) {
        maxVal = val;
        maxClass = c;
      }
    }

    const pixelIndex = i * 4;
    if (maxClass === HAIR_CLASS_INDEX) {
      hairPixelCount++;
      pixelData[pixelIndex] = 0;       // R
      pixelData[pixelIndex + 1] = 255; // G (Yeşil tonu artırıldı, daha belirgin)
      pixelData[pixelIndex + 2] = 0;   // B
      pixelData[pixelIndex + 3] = 140; // Alpha
    } else {
      pixelData[pixelIndex + 3] = 0; // Transparent
    }
  }

  maskCtx.putImageData(maskImgData, 0, 0);

  // Maskeyi orijinal boyuta scale et
  const finalMaskCanvas = document.createElement('canvas');
  finalMaskCanvas.width = originalWidth;
  finalMaskCanvas.height = originalHeight;
  const finalCtx = finalMaskCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Final context failed');
  
  // Smoothing (yumuşatma) için
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

  // Heatmap Simülasyonu (Opsiyonel görselleştirme için)
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = originalWidth;
  heatCanvas.height = originalHeight;
  const heatCtx = heatCanvas.getContext('2d');
  if (heatCtx) {
    heatCtx.drawImage(finalMaskCanvas, 0, 0);
  }

  // Skorlama
  const densityRaw = (hairPixelCount / (size * 0.25)) * 100; // Eşik değeri biraz düşürüldü
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

/**
 * Ana İşlem Fonksiyonu
 */
export const processHairImage = async (imageSource: string | HTMLImageElement | HTMLVideoElement) => {
  try {
    let sourceElement: HTMLImageElement | HTMLVideoElement;

    // Eğer string (dataURL) gelirse Image nesnesine çevir
    if (typeof imageSource === 'string') {
      sourceElement = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = imageSource;
        img.onload = () => resolve(img);
        img.onerror = (e) => reject(e);
      });
    } else {
      sourceElement = imageSource;
    }

    const session = await getSession();
    
    // 1. Resize & Preprocess
    const resizedCanvas = resizeImage(sourceElement, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const ctx = resizedCanvas.getContext('2d')!;
    const inputTensor = preprocess(ctx, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

    // 2. Inference
    const feeds: Record<string, ort.Tensor> = {};
    feeds[session.inputNames[0]] = inputTensor;
    
    const results = await session.run(feeds);
    
    // 3. Postprocess
    const outputTensor = results[session.outputNames[0]];
    const width = (sourceElement instanceof HTMLVideoElement) ? sourceElement.videoWidth : sourceElement.width;
    const height = (sourceElement instanceof HTMLVideoElement) ? sourceElement.videoHeight : sourceElement.height;
    
    const processedData = postprocess(outputTensor, width, height);
    
    // Temizlik (Tensorlar bellekte yer kaplamasın)
    // Not: JS tarafındaki TypedArray'ler GC ile temizlenir ama manuel dispose gerekebilir (ort sürümüne göre).
    // Burada ort.Tensor nesnesinin dispose metodu varsa çağrılabilir, yoksa GC halleder.

    return {
      original: typeof imageSource === 'string' ? imageSource : resizeImageForStorage(sourceElement),
      ...processedData
    };

  } catch (error) {
    console.error("Hair Analysis Error:", error);
    throw error;
  }
};