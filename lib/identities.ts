import { supabase } from "./supabase";
import type { Database } from "./database.types";

/**
 * Create a new identity with face embedding
 */
export async function createIdentity(params: {
  name: string;
  relationshipStatus?: string;
  faceEmbedding?: number[];
  metadata?: Record<string, unknown>;
}) {
  const { data, error } = await supabase
    .from("identities")
    .insert({
      name: params.name,
      relationship_status: params.relationshipStatus || null,
      face_embedding: params.faceEmbedding || null,
      metadata: params.metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating identity:", error);
    throw error;
  }

  return data;
}

/**
 * Find identity by face embedding using vector similarity search
 * Returns the most similar identity if similarity is above threshold
 * 
 * Note: Requires the `match_identity_by_face` function to be created in Supabase.
 * Run the SQL from `supabase/schema.sql` in your Supabase SQL editor.
 */
export async function findIdentityByFaceEmbedding(
  embedding: number[],
  threshold: number = 0.7
) {
  try {
    // Use pgvector cosine similarity search
    // The query uses the <=> operator for cosine distance
    // Lower distance = higher similarity
    const { data, error } = await supabase.rpc("match_identity_by_face", {
      query_embedding: embedding,
      match_threshold: threshold,
      match_count: 1,
    });

    if (error) {
      // If the function doesn't exist, return null gracefully
      if (error.code === "42883" || error.message.includes("function")) {
        console.warn(
          "match_identity_by_face function not found. Please run the SQL schema from supabase/schema.sql"
        );
        return null;
      }
      console.error("Error finding identity by face:", error);
      throw error;
    }

    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error("Error in findIdentityByFaceEmbedding:", error);
    return null;
  }
}

/**
 * Get all identities
 */
export async function getIdentities() {
  const { data, error } = await supabase.from("identities").select("*").order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching identities:", error);
    throw error;
  }

  return data;
}

/**
 * Get identity by ID
 */
export async function getIdentityById(id: string) {
  const { data, error } = await supabase.from("identities").select("*").eq("id", id).single();

  if (error) {
    console.error("Error fetching identity:", error);
    throw error;
  }

  return data;
}

