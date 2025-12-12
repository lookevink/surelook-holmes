/* eslint-disable @typescript-eslint/no-explicit-any */
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
    console.log(`[FACE-EMBEDDING] Starting embedding generation for: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[FACE-EMBEDDING] Failed to fetch image from ${imageUrl}: ${response.statusText} (${response.status})`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log(`[FACE-EMBEDDING] Downloaded image, size: ${buffer.length} bytes`);

    // Use @vladmandic/human to detect face and generate embedding
    // Import TensorFlow.js Node.js backend first
    // IMPORTANT: Import @tensorflow/tfjs-node which automatically registers the tensorflow backend
    const tf = await import("@tensorflow/tfjs-node");

    // Explicitly set backend to tensorflow before any operations
    // This is required for tf.node.decodeImage to work
    console.log(`[FACE-EMBEDDING] Setting TensorFlow backend...`);
    await tf.setBackend("tensorflow");
    await tf.ready;

    const backend = tf.getBackend();
    console.log(`[FACE-EMBEDDING] TensorFlow.js backend ready: ${backend}`);

    if (backend !== "tensorflow") {
      throw new Error(`Failed to set TensorFlow backend. Current backend: ${backend}`);
    }

    // Decode image to tensor FIRST (before initializing Human.js)
    // This requires TensorFlow backend
    console.log(`[FACE-EMBEDDING] Decoding image to tensor...`);
    const imageTensor = tf.node.decodeImage(buffer, 3); // 3 channels (RGB)
    console.log(`[FACE-EMBEDDING] Image tensor shape:`, imageTensor.shape);

    // Now import Human.js - use default import
    const HumanModule = await import("@vladmandic/human");
    const HumanLibrary = HumanModule.default || HumanModule.Human || (HumanModule as any).Human;

    if (!HumanLibrary) {
      imageTensor.dispose();
      throw new Error("Could not import Human library");
    }

    // Use tensorflow backend for Human.js since we're using TensorFlow tensors
    const human = new HumanLibrary({
      backend: "tensorflow", // Use tensorflow backend to work with TensorFlow tensors
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

    // Warmup the model (important for first use)
    console.log(`[FACE-EMBEDDING] Warming up Human model...`);
    await human.warmup();
    console.log(`[FACE-EMBEDDING] Human model warmed up`);

    // Human.js detect method can accept tensors directly
    // Pass the tensor as-is (it should accept tf.Tensor3D)
    console.log(`[FACE-EMBEDDING] Running face detection...`);
    const result = await human.detect(imageTensor);

    // Clean up tensor
    imageTensor.dispose();
    console.log(`[FACE-EMBEDDING] Detection result:`, {
      facesFound: result.face?.length || 0,
      hasEmbedding: result.face?.[0]?.embedding ? true : false,
    });

    // Check if face was detected
    if (!result.face || result.face.length === 0) {
      console.warn(`[FACE-EMBEDDING] No face detected in image: ${imageUrl}`);
      return null;
    }

    // Get the first face's embedding
    const face = result.face[0];
    if (!face.embedding || face.embedding.length === 0) {
      console.warn(`[FACE-EMBEDDING] No embedding generated for face in image: ${imageUrl}`);
      return null;
    }

    // Convert embedding to regular array
    // The embedding might be a TypedArray or regular array
    let embedding: number[];
    if (Array.isArray(face.embedding)) {
      embedding = face.embedding;
    } else if ((face.embedding as any) instanceof Float32Array) {
      embedding = Array.from(face.embedding);
    } else if ((face.embedding as any) instanceof ArrayBuffer) {
      embedding = Array.from(new Float32Array(face.embedding as any));
    } else {
      // Try to convert to array - might be a tensor
      try {
        const embeddingData = await (face.embedding as any).data();
        embedding = Array.from(embeddingData);
      } catch {
        // Last resort: try Array.from
        embedding = Array.from(face.embedding as any);
      }
    }

    console.log(`[FACE-EMBEDDING] Embedding generated, length: ${embedding.length}`);

    // Ensure it's 1024 dimensions (pad or truncate if needed)
    if (embedding.length !== 1024) {
      console.warn(
        `[FACE-EMBEDDING] Embedding dimension mismatch: expected 1024, got ${embedding.length} for ${imageUrl}`
      );
      // Pad with zeros or truncate to match expected dimension
      if (embedding.length < 1024) {
        embedding.push(...new Array(1024 - embedding.length).fill(0));
      } else {
        embedding.splice(1024);
      }
    }

    console.log(`[FACE-EMBEDDING] Successfully generated embedding for: ${imageUrl}`);
    return embedding;
  } catch (error) {
    console.error(`[FACE-EMBEDDING] Error generating face embedding from ${imageUrl}:`, error);
    if (error instanceof Error) {
      console.error(`[FACE-EMBEDDING] Error stack:`, error.stack);
    }
    return null;
  }
}

