import * as faceapi from 'face-api.js';

let modelsLoaded = false;

export async function loadFaceApiModels() {
  if (modelsLoaded) return;
  const MODEL_URL = '/models';
  await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
  modelsLoaded = true;
}

export async function processAndBlurFaces(imageFile: File): Promise<Blob> {
  await loadFaceApiModels();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(imageFile);
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error("Could not get canvas context");

        // Draw original image (this implicitly strips EXIF)
        ctx.drawImage(img, 0, 0);

        // Detect faces
        const detections = await faceapi.detectAllFaces(
          img, 
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 })
        );

        // Blur each face
        for (const detection of detections) {
          const { x, y, width, height } = detection.box;
          
          const expand = 0.15;
          const exX = Math.max(0, x - width * expand);
          const exY = Math.max(0, y - height * expand);
          const exW = Math.min(canvas.width - exX, width * (1 + 2 * expand));
          const exH = Math.min(canvas.height - exY, height * (1 + 2 * expand));

          ctx.save();
          ctx.filter = 'blur(20px)';
          ctx.beginPath();
          ctx.rect(exX, exY, exW, exH);
          ctx.clip();
          ctx.drawImage(img, 0, 0);
          ctx.restore();
        }

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Canvas toBlob failed"));
          }
        }, imageFile.type || 'image/jpeg', 0.85);
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(img.src);
      }
    };
    img.onerror = () => reject(new Error("Failed to load image"));
  });
}
