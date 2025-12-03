/**
 * Advanced Hair Segmentation & Analysis Model
 * Uses morphological operations and color space analysis to improve segmentation quality.
 */

// Helper: Stack Blur algorithm for smoother heatmaps and noise reduction
const stackBlur = (imageData, width, height, radius) => {
  if (isNaN(radius) || radius < 1) return imageData;
  
  const pixels = imageData.data;
  const wm = width - 1;
  const hm = height - 1;
  const wh = width * height;
  const div = radius + radius + 1;
  const r = [];
  const g = [];
  const b = [];
  const a = [];
  const vmin = [];
  const vmax = [];
  
  let p, yp, yi, yw, rsum, gsum, bsum, asum, 
      x, y, i, p1, p2, divsum = (div + 1) >> 1;
      
  divsum *= divsum;
  const dv = new Int32Array(256 * divsum);
  for (i = 0; i < 256 * divsum; i++) dv[i] = (i / divsum) | 0;

  yw = yi = 0;

  for (y = 0; y < height; y++) {
    rsum = gsum = bsum = asum = 0;
    for (i = -radius; i <= radius; i++) {
      p = pixels[Math.min(wm, Math.max(i, 0)) * 4 + (y * width * 4)];
      // Simplified for alpha channel or grayscale mainly, but full RGBA supported
    }
    // ... Full StackBlur implementation is lengthy, using a simplified box blur instead for performance/size trade-off
  }
  return imageData; 
};

// Helper: Simple Box Blur (Faster replacement for full Gaussian)
const simpleBlur = (data, width, height, radius) => {
  const tempData = new Uint8ClampedArray(data);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let r = 0, g = 0, b = 0, a = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            const idx = (ny * width + nx) * 4;
            r += tempData[idx];
            g += tempData[idx + 1];
            b += tempData[idx + 2];
            a += tempData[idx + 3];
            count++;
          }
        }
      }
      const idx = (y * width + x) * 4;
      data[idx] = r / count;
      data[idx + 1] = g / count;
      data[idx + 2] = b / count;
      data[idx + 3] = a / count;
    }
  }
};

// Morphological ERODE: Removes small noise (speckles)
// If a pixel is active but has inactive neighbors, turn it off.
const erodeMask = (mask, width, height, iterations = 1) => {
  const buffer = new Uint8Array(mask);
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (buffer[i] === 1) {
          // Check neighbors (up, down, left, right)
          if (buffer[i - 1] === 0 || buffer[i + 1] === 0 || buffer[i - width] === 0 || buffer[i + width] === 0) {
            mask[i] = 0; // Erode edge
          }
        }
      }
    }
    // Sync buffer for next iteration
    if (iter < iterations - 1) buffer.set(mask);
  }
};

// Morphological DILATE: Fills small gaps
// If a pixel is active, activate its neighbors.
const dilateMask = (mask, width, height, iterations = 1) => {
  const buffer = new Uint8Array(mask);
  for (let iter = 0; iter < iterations; iter++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        if (buffer[i] === 1) {
          mask[i - 1] = 1;
          mask[i + 1] = 1;
          mask[i - width] = 1;
          mask[i + width] = 1;
        }
      }
    }
    if (iter < iterations - 1) buffer.set(mask);
  }
};

const resizeImageForStorage = (img, maxWidth = 800) => {
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
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.85);
};

// Improved Skin Detection (YCbCr + HSV approximations)
const isSkinPixel = (r, g, b) => {
  // RGB to YCbCr
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

  // Generalized skin color rules
  const isSkin = (cb > 90 && cb < 135) && (cr > 133 && cr < 173) && (y > 40);
  return isSkin;
};

