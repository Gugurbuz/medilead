import * as ort from 'onnxruntime-web';

/**
 * BiSeNet Face Parsing ONNX Implementation
 * Bu modül, özellikle "face_parsing_bisenet.onnx" modeli için yapılandırılmıştır.
 */

// KULLANICI URL'Sİ (Lütfen bu linkin tarayıcıda çalıştığını teyit edin)
const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';

const MODEL_INPUT_SIZE = 512; // BiSeNet genellikle 512x512 çalışır
const HAIR_CLASS_INDEX = 17;  // BiSeNet standart modelinde 'Saç' sınıfı ID'si 17'dir.

// ImageNet Normalizasyon Değerleri (BiSeNet için gereklidir)
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session: ort.InferenceSession | null = null;

const resizeImageForStorage = (img: HTMLImageElement, maxWidth = 800): string => {
  const canvas = document.createElement('canvas');
  let width = img.width;
  let height = img.height;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.8);
};

const initSession = async () => {
  if (session) return session;
  try {
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all'
    });
    console.log('BiSeNet Session initialized');
    return session;
  } catch (e) {
    console.error('Model yükleme hatası:', e);
    throw new Error('AI Modeli yüklenemedi. Linki ve dosya bütünlüğünü kontrol edin.');
  }
};

/**
 * Preprocess: ImageNet Normalizasyonu (Mean/Std çıkarma)
 */
const preprocess = (image: HTMLImageElement, width: number, height: number): ort.Tensor => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  
  if (!ctx) throw new Error('Canvas context error');
  
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  const inputTensor = new Float32Array(1 * 3 * width * height);
  
  for (let i = 0; i < width * height; i++) {
    // 0-255 arasını 0-1 arasına çek
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // Standartizasyon: (Value - Mean) / Std
    // NCHW Formatı: RRR...GGG...BBB...
    inputTensor[i] = (r - MEAN[0]) / STD[0];
    inputTensor[i + width * height] = (g - MEAN[1]) / STD[1];
    inputTensor[i + 2 * width * height] = (b - MEAN[2]) / STD[2];
  }

  return new ort.Tensor('float32', inputTensor, [1, 3, height, width]);
};

/**
 * Postprocess: ArgMax işlemi ile Saç Sınıfını (17) Çıkarma
 */
const postprocess = (
  outputTensor: ort.Tensor, 
  originalWidth: number, 
  originalHeight: number
) => {
  // BiSeNet Çıktısı: [1, 19, 512, 512] (Batch, Class, Height, Width)
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

  let hairPixelCount = 0;

  // ArgMax: Her piksel için en yüksek skora sahip sınıfı bul
  for (let i = 0; i < size; i++) {
    let maxVal = -Infinity;
    let maxClass = 0;

    // Bu pikselin (i) tüm sınıflardaki (c) değerlerini kontrol et
    for (let c = 0; c < numClasses; c++) {
      // Veri düz bir dizidir. Offset hesabı: c * (H*W) + i
      const val = data[c * size + i];
      if (val > maxVal) {
        maxVal = val;
        maxClass = c;
      }
    }

    // Eğer en baskın sınıf SAÇ (17) ise maskeyi boya
    if (maxClass === HAIR_CLASS_INDEX) {
      hairPixelCount++;
      maskImgData.data[i * 4] = 0;     // R
      maskImgData.data[i * 4 + 1] = 100; // G
      maskImgData.data[i * 4 + 2] = 255; // B
      maskImgData.data[i * 4 + 3] = 160; // Alpha
    } else {
      maskImgData.data[i * 4 + 3] = 0; // Transparent
    }
  }

  maskCtx.putImageData(maskImgData, 0, 0);

  // Maskeyi orijinal boyuta büyüt
  const finalMaskCanvas = document.createElement('canvas');
  finalMaskCanvas.width = originalWidth;
  finalMaskCanvas.height = originalHeight;
  const finalCtx = finalMaskCanvas.getContext('2d');
  if (!finalCtx) throw new Error('Final context failed');
  finalCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

  // Heatmap Simülasyonu
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = originalWidth;
  heatCanvas.height = originalHeight;
  const heatCtx = heatCanvas.getContext('2d');
  if (heatCtx) {
    heatCtx.globalAlpha = 0.6;
    heatCtx.drawImage(finalMaskCanvas, 0, 0);
  }

  // Yoğunluk Skoru (Basit oran)
  // Kafanın tamamı yerine görüntü alanına göre oranlıyoruz
  const densityRaw = (hairPixelCount / (size * 0.3)) * 100; 
  const densityScore = Math.min(100, Math.round(densityRaw));

  let coverageLabel = 'Düşük Yoğunluk';
  if (densityScore > 80) coverageLabel = 'Yüksek Yoğunluk';
  else if (densityScore > 50) coverageLabel = 'Orta Yoğunluk';

  return {
    segmentationMask: finalMaskCanvas.toDataURL('image/png'),
    densityHeatmap: heatCanvas.toDataURL('image/png'),
    densityScore: densityScore,
    coverageLabel: coverageLabel
  };
};

export const processHairImage = async (photo: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.src = photo.preview;

      img.onload = async () => {
        try {
          const sess = await initSession();
          
          // Preprocess (ImageNet normalization)
          const tensor = preprocess(img, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

          // Inference
          const feeds: Record<string, ort.Tensor> = {};
          feeds[sess.inputNames[0]] = tensor;
          
          const results = await sess.run(feeds);
          
          // Postprocess (ArgMax)
          const outputTensor = results[sess.outputNames[0]];
          const processedData = postprocess(outputTensor, img.width, img.height);
          
          resolve({
            ...photo,
            preview: resizeImageForStorage(img),
            processed: processedData
          });

        } catch (error) {
          console.error("Inference Error:", error);
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Resim yüklenemedi."));
    } catch (e) {
      reject(e);
    }
  });
};