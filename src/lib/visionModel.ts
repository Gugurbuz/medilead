import { GoogleGenerativeAI } from "@google/generative-ai";

// Eğer environment variable yoksa boş string döner (Hata yönetimi için)
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || "";

const genAI = new GoogleGenerativeAI(API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash",
});

/**
 * File objesini Base64 string'e çeviren yardımcı fonksiyon.
 */
const fileToGenerativePart = async (file: File | Blob): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      // "data:image/jpeg;base64," kısmını temizle
      const base64Data = base64String.split(",")[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Base64 string'den veri temizleme ve formatlama yardımcısı
 */
const base64ToGenerativePart = (base64String: string, mimeType: string) => {
  return {
    inlineData: {
      data: base64String.includes("base64,") ? base64String.split(",")[1] : base64String,
      mimeType
    },
  };
};

export interface HairAnalysisResult {
  condition: string;
  treatment: string;
  products: string[];
  routine: string;
  notes: string;
}

export const processHairImage = async (
  imageSource: File | string,
  additionalNotes?: string
): Promise<HairAnalysisResult> => {
  try {
    if (!API_KEY) {
      throw new Error("Google API Key bulunamadı. Lütfen .env dosyanızı kontrol edin.");
    }

    let imagePart;

    // TİP KONTROLÜ VE DÖNÜŞÜM
    if (imageSource instanceof File || imageSource instanceof Blob) {
      // Eğer girdi bir Dosya ise, Base64'e çevir
      imagePart = await fileToGenerativePart(imageSource);
    } else if (typeof imageSource === 'string') {
      // Eğer girdi zaten String ise
      if (imageSource.startsWith('data:')) {
        // Data URL ise parse et (mimeType'ı string içinden al)
        const mimeType = imageSource.substring(5, imageSource.indexOf(';'));
        imagePart = base64ToGenerativePart(imageSource, mimeType);
      } else {
        // Düz URL veya başka bir string ise hata fırlat
         throw new Error("Geçersiz resim formatı. Lütfen geçerli bir dosya veya Base64 string sağlayın.");
      }
    } else {
      throw new Error("Görüntü kaynağı tanınamadı (File veya Base64 String olmalı).");
    }

    const prompt = `
      Sen uzman bir dermatolog ve saç sağlığı uzmanısın.
      Bu saç fotoğrafını analiz et ve aşağıdaki formatta JSON verisi döndür.
      Sadece JSON döndür, markdown veya ek metin ekleme.
      
      Kullanıcı notları: ${additionalNotes || "Yok"}

      İstenen JSON Yapısı:
      {
        "condition": "Saçın durumu ve teşhis (örn: Yağlı egzama, kepek, saç dökülmesi)",
        "treatment": "Önerilen tedavi yöntemleri",
        "products": ["Önerilen ürün tipleri (Marka verme, içerik ver. Örn: Ketokonazol şampuan)"],
        "routine": "Günlük/Haftalık bakım rutini önerisi",
        "notes": "Ekstra tavsiyeler ve dikkat edilmesi gerekenler"
      }
    `;

    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    const text = response.text();

    // JSON temizleme (Markdown bloklarını kaldırır)
    const cleanedText = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return JSON.parse(cleanedText) as HairAnalysisResult;

  } catch (error) {
    console.error("Hair Analysis Error:", error);
    throw new Error("Saç analizi yapılırken bir hata oluştu: " + (error instanceof Error ? error.message : "Bilinmeyen hata"));
  }
};