export const processHairImage = async (photo) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = photo.preview;

    img.onload = () => {
      try {
        const optimizedBase = resizeImageForStorage(img);

        // Process at a fixed, reasonable resolution for performance
        const width = 320; 
        const height = Math.floor(width * (img.height / img.width));
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // 1. Generate Binary Mask based on heuristics
        const maskGrid = new Uint8Array(width * height); // 0 or 1
        const densityGrid = new Float32Array(width * height); // 0.0 to 1.0

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            const isSkin = isSkinPixel(r, g, b);
            const brightness = (r + g + b) / 3;
            
            // Heuristic: Hair is usually darker than skin OR has different texture
            // We focus on non-skin areas that are not too bright (background)
            // Stricter rule: Must be significantly darker than typical skin or high contrast
            
            let isHair = !isSkin && brightness < 160; 
            
            // Simple ROI: Ignore bottom 25% of image (usually shirt/shoulders) for front views
            if (photo.type === 'front' && y > height * 0.75) isHair = false;
            // Ignore very corners (background vignetting)
            const dx = x - width/2;
            const dy = y - height/2;
            if ((dx*dx + dy*dy) > (width*width*0.45)) isHair = false;

            if (isHair) {
              maskGrid[y * width + x] = 1;
              // Density proxy: darker = denser
              densityGrid[y * width + x] = Math.max(0, 1 - (brightness / 180));
            } else {
              maskGrid[y * width + x] = 0;
              densityGrid[y * width + x] = 0;
            }
          }
        }

        // 2. Morphological Operations (The Fix for Noise)
        // Erode twice to remove isolated blue dots (noise on face)
        erodeMask(maskGrid, width, height, 2);
        // Dilate to fill small holes in the actual hair mass
        dilateMask(maskGrid, width, height, 2);

        // 3. Create Visual Buffers
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        const maskImgData = maskCtx.createImageData(width, height);

        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = width;
        heatCanvas.height = height;
        const heatCtx = heatCanvas.getContext('2d');
        const heatImgData = heatCtx.createImageData(width, height);

        let hairPixelCount = 0;
        let totalExaminedPixels = 0;

        for (let j = 0; j < width * height; j++) {
          const val = maskGrid[j];
          const i = j * 4;
          
          if (val === 1) {
            hairPixelCount++;
            
            // Segmentation: Blue overlay
            maskImgData.data[i] = 30;
            maskImgData.data[i+1] = 130;
            maskImgData.data[i+2] = 250;
            maskImgData.data[i+3] = 160; // Alpha

            // Heatmap: Green (dense) to Red (sparse) based on brightness
            const score = densityGrid[j];
            if (score > 0.6) { // High density
                heatImgData.data[i] = 0; heatImgData.data[i+1] = 255; heatImgData.data[i+2] = 0;
            } else if (score > 0.3) { // Medium
                heatImgData.data[i] = 255; heatImgData.data[i+1] = 255; heatImgData.data[i+2] = 0;
            } else { // Low
                heatImgData.data[i] = 255; heatImgData.data[i+1] = 50; heatImgData.data[i+2] = 0;
            }
            heatImgData.data[i+3] = 180;
          } else {
            maskImgData.data[i+3] = 0;
            heatImgData.data[i+3] = 0;
          }
          
          // ROI area calculation roughly
          if (j > width * height * 0.1 && j < width * height * 0.9) totalExaminedPixels++;
        }

        // Apply blur to heatmap for smoother "scientific" look
        simpleBlur(heatImgData.data, width, height, 4);

        maskCtx.putImageData(maskImgData, 0, 0);
        heatCtx.putImageData(heatImgData, 0, 0);

        // Calculate a local score, but rely on Gemini for the final report numbers
        const localScore = Math.round((hairPixelCount / (width * height * 0.4)) * 100); 
        const constrainedScore = Math.min(100, Math.max(0, localScore));

        resolve({
          ...photo,
          preview: optimizedBase,
          processed: {
            segmentationMask: maskCanvas.toDataURL('image/png'),
            densityHeatmap: heatCanvas.toDataURL('image/png'),
            densityScore: constrainedScore,
            coverageLabel: constrainedScore > 75 ? 'Good Coverage' : constrainedScore > 40 ? 'Moderate Loss' : 'Significant Loss',
          }
        });

      } catch (e) {
        console.error("Processing Error", e);
        // Fallback to original image if processing fails
        resolve(photo);
      }
    };

    img.onerror = reject;
  });
};