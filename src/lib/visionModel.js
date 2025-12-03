/**
 * Basic Image Processing Model
 * Focuses on image optimization and basic quality checks instead of complex segmentation.
 */

// Helper: Simple brightness calculation
const calculateBrightness = (data, width, height) => {
  let totalBrightness = 0;
  for (let i = 0; i < data.length; i += 4) {
    totalBrightness += (data[i] + data[i + 1] + data[i + 2]) / 3;
  }
  return totalBrightness / (width * height);
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

/**
 * Creates a premium-looking visual for hair analysis.
 * This is a placeholder function. In a real application, this would use advanced
 * techniques (like AI segmentation models) to:
 * 1. Remove the background.
 * 2. Detect and blur the face.
 * 3. Crop and zoom into the hair area.
 *
 * For now, it simulates this by applying a blur and a crop effect.
 */
export const createPremiumHairVisual = async (photoUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = photoUrl;

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Set canvas size (e.g., square for a premium look)
        const size = Math.min(img.width, img.height);
        canvas.width = size;
        canvas.height = size;

        // --- Simulate Premium Effects ---

        // 1. Background Removal (Simulated with a clean background color)
        ctx.fillStyle = '#f0f0f0'; // Light gray background
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Face Blur & 3. Zoom (Simulated by a central crop and blur filter)
        // Calculate a central crop rectangle
        const cropX = (img.width - size) / 2;
        const cropY = (img.height - size) / 2;

        // Apply a blur filter to the context
        ctx.filter = 'blur(10px)';
        
        // Draw the cropped image onto the canvas with the blur effect
        ctx.drawImage(img, cropX, cropY, size, size, 0, 0, size, size);
        
        // Reset the filter for any subsequent drawing
        ctx.filter = 'none';

        // Optional: Add a subtle vignette or border for a more finished look
        const gradient = ctx.createRadialGradient(size / 2, size / 2, size / 4, size / 2, size / 2, size / 1.4);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.2)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size, size);

        resolve(canvas.toDataURL('image/png'));

      } catch (e) {
        console.error("Error creating premium visual:", e);
        // Fallback to the original image if processing fails
        resolve(photoUrl);
      }
    };

    img.onerror = (err) => {
        console.error("Error loading image for premium visual:", err);
        reject(err);
    };
  });
};

export const processHairImage = async (photo) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = photo.preview;

    img.onload = () => {
      try {
        const optimizedBase = resizeImageForStorage(img);

        // Process at a fixed, reasonable resolution for basic metrics
        const width = 320; 
        const height = Math.floor(width * (img.height / img.width));
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        const imageData = ctx.getImageData(0, 0, width, height);
        const avgBrightness = calculateBrightness(imageData.data, width, height);

        // Simple heuristic for image quality based on brightness
        // Range 0-255. Good lighting is typically between 80 and 200.
        let qualityLabel = 'Good';
        if (avgBrightness < 60) qualityLabel = 'Too Dark';
        else if (avgBrightness > 220) qualityLabel = 'Too Bright';

        resolve({
          ...photo,
          preview: optimizedBase,
          // Removed complex segmentation and heatmap data
          // Instead, returning basic image quality metrics
          processed: {
            brightness: Math.round(avgBrightness),
            qualityLabel: qualityLabel,
            // Placeholder for density score if needed by other components, 
            // but now derived from simple brightness or just a default until AI analysis
            densityScore: null, 
            coverageLabel: null 
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