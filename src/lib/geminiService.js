const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

const convertImageToBase64 = (imageDataUrl) => {
  const base64Data = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.split(',')[0].split(':')[1].split(';')[0];
  return { base64Data, mimeType };
};

export const validateScanFrame = async (imageDataUrl, expectedAngle) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please add your API key to .env file.');
  }

  const { base64Data, mimeType } = convertImageToBase64(imageDataUrl);

  const prompt = `Analyze this photo for a hair loss assessment scan.

Expected angle: ${expectedAngle}

Check the following:
1. Is there a human head visible in the image?
2. Is the photo angle correct for "${expectedAngle}"?
   - "Front View" = face looking directly at camera
   - "Right Profile" = head turned 90° to the left (showing right side of head)
   - "Left Profile" = head turned 90° to the right (showing left side of head)
   - "Top View" = head tilted down showing crown
   - "Donor Area" = back of head, no face visible
3. Is the image sharp and clear (not blurry)?
4. Is the lighting adequate?

Return ONLY a JSON object in this exact format (no markdown, no backticks):
{
  "valid": true/false,
  "faceDetected": true/false,
  "correctAngle": true/false,
  "isSharp": true/false,
  "goodLighting": true/false,
  "message": "Brief feedback message for the user"
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          topK: 32,
          topP: 1,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error('No response from Gemini API');
    }

    const cleanedText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanedText);

    return result;
  } catch (error) {
    console.error('Gemini validation error:', error);
    throw error;
  }
};

export const analyzeHairImages = async (photos, patientData) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key not configured. Please add your API key to .env file.');
  }

  const imageParts = photos.map(photo => {
    const { base64Data, mimeType } = convertImageToBase64(photo.preview);
    return {
      inline_data: {
        mime_type: mimeType,
        data: base64Data
      }
    };
  });

  // GÜNCELLENMİŞ GÜÇLÜ PROMPT
  const prompt = `Act as an expert hair transplant surgeon. Analyze these ${photos.length} patient photos for a detailed hair loss assessment.

Patient Profile:
- Age: ${patientData.age}
- Gender: ${patientData.gender}
- History: ${patientData.hairLossDuration}
- Family History: ${patientData.familyHistory}

PERFORM A STRICT VISUAL DENSITY ANALYSIS:
Look closely at the scalp visibility in each region.
- If scalp is clearly visible through hair, density is < 50%.
- If scalp is completely invisible, density is > 80%.
- If there is no hair (bald), density is 0-10%.

Provide a JSON response with the following exact structure (no markdown):
{
  "overallScore": number (1-10, strict evaluation),
  "hairLossStage": "Norwood Scale classification (e.g. III-Vertex, IV, V)",
  "hairDensity": {
    "frontal": number (0-100, estimate based on frontal view),
    "crown": number (0-100, estimate based on top/back view),
    "temporal": number (0-100, estimate based on side views),
    "donor": number (0-100, estimate based on back view quality)
  },
  "recessionPattern": {
    "frontalRecession": "none/mild/moderate/severe",
    "crownThinning": "none/mild/moderate/severe",
    "templeRecession": "none/mild/moderate/severe"
  },
  "donorQuality": "Excellent/Good/Fair/Poor (assess thickness and density of donor area)",
  "estimatedGrafts": "Realistic range (e.g. 2500-3000)",
  "detailedObservations": [
    "Specific observation about hairline status",
    "Specific observation about crown thinning",
    "Specific observation about donor area health",
    "Any signs of inflammation or scarring if visible"
  ],
  "recommendations": [
    {
      "title": "Medical or Surgical option",
      "priority": "high/medium/low",
      "description": "Why this is recommended for this specific patient",
      "details": ["Dosage or procedure detail", "Expected timeframe"]
    }
  ]
}`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            ...imageParts
          ]
        }],
        generationConfig: {
          temperature: 0.2, // Lower temperature for more consistent/analytical results
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      throw new Error('No response from Gemini API');
    }

    const cleanedText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanedText);

    return result;
  } catch (error) {
    console.error('Gemini analysis error:', error);
    throw error;
  }
};

export const analyzeHairlineCoordinates = async (imageDataUrl) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
    return null;
  }

  const { base64Data, mimeType } = convertImageToBase64(imageDataUrl);

  const prompt = `Analyze the hairline in this image.
  Identify the current hairline path coordinates (x,y) from left temple to right temple.
  Return JSON: { "hairlinePoints": [{"x": %, "y": %}, ...] }`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64Data } }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 500 }
      })
    });

    if (!response.ok) return null;
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return null;
    
    return JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim());
  } catch (error) {
    console.error('Hairline analysis error:', error);
    return null;
  }
};