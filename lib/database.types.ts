export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      identities: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          relationship_status: string | null;
          face_embedding: number[] | null; // pgvector returns as array
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          name: string;
          relationship_status?: string | null;
          face_embedding?: number[] | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          name?: string;
          relationship_status?: string | null;
          face_embedding?: number[] | null;
          metadata?: Json | null;
        };
      };
      sessions: {
        Row: {
          id: string;
          created_at: string;
          started_at: string;
          ended_at: string | null;
          title: string | null;
          summary: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          started_at?: string;
          ended_at?: string | null;
          title?: string | null;
          summary?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          started_at?: string;
          ended_at?: string | null;
          title?: string | null;
          summary?: string | null;
        };
      };
      events: {
        Row: {
          id: string;
          created_at: string;
          session_id: string | null;
          type: "VISUAL_OBSERVATION" | "CONVERSATION_NOTE" | "AGENT_WHISPER";
          content: string;
          embedding: number[] | null; // pgvector returns as array
          related_identity_id: string | null;
        };
        Insert: {
          id?: string;
          created_at?: string;
          session_id?: string | null;
          type: "VISUAL_OBSERVATION" | "CONVERSATION_NOTE" | "AGENT_WHISPER";
          content: string;
          embedding?: number[] | null;
          related_identity_id?: string | null;
        };
        Update: {
          id?: string;
          created_at?: string;
          session_id?: string | null;
          type?: "VISUAL_OBSERVATION" | "CONVERSATION_NOTE" | "AGENT_WHISPER";
          content?: string;
          embedding?: number[] | null;
          related_identity_id?: string | null;
        };
      };
    };
  };
}

