/**
 * Utility functions for capturing face images from video/canvas
 */

/**
 * Extract face image from video element using face bounding box
 * @param video - HTML video element
 * @param faceBox - Face bounding box [x, y, width, height]
 * @returns Promise resolving to Blob of the cropped face image
 */
export async function extractFaceImage(
  video: HTMLVideoElement,
  faceBox: [number, number, number, number]
): Promise<Blob> {
  console.log("📸 [CAPTURE DEBUG] Extracting face image:", {
    faceBox,
    videoWidth: video.videoWidth,
    videoHeight: video.videoHeight,
    readyState: video.readyState,
  });

  // Create a temporary canvas to crop the face
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    console.error("❌ [CAPTURE DEBUG] Could not get canvas context");
    throw new Error("Could not get canvas context");
  }

  // Add padding around the face (20% on each side)
  const padding = 0.2;
  const [x, y, width, height] = faceBox;
  const paddedX = Math.max(0, x - width * padding);
  const paddedY = Math.max(0, y - height * padding);
  const paddedWidth = Math.min(video.videoWidth - paddedX, width * (1 + padding * 2));
  const paddedHeight = Math.min(video.videoHeight - paddedY, height * (1 + padding * 2));

  console.log("📸 [CAPTURE DEBUG] Calculated crop region:", {
    paddedX,
    paddedY,
    paddedWidth,
    paddedHeight,
  });

  // Set canvas size to match cropped region
  canvas.width = paddedWidth;
  canvas.height = paddedHeight;

  // Draw the cropped region from video to canvas
  ctx.drawImage(
    video,
    paddedX,
    paddedY,
    paddedWidth,
    paddedHeight,
    0,
    0,
    paddedWidth,
    paddedHeight
  );

  console.log("📸 [CAPTURE DEBUG] Image drawn to canvas, converting to blob...");

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          console.log("✅ [CAPTURE DEBUG] Blob created:", {
            size: blob.size,
            type: blob.type,
          });
          resolve(blob);
        } else {
          console.error("❌ [CAPTURE DEBUG] Failed to convert canvas to blob");
          reject(new Error("Failed to convert canvas to blob"));
        }
      },
      "image/jpeg",
      0.9 // Quality: 0.9 (90%)
    );
  });
}

