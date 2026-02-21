/**
 * Client-side image quality checks (best-effort).
 * Runs before AI call to warn about poor quality images.
 */

export interface ImageQualityReport {
  ok: boolean;
  issues: Array<{
    type: "too_dark" | "too_bright" | "too_small" | "too_blurry";
    message: string;
  }>;
}

const MIN_WIDTH = 640;
const MIN_HEIGHT = 480;

/**
 * Check image dimensions from a File object.
 */
function checkDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image"));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Sample pixels from a canvas to compute average brightness (0–255).
 */
function computeBrightness(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const sampleSize = 100;
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        resolve(128); // fallback: assume ok
        return;
      }
      ctx.drawImage(img, 0, 0, sampleSize, sampleSize);
      const data = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
      let totalBrightness = 0;
      const pixelCount = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        // Perceived brightness formula
        totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }
      URL.revokeObjectURL(img.src);
      resolve(totalBrightness / pixelCount);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image for brightness check"));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Run all quality checks on an image file.
 */
export async function checkImageQuality(file: File): Promise<ImageQualityReport> {
  const issues: ImageQualityReport["issues"] = [];

  try {
    const { width, height } = await checkDimensions(file);
    if (width < MIN_WIDTH || height < MIN_HEIGHT) {
      issues.push({
        type: "too_small",
        message: `Image resolution too low (${width}×${height}). Minimum ${MIN_WIDTH}×${MIN_HEIGHT}.`,
      });
    }
  } catch {
    // Can't check dimensions — skip
  }

  try {
    const brightness = await computeBrightness(file);
    if (brightness < 40) {
      issues.push({
        type: "too_dark",
        message: "Image appears too dark. Try retaking with better lighting.",
      });
    } else if (brightness > 235) {
      issues.push({
        type: "too_bright",
        message: "Image appears overexposed/too bright. Try retaking.",
      });
    }
  } catch {
    // Can't check brightness — skip
  }

  // File size heuristic for blur (very small file for claimed resolution = possibly blurry)
  if (file.size < 20_000 && file.size > 0) {
    issues.push({
      type: "too_blurry",
      message: "Image file is very small — might be blurry or very low quality.",
    });
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Compress an image file client-side using canvas.
 * Returns a new Blob with reduced size.
 */
export function compressImage(
  file: File,
  maxWidth = 1920,
  maxHeight = 1920,
  quality = 0.85,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      if (h > maxHeight) {
        w = Math.round((w * maxHeight) / h);
        h = maxHeight;
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(img.src);
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          resolve(blob ?? file);
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("Failed to load image for compression"));
    };
    img.src = URL.createObjectURL(file);
  });
}
