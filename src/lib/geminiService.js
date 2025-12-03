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

  const prompt = `You are an expert hair restoration surgeon analyzing these ${photos.length} photos for hair loss assessment.

Patient Information:
- Age: ${patientData.age}
- Gender: ${patientData.gender}
- Hair Loss Pattern: ${patientData.hairLossPattern}
- Duration: ${patientData.hairLossDuration}
- Family History: ${patientData.familyHistory}

Photo angles provided: ${photos.map(p => p.type).join(', ')}

Provide a comprehensive analysis in JSON format (no markdown, no backticks):
{
  "overallScore": number (1-10, where 1=severe loss, 10=minimal loss),
  "hairLossStage": "Norwood Scale classification",
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
  "estimatedGrafts": "Range estimate (e.g., 1500-2000)",
  "detailedObservations": [
    "Observation 1",
    "Observation 2",
    "Observation 3"
  ],
  "recommendations": [
    {
      "title": "Treatment name",
      "priority": "high/medium/low",
      "description": "Detailed description",
      "details": ["Detail 1", "Detail 2", "Detail 3"]
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
          temperature: 0.4,
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

  const prompt = `Analyze the hairline in this image and provide coordinates for visualization.

Return ONLY a JSON object (no markdown):
{
  "hairlinePoints": [
    {"x": number (0-100), "y": number (0-100)},
    ... (5-10 points mapping the hairline)
  ],
  "recessionAreas": [
    {"x": number, "y": number, "severity": "mild/moderate/severe"}
  ]
}

Coordinates should be percentages (0-100) of image dimensions.`;

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
          temperature: 0.2,
          maxOutputTokens: 500,
        }
      })
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return null;
    }

    const cleanedText = resultText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleanedText);

    return result;
  } catch (error) {
    console.error('Hairline coordinate analysis error:', error);
    return null;
  }
};
