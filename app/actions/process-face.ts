"use server";

import { supabase } from "@/lib/supabase";
import { createIdentity } from "@/lib/identities";
import { createEvent, getOrCreateActiveSession } from "@/lib/events";

export interface FaceDetectionResult {
  found: boolean;
  id?: string;
  name?: string;
  relationship_status?: string;
  similarity?: number;
  message: string;
}

/**
 * Server action to process face detection
 * 
 * 1. Matches face embedding against existing identities
 * 2. If match found: Creates VISUAL_OBSERVATION event
 * 3. If no match: Auto-creates new identity and logs first sighting
 */
export async function processFaceDetection(
  embedding: number[]
): Promise<FaceDetectionResult> {
  try {
    // Get or create active session
    const session = await getOrCreateActiveSession();

    // Match face against existing identities
    // Using threshold 0.5 as mentioned in implementation log
    const { data: matches, error: matchError } = await supabase.rpc(
      "match_identity_by_face",
      {
        query_embedding: embedding as any,
        match_threshold: 0.5,
        match_count: 1,
      }
    ) as { data: any; error: any };

    if (matchError) {
      console.error("Error matching face:", matchError);
      return {
        found: false,
        message: `Error matching face: ${matchError.message}`,
      };
    }

    // Check if we found a match
    if (matches && matches.length > 0 && matches[0].similarity >= 0.5) {
      const match = matches[0];
      
      // Create VISUAL_OBSERVATION event
      await createEvent({
        sessionId: session.id,
        type: "VISUAL_OBSERVATION",
        content: `Sighted ${match.name}${match.relationship_status ? ` (${match.relationship_status})` : ""}`,
        relatedIdentityId: match.id,
      });

      return {
        found: true,
        id: match.id,
        name: match.name,
        relationship_status: match.relationship_status || undefined,
        similarity: match.similarity,
        message: `Recognized: ${match.name}${match.relationship_status ? ` (${match.relationship_status})` : ""}`,
      };
    }

    // No match found - auto-create new identity
    const timeString = new Date().toLocaleTimeString();
    const newIdentityName = `New Contact ${timeString}`;

    try {
      const newIdentity = await createIdentity({
        name: newIdentityName,
        relationshipStatus: "New",
        faceEmbedding: embedding,
        metadata: {
          created_via: "visual_scan",
        },
      });

      // Log first sighting event
      await createEvent({
        sessionId: session.id,
        type: "VISUAL_OBSERVATION",
        content: `First sighting of ${newIdentityName}`,
        relatedIdentityId: newIdentity.id,
      });

      return {
        found: false,
        id: newIdentity.id,
        name: newIdentityName,
        relationship_status: "New",
        similarity: 1.0, // New identity, so similarity is 1.0
        message: `New contact detected: ${newIdentityName}`,
      };
    } catch (createError: any) {
      console.error("Error creating new identity:", createError);
      return {
        found: false,
        message: "Error creating new contact",
      };
    }
  } catch (error: any) {
    console.error("Error in processFaceDetection:", error);
    return {
      found: false,
      message: `Error processing face: ${error.message || "Unknown error"}`,
    };
  }
}
