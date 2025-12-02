
/**
 * Simulates a Vision Transformer (ViT) hair segmentation model.
 * Provides frontend-only approximation of AI analysis using canvas pixel manipulation.
 * Optimized for specific view angles (Front, Side, Top, Back) to exclude facial features.
 */

// Helper to resize images to prevent localStorage quota exceeded errors
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
  return canvas.toDataURL('image/jpeg', 0.8);
};

// Robust Skin Detection Algorithm
const isSkinPixel = (r, g, b) => {
  // RGB Rule
  const isSkinRGB = (r > 95) && (g > 40) && (b > 20) &&
                    ((Math.max(r, g, b) - Math.min(r, g, b)) > 15) &&
                    (Math.abs(r - g) > 15) &&
                    (r > g) && (r > b);
  
  // YCbCr Rule (Approximate conversion for better robustness)
  const Cb = 128 - 0.168736*r - 0.331264*g + 0.5*b;
  const Cr = 128 + 0.5*r - 0.418688*g - 0.081312*b;
  const isSkinYCbCr = (Cb > 80 && Cb < 127) && (Cr > 133 && Cr < 173);
  
  return isSkinRGB || isSkinYCbCr;
};

export const processHairImage = async (photo) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = photo.preview;

    img.onload = () => {
      try {
        // 1. Create optimized base image
        const optimizedBase = resizeImageForStorage(img);

        // 2. Setup processing canvas (512x512 standard input for ViT models)
        const width = 512;
        const height = 512;
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Overlay Buffers
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');
        const maskData = maskCtx.createImageData(width, height);

        const heatCanvas = document.createElement('canvas');
        heatCanvas.width = width;
        heatCanvas.height = height;
        const heatCtx = heatCanvas.getContext('2d');
        const heatData = heatCtx.createImageData(width, height);

        let hairPixelCount = 0;
        let scalpRegionPixelCount = 0;

        // Geometric Constants
        const cx = width / 2;
        const cy = height / 2;
        
        // Determine View Type logic
        const type = (photo.type || 'front').toLowerCase();
        
        // Loop through every pixel
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // ---------------------------------------------------------
            // 1. Geometric Filtering (ROI) - Exclude Face/Background
            // ---------------------------------------------------------
            let isInsideROI = false;
            let isFaceExclusion = false;

            // Normalize coordinates (-1 to 1)
            const nx = (x - cx) / (width / 2);
            const ny = (y - cy) / (height / 2);

            if (type.includes('front')) {
              // Head Ellipse
              const headDist = (nx*nx)/(0.65*0.65) + (ny*ny)/(0.8*0.8);
              if (headDist < 1) isInsideROI = true;

              // Explicit Face Exclusion (Oval in lower center)
              // Center roughly at (0, 0.2) relative
              const fx = nx;
              const fy = ny - 0.25;
              const faceDist = (fx*fx)/(0.45*0.45) + (fy*fy)/(0.55*0.55);
              if (faceDist < 1) isFaceExclusion = true;

            } else if (type.includes('side') || type.includes('left') || type.includes('right')) {
              // Side View: Focus on top and back
              // Assuming facing left or right, exclude front face region
              const headDist = (nx*nx)/(0.75*0.75) + (ny*ny)/(0.8*0.8);
              if (headDist < 1) isInsideROI = true;
              
              // Exclude lower front quadrant roughly
              if (ny > 0 && Math.abs(nx) > 0.3) isFaceExclusion = true;

            } else if (type.includes('top')) {
              // Top View: Full circle focus, ignore corners
              const dist = nx*nx + ny*ny;
              if (dist < 0.6) isInsideROI = true;
              // Usually no face visible in pure top view
            } else {
               // Back/Default
               const headDist = (nx*nx)/(0.7*0.7) + (ny*ny)/(0.8*0.8);
               if (headDist < 1) isInsideROI = true;
            }

            // ---------------------------------------------------------
            // 2. Processing Logic
            // ---------------------------------------------------------
            if (isInsideROI && !isFaceExclusion) {
              scalpRegionPixelCount++;

              const isSkin = isSkinPixel(r, g, b);
              const brightness = (r + g + b) / 3;
              
              // Hair Detection Heuristics:
              // 1. Not skin AND
              // 2. Either very dark (dark hair) OR sufficient contrast/texture (light hair)
              // 3. Y coordinate bias (hair more likely at top of ROI)
              
              const isDark = brightness < 110;
              // Some hair highlights can be lighter, so we allow higher brightness if it's definitely not skin
              // and we are in the upper region of the head
              const isLighterHair = brightness < 180 && !isSkin && y < height * 0.6; 

              const isHair = (isDark || isLighterHair) && !isSkin;

              if (isHair) {
                hairPixelCount++;

                // --- Segmentation Mask (Blue) ---
                maskData.data[i] = 0;     // R
                maskData.data[i+1] = 100; // G
                maskData.data[i+2] = 255; // B
                maskData.data[i+3] = 180; // A (Stronger visibility)

                // --- Heatmap Generation ---
                // Simulate density: 
                // Darker pixels in hair region = Denser hair (Green)
                // Lighter pixels or pixels near skin boundary = Thinner (Yellow/Red)
                
                // Local density proxy: normalized brightness inverted
                const localDensity = Math.max(0, 1 - (brightness / 150)); 
                // Positional weighting (Top of head usually denser in non-balding)
                const positionWeight = 1 - (Math.abs(ny) * 0.5);
                
                const score = localDensity * 0.7 + positionWeight * 0.3;

                if (score > 0.65) {
                   // High Density (Green)
                   heatData.data[i] = 0; heatData.data[i+1] = 255; heatData.data[i+2] = 0; heatData.data[i+3] = 160;
                } else if (score > 0.4) {
                   // Medium (Yellow)
                   heatData.data[i] = 255; heatData.data[i+1] = 255; heatData.data[i+2] = 0; heatData.data[i+3] = 160;
                } else {
                   // Low (Red)
                   heatData.data[i] = 255; heatData.data[i+1] = 0; heatData.data[i+2] = 0; heatData.data[i+3] = 160;
                }

              } else {
                // Transparent
                maskData.data[i+3] = 0;
                heatData.data[i+3] = 0;
              }
            } else {
              // Transparent
              maskData.data[i+3] = 0;
              heatData.data[i+3] = 0;
            }
          }
        }

        // Write data
        maskCtx.putImageData(maskData, 0, 0);
        heatCtx.putImageData(heatData, 0, 0);

        // Metrics Calculation
        // Avoid division by zero
        const validArea = scalpRegionPixelCount > 0 ? scalpRegionPixelCount : 1;
        const densityScore = Math.min(100, Math.round((hairPixelCount / validArea) * 100));

        resolve({
          ...photo,
          preview: optimizedBase,
          processed: {
            segmentationMask: maskCanvas.toDataURL('image/png'),
            densityHeatmap: heatCanvas.toDataURL('image/png'),
            densityScore: densityScore,
            coverageLabel: densityScore > 80 ? 'Thick Coverage' : densityScore > 50 ? 'Moderate Thinning' : 'Significant Loss',
          }
        });

      } catch (e) {
        console.error("ViT Processing Error", e);
        reject(e);
      }
    };

    img.onerror = (err) => {
      console.error("Image load error", err);
      reject(err);
    };
  });
};
