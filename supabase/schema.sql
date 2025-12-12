-- Enable the pgvector extension to work with embedding vectors
create extension if not exists vector;

-- Create a table to store identities (people we meet)
create table identities (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  name text not null,
  relationship_status text, -- e.g., "Co-worker", "Investor", "Friend"
  face_embedding vector(1024), -- 1024-dimensional vector for face embeddings
  headshot_media_url text, -- URL to headshot image in Supabase storage
  linkedin_url text, -- LinkedIn profile URL
  metadata jsonb default '{}'::jsonb -- Flexible field for extra details (LinkedIn, Twitter, etc.)
);

-- Create a table to track sessions (interactions/meetings)
create table sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  title text, -- Auto-generated title like "Coffee with Sam"
  summary text -- LLM-generated summary of the interaction
);

-- Create a table for the event stream (chronological log)
create table events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  session_id uuid references sessions(id),
  type text not null check (type in ('VISUAL_OBSERVATION', 'CONVERSATION_NOTE', 'AGENT_WHISPER')),
  content text not null, -- The actual text content
  embedding vector(1536), -- Optional: Embedding of the text content for semantic search
  related_identity_id uuid references identities(id) -- Link to a specific person if relevant
);

-- Create an index on face_embedding for faster similarity searches
create index if not exists identities_face_embedding_idx on identities 
using ivfflat (face_embedding vector_cosine_ops)
with (lists = 100);

-- Create a function to match identities by face embedding using cosine similarity
-- This function uses pgvector's cosine distance operator (<=>)
create or replace function match_identity_by_face(
  query_embedding vector(1024),
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  name text,
  relationship_status text,
  face_embedding vector(1024),
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    identities.id,
    identities.name,
    identities.relationship_status,
    identities.face_embedding,
    identities.metadata,
    1 - (identities.face_embedding <=> query_embedding) as similarity
  from identities
  where identities.face_embedding is not null
    and 1 - (identities.face_embedding <=> query_embedding) > match_threshold
  order by identities.face_embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Create indexes for better query performance
create index if not exists events_session_id_idx on events(session_id);
create index if not exists events_created_at_idx on events(created_at desc);
create index if not exists events_related_identity_id_idx on events(related_identity_id);
create index if not exists sessions_started_at_idx on sessions(started_at desc);

-- IMPORTANT: Create the "headshots" storage bucket in Supabase Dashboard
-- 1. Go to Storage in your Supabase dashboard
-- 2. Click "New bucket"
-- 3. Name it "headshots"
-- 4. Make it public (or configure RLS policies as needed)
-- 5. Save

