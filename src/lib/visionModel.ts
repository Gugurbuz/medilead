import * as ort from 'onnxruntime-web';

/**
 * Real ONNX Runtime Implementation for Hair Analysis
 * Bu modül, tarayıcı içinde gerçek yapay zeka çıkarımı (inference) yapar.
 * Model, Supabase Storage veya herhangi bir genel URL üzerinden yüklenir.
 */

// --- AYARLAR ---

// ÖNEMLİ: Supabase Storage'a yüklediğiniz modelin "Public URL"ini buraya yapıştırın.
const MODEL_PATH = 'https://uzootohvsanqlhijmkpn.supabase.co/storage/v1/object/public/models/face_parsing_bisenet.onnx';

// Modelinizin giriş boyutu (Genellikle 224, 256, 512 veya 640 olur. Modelinize göre değiştirin.)
const MODEL_INPUT_SIZE = 512;

// Maske oluşturma hassasiyeti (0.0 - 1.0 arası). 
// 0.5 standarttır; daha düşük değerler daha fazla alanı saç olarak işaretler.
const PROBABILITY_THRESHOLD = 0.5;

// Global oturum değişkeni (Modelin her seferinde tekrar yüklenmesini engeller)
let session: ort.InferenceSession | null = null;

/**
 * Yardımcı Fonksiyon: Resmi depolama ve önizleme için yeniden boyutlandırır.
 * LocalStorage kotasını aşmamak için önemlidir.
 */
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
  
  if (ctx) {
    ctx.drawImage(img, 0, 0, width, height);
  }
  
  return canvas.toDataURL('image/jpeg', 0.8);
};

/**
 * ONNX Oturumunu Başlatır
 * Modeli URL'den indirir ve hazırlar.
 */
const initSession = async () => {
  if (session) {
    return session;
  }

  try {
    // WebAssembly (WASM) dosyaları için yol ayarı gerekebilir, 
    // ancak Vite genellikle node_modules üzerinden bunu çözer.
    
    // Oturumu oluştur
    session = await ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ['webgl', 'wasm'], // Önce GPU (WebGL), olmazsa CPU (WASM) dener
      graphOptimizationLevel: 'all'
    });
    
    console.log('ONNX Session initialized successfully from URL');
    return session;
  } catch (e) {
    console.error('Failed to init ONNX session:', e);
    throw new Error('Yapay zeka modeli sunucudan yüklenemedi. Lütfen internet bağlantınızı kontrol edin veya model URL\'sini doğrulayın.');
  }
};

/**
 * Ön İşleme (Preprocessing)
 * Görüntüyü modelin beklediği tensör formatına (Float32Array) dönüştürür.
 */
const preprocess = (image: HTMLImageElement, width: number, height: number): ort.Tensor => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Canvas context could not be created');
  }
  
  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  const { data } = imageData;
  
  // Model girişi için Float32 dizisi oluştur (Batch x Channel x Height x Width)
  const inputTensor = new Float32Array(1 * 3 * width * height);
  
  for (let i = 0; i < width * height; i++) {
    // RGB değerlerini 0-1 aralığına normalize et
    // Not: Eğer modeliniz Mean/Std normalizasyonu gerektiriyorsa burayı düzenleyin.
    const r = data[i * 4] / 255.0;
    const g = data[i * 4 + 1] / 255.0;
    const b = data[i * 4 + 2] / 255.0;

    // NCHW Formatı (Batch, Channel, Height, Width)
    // Red kanalı
    inputTensor[i] = r;
    // Green kanalı
    inputTensor[i + width * height] = g;
    // Blue kanalı
    inputTensor[i + 2 * width * height] = b;
  }

  // Tensör nesnesini oluştur
  return new ort.Tensor('float32', inputTensor, [1, 3, height, width]);
};

/**
 * Son İşleme (Postprocessing)
 * Model çıktısını (maskeyi) görselleştirilebilir bir resme dönüştürür.
 */
