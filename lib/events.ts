import { supabase } from "./supabase";
import type { Database } from "./database.types";

type EventType = Database["public"]["Tables"]["events"]["Row"]["type"];

export interface CreateEventParams {
  sessionId?: string | null;
  type: EventType;
  content: string;
  relatedIdentityId?: string | null;
}

/**
 * Create a new event in the event stream
 */
export async function createEvent(params: CreateEventParams) {
  const { data, error } = await supabase
    .from("events")
    .insert({
      session_id: params.sessionId,
      type: params.type,
      content: params.content,
      related_identity_id: params.relatedIdentityId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating event:", error);
    throw error;
  }

  return data;
}

/**
 * Get all events, optionally filtered by session or identity
 */
export async function getEvents(options?: {
  sessionId?: string;
  identityId?: string;
  limit?: number;
}) {
  let query = supabase.from("events").select("*").order("created_at", { ascending: false });

  if (options?.sessionId) {
    query = query.eq("session_id", options.sessionId);
  }

  if (options?.identityId) {
    query = query.eq("related_identity_id", options.identityId);
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching events:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new session
 */
export async function createSession(title?: string) {
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      started_at: new Date().toISOString(),
      title: title || null,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating session:", error);
    throw error;
  }

  return data;
}

/**
 * Get the current active session or create a new one
 */
export async function getOrCreateActiveSession() {
  // Try to find an active session (no ended_at)
  const { data: activeSession } = await supabase
    .from("sessions")
    .select("*")
    .is("ended_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .single();

  if (activeSession) {
    return activeSession;
  }

  // Create a new session if none exists
  return createSession();
}

