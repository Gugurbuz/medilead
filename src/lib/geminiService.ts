const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

const convertImageToBase64 = (imageDataUrl) => {
  const base64Data = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.split(',')[0].split(':')[1].split(';')[0];
  return { base64Data, mimeType };
};

// Yardımcı: JSON Parse işlemini güvenli hale getir
const safeJsonParse = (text, fallback = null) => {
  try {
    // Markdown formatındaki json bloklarını temizle
    const cleanedText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    // Bazen model JSON'ın başına/sonuna fazladan metin ekleyebilir, sadece süslü parantez arasını almayı dene
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    const jsonString = jsonMatch ? jsonMatch[0] : cleanedText;
    return JSON.parse(jsonString);
  } catch (error) {
    console.warn("JSON Parse warning:", error, "Text was:", text);
    if (fallback) return fallback;
    throw new Error(`Failed to parse AI response: ${text.substring(0, 100)}...`);
  }
};

export const validateScanFrame = async (imageDataUrl, expectedAngle) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please add your API key to .env file.');
  }

  const { base64Data, mimeType } = convertImageToBase64(imageDataUrl);

  // Prompt güncellendi: Tıbbi teşhis yerine teknik görüntü kalitesi kontrolü
  const prompt = `Analyze the technical quality of this image for an automated processing system. 
  
  Expected angle: ${expectedAngle}
  
  Strictly evaluate these technical parameters:
  1. Is a human head clearly visible?
  2. Does the head pose match "${expectedAngle}"?
  3. Is the image sharpness acceptable for computer vision processing?
  4. Is the lighting sufficient for feature detection?
  
  Return ONLY a valid JSON object:
  {
    "valid": boolean,
    "faceDetected": boolean,
    "correctAngle": boolean,
    "isSharp": boolean,
    "goodLighting": boolean,
    "message": "Short technical feedback"
  }`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: {
          temperature: 0.1, // Daha tutarlı yanıtlar için düşük sıcaklık
          response_mime_type: "application/json" // Modelin JSON zorlaması
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) throw new Error('No response from Gemini API');

    // Güvenli parse
    return safeJsonParse(resultText, {
        valid: false,
        faceDetected: false,
        correctAngle: false,
        isSharp: false,
        goodLighting: false,
        message: "Analysis failed, please try again."
    });

  } catch (error) {
    console.error('Gemini validation error:', error);
    // Hata durumunda varsayılan olarak geçerli kabul etmemek daha güvenli
    return { valid: false, message: "Validation service unavailable." };
  }
};

export const analyzeHairImages = async (photos, patientData) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured.');
  }

  const imageParts = photos.map(photo => {
    const { base64Data, mimeType } = convertImageToBase64(photo.preview);
    return { inline_data: { mime_type: mimeType, data: base64Data } };
  });

  // Prompt güncellendi: "Surgeon" yerine "Aesthetic AI Assistant". Tıbbi tanı yerine "Görsel Analiz".
  const prompt = `You are an AI assistant performing a visual analysis of hair density and aesthetic patterns. This is NOT a medical diagnosis.

  Context:
  - Age: ${patientData.age}
  - Gender: ${patientData.gender}
  - Stated Pattern: ${patientData.hairLossPattern}
  - Duration: ${patientData.hairLossDuration}

  Task: Visually analyze the provided photos and output structured data about hair visibility and coverage.

  Return ONLY a JSON object with this exact schema:
  {
    "overallScore": number (1-10 visual density score),
    "hairLossStage": "Norwood/Ludwig scale estimation",
    "hairDensity": {
      "frontal": number (0-100),
      "crown": number (0-100),
      "temporal": number (0-100),
      "donor": number (0-100)
    },
    "recessionPattern": {
      "frontalRecession": "none/mild/moderate/severe",
      "crownThinning": "none/mild/moderate/severe",
      "templeRecession": "none/mild/moderate/severe"
    },
    "donorQuality": "Excellent/Good/Fair/Poor",
    "estimatedGrafts": "Range estimate (e.g. '1500-2000')",
    "detailedObservations": ["string", "string"],
    "recommendations": [
      {
        "title": "string",
        "priority": "high/medium/low",
        "description": "string",
        "details": ["string"]
      }
    ]
  }`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }],
        generationConfig: {
          temperature: 0.2,
          response_mime_type: "application/json" // JSON modunu zorla
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) throw new Error('No response from Gemini API');

    return safeJsonParse(resultText);

  } catch (error) {
    console.error('Gemini analysis error:', error);
    // UI'ın çökmemesi için mock data dön
    return {
      overallScore: 5,
      hairLossStage: "Analysis Failed",
      hairDensity: { frontal: 0, crown: 0, temporal: 0, donor: 0 },
      recessionPattern: { frontalRecession: "unknown", crownThinning: "unknown", templeRecession: "unknown" },
      donorQuality: "Unknown",
      estimatedGrafts: "Consultation needed",
      detailedObservations: ["AI analysis could not be completed due to a service error."],
      recommendations: []
    };
  }
};

export const analyzeHairlineCoordinates = async (imageDataUrl) => {
  if (!GEMINI_API_KEY) return null;

  const { base64Data, mimeType } = convertImageToBase64(imageDataUrl);

  const prompt = `Identify the visible hairline coordinates in this image for drawing a guide line.
  Return JSON: {"hairlinePoints": [{"x": number, "y": number}], "recessionAreas": []}
  Coordinates 0-100 percentage.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }]
        }],
        generationConfig: { 
            temperature: 0.2,
            response_mime_type: "application/json" 
        }
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!resultText) return null;
    return safeJsonParse(resultText);

  } catch (error) {
    console.error('Hairline coordinate analysis error:', error);
    return null;
  }
};