const postprocess = (
  outputTensor: ort.Tensor, 
  originalWidth: number, 
  originalHeight: number
) => {
  const outputData = outputTensor.data as Float32Array;
  
  // Çıktı boyutunun model giriş boyutuyla (MODEL_INPUT_SIZE x MODEL_INPUT_SIZE) eşleştiğini varsayıyoruz.
  // Model çıktısı genellikle düzleştirilmiş (flattened) bir dizidir.
  const size = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
  
  // 1. Ham maske verisi için geçici canvas
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = MODEL_INPUT_SIZE;
  maskCanvas.height = MODEL_INPUT_SIZE;
  const maskCtx = maskCanvas.getContext('2d');
  
  if (!maskCtx) throw new Error('Mask context failed');

  const maskImgData = maskCtx.createImageData(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
  
  let hairPixelCount = 0;

  for (let i = 0; i < size; i++) {
    // Model çıktısı olasılık (0-1) veya logit olabilir.
    // Çoğu segmentasyon modeli sigmoid aktivasyonu uygulanmış 0-1 arası değer döner.
    const prob = outputData[i]; 
    
    if (prob > PROBABILITY_THRESHOLD) {
      hairPixelCount++;
      // Saç bölgesi için Mavi renk
      maskImgData.data[i * 4] = 0;     // R
      maskImgData.data[i * 4 + 1] = 100; // G
      maskImgData.data[i * 4 + 2] = 255; // B
      maskImgData.data[i * 4 + 3] = 160; // Alpha (Saydamlık)
    } else {
      // Saç olmayan bölge (Tamamen saydam)
      maskImgData.data[i * 4 + 3] = 0; 
    }
  }
  
  maskCtx.putImageData(maskImgData, 0, 0);

  // 2. Maskeyi orijinal resim boyutuna ölçekle
  const finalMaskCanvas = document.createElement('canvas');
  finalMaskCanvas.width = originalWidth;
  finalMaskCanvas.height = originalHeight;
  const finalCtx = finalMaskCanvas.getContext('2d');
  
  if (!finalCtx) throw new Error('Final context failed');
  
  // Küçük maskeyi orijinal boyuta büyüt (Yumuşatma otomatik yapılır)
  finalCtx.drawImage(maskCanvas, 0, 0, originalWidth, originalHeight);

  // 3. Yoğunluk Haritası (Heatmap) Oluşturma
  // Şimdilik maskeyi temel alıyoruz, ileride model belirsizliği (uncertainty) eklenebilir.
  const heatCanvas = document.createElement('canvas');
  heatCanvas.width = originalWidth;
  heatCanvas.height = originalHeight;
  const heatCtx = heatCanvas.getContext('2d');
  
  if (heatCtx) {
    heatCtx.globalAlpha = 0.6;
    heatCtx.drawImage(finalMaskCanvas, 0, 0);
  }

  // 4. Yoğunluk Skoru Hesaplama
  // Basit bir metrik: Maskelenen alanın toplam alana oranı.
  // Gerçekçi bir yoğunluk için sadece kafa derisi alanı (ROI) dikkate alınmalıdır.
  // Burada kaba bir tahmin yapıyoruz (Tüm resmin %40'ı kafa varsayımıyla).
  const estimatedHeadArea = size * 0.4;
  const densityRaw = (hairPixelCount / estimatedHeadArea) * 100;
  const densityScore = Math.min(100, Math.round(densityRaw)); 

  let coverageLabel = 'Low Density';
  if (densityScore > 80) coverageLabel = 'High Density';
  else if (densityScore > 50) coverageLabel = 'Moderate';

  return {
    segmentationMask: finalMaskCanvas.toDataURL('image/png'),
    densityHeatmap: heatCanvas.toDataURL('image/png'),
    densityScore: densityScore,
    coverageLabel: coverageLabel
  };
};

/**
 * Uygulamanın çağırdığı ana fonksiyon
 * @param photo - İşlenecek fotoğraf nesnesi
 */
export const processHairImage = async (photo: any) => {
  return new Promise(async (resolve, reject) => {
    try {
      // 1. Resmi Yükle
      const img = new Image();
      img.crossOrigin = "Anonymous"; // CORS sorunlarını önlemek için
      img.src = photo.preview;

      img.onload = async () => {
        try {
          // Oturumu Başlat (Varsa önbellekten, yoksa URL'den)
          const sess = await initSession();

          // 2. Resmi Hazırla (Preprocess)
          const tensor = preprocess(img, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);

          // 3. Modeli Çalıştır (Inference)
          // Modelin giriş ve çıkış isimlerini otomatik bulmaya çalışıyoruz.
          const feeds: Record<string, ort.Tensor> = {};
          const inputNames = sess.inputNames;
          
          // Genellikle ilk giriş 'input' veya 'images' olur
          feeds[inputNames[0]] = tensor;

          const results = await sess.run(feeds);

          // 4. Çıktıyı Al
          const outputName = sess.outputNames[0];
          const outputTensor = results[outputName];

          // 5. Sonuçları İşle (Postprocess)
          const processedData = postprocess(outputTensor, img.width, img.height);
          
          // Depolama için orijinal resmi optimize et
          const optimizedBase = resizeImageForStorage(img);

          // Sonuç nesnesini döndür
          resolve({
            ...photo,
            preview: optimizedBase,
            processed: processedData
          });

        } catch (error) {
          console.error("AI Inference error:", error);
          reject(error);
        }
      };

      img.onerror = (err) => {
        console.error("Image failed to load for AI processing", err);
        reject(new Error("Resim yüklenemedi. Dosya bozuk veya formatı desteklenmiyor olabilir."));
      };

    } catch (e) {
      console.error("General processing error:", e);
      reject(e);
    }
  });
};