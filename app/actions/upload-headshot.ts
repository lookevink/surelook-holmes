"use server";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase";

/**
 * Upload headshot image to Supabase storage and update identity
 * @param identityId - The identity ID to update
 * @param imageBlob - The image blob to upload
 * @returns The public URL of the uploaded image
 */
export async function uploadHeadshot(
  identityId: string,
  imageBlob: Blob
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    console.log("📤 [UPLOAD DEBUG] Starting upload:", {
      identityId,
      blobSize: imageBlob.size,
      blobType: imageBlob.type,
    });

    // Convert blob to array buffer for Supabase upload
    const arrayBuffer = await imageBlob.arrayBuffer();
    console.log("📤 [UPLOAD DEBUG] Array buffer size:", arrayBuffer.byteLength);
    
    const fileExt = "jpg";
    const fileName = `${identityId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;
    console.log("📤 [UPLOAD DEBUG] File path:", filePath);

    // Upload to Supabase storage bucket "headshots"
    console.log("📤 [UPLOAD DEBUG] Uploading to bucket 'headshots'...");
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("headshots")
      .upload(filePath, arrayBuffer, {
        contentType: "image/jpeg",
        upsert: false, // Don't overwrite existing files
      });

    if (uploadError) {
      console.error("❌ [UPLOAD DEBUG] Upload error:", {
        message: uploadError.message,
        statusCode: uploadError.statusCode,
        error: uploadError,
      });
      return {
        success: false,
        error: uploadError.message,
      };
    }

    console.log("✅ [UPLOAD DEBUG] Upload successful:", uploadData);

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("headshots").getPublicUrl(filePath);
    console.log("📤 [UPLOAD DEBUG] Public URL:", publicUrl);

    // Update identity with headshot URL
    console.log("📤 [UPLOAD DEBUG] Updating identity record...");
    const { error: updateError } = await supabase
      .from("identities")
      .update({ headshot_media_url: publicUrl })
      .eq("id", identityId);

    if (updateError) {
      console.error("❌ [UPLOAD DEBUG] Update error:", {
        message: updateError.message,
        code: updateError.code,
        details: updateError.details,
        hint: updateError.hint,
      });
      // Don't fail completely - the upload succeeded, just the update failed
      return {
        success: true,
        url: publicUrl,
        error: `Upload succeeded but update failed: ${updateError.message}`,
      };
    }

    console.log("✅ [UPLOAD DEBUG] Identity updated successfully");
    return {
      success: true,
      url: publicUrl,
    };
  } catch (error: unknown) {
    console.error("❌ [UPLOAD DEBUG] Unexpected error:", error);
    console.error("❌ [UPLOAD DEBUG] Error stack:", error instanceof Error ? error.stack : "No stack");
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

