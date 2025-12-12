/**
 * Utility functions for generating face embeddings from images
 */

/**
 * Generate face embedding from an image URL
 * Downloads the image and processes it to extract face embedding
 * @param imageUrl - URL to the image
 * @returns Promise resolving to face embedding array (1024 dimensions) or null if no face found
 */
export async function generateFaceEmbeddingFromUrl(
  imageUrl: string
): Promise<number[] | null> {
  try {
    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image from ${imageUrl}: ${response.statusText}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Use @vladmandic/human to detect face and generate embedding
    // Note: This requires @vladmandic/human to work in Node.js environment
    // We'll use dynamic import to handle potential browser-only dependencies
    const { Human } = await import("@vladmandic/human");
    const tf = await import("@tensorflow/tfjs-node");
    
    // Initialize TensorFlow.js backend for Node.js
    await tf.ready;
    
    const human = new Human({
      backend: "cpu", // Use CPU backend for server-side
      modelBasePath: "https://unpkg.com/@vladmandic/human/models/",
      face: {
        enabled: true,
        detector: { 
          enabled: true,
          minConfidence: 0.5,
        },
        description: { enabled: true }, // This generates the embedding
      },
    });

    // Decode image to tensor
    const imageTensor = tf.node.decodeImage(buffer, 3); // 3 channels (RGB)
    
    // Ensure tensor is in the right shape (height, width, channels)
    const resized = tf.image.resizeBilinear(imageTensor, [224, 224]);
    const normalized = resized.div(255.0);
    const expanded = normalized.expandDims(0); // Add batch dimension

    // Run face detection
    const result = await human.detect(expanded as any);

    // Clean up tensors
    imageTensor.dispose();
    resized.dispose();
    normalized.dispose();
    expanded.dispose();

    // Check if face was detected
    if (!result.face || result.face.length === 0) {
      console.warn(`No face detected in image: ${imageUrl}`);
      return null;
    }

    // Get the first face's embedding
    const face = result.face[0];
    if (!face.embedding || face.embedding.length === 0) {
      console.warn(`No embedding generated for face in image: ${imageUrl}`);
      return null;
    }

    // Convert embedding to regular array
    // The embedding might be a TypedArray or regular array
    let embedding: number[];
    if (face.embedding instanceof Array) {
      embedding = face.embedding;
    } else if (face.embedding instanceof Float32Array || face.embedding instanceof ArrayBuffer) {
      embedding = Array.from(face.embedding as Float32Array);
    } else {
      // Try to convert to array
      embedding = Array.from(face.embedding as any);
    }
    
    // Ensure it's 1024 dimensions (pad or truncate if needed)
    if (embedding.length !== 1024) {
      console.warn(
        `Embedding dimension mismatch: expected 1024, got ${embedding.length} for ${imageUrl}`
      );
      // Pad with zeros or truncate to match expected dimension
      if (embedding.length < 1024) {
        embedding.push(...new Array(1024 - embedding.length).fill(0));
      } else {
        embedding.splice(1024);
      }
    }

    return embedding;
  } catch (error) {
    console.error(`Error generating face embedding from ${imageUrl}:`, error);
    return null;
  }
}

