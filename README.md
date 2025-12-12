# Sure-Look Holmes

**Your personal CRM that sees, remembers, and connects.**

A multimodal personal CRM designed for wearable integration that uses real-time computer vision to detect faces, identify individuals, and maintain an event stream of interactions.

## Features

- **Real-time Face Detection**: Client-side computer vision using @vladmandic/human
- **Face Recognition**: Biometric embeddings with pgvector similarity search
- **Event Stream**: Chronological log of visual observations and interactions
- **Session Management**: Group events into sessions for better organization

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Vision**: @vladmandic/human v3.3.6 (WebGL/WebGPU accelerated)
- **Database**: Supabase (PostgreSQL with pgvector)
- **Styling**: Tailwind CSS v4

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- A Supabase project (sign up at [supabase.com](https://supabase.com))

### Setup Steps

1. **Install dependencies:**

```bash
pnpm install
```

2. **Set up Supabase:**

   - Create a new project at [supabase.com](https://supabase.com)
   - Go to SQL Editor and run the contents of `supabase/schema.sql`
   - This creates the tables and the `match_identity_by_face` function

3. **Configure environment variables:**

   - Copy `.env.local.example` to `.env.local`
   - Fill in your Supabase credentials:
     ```bash
     NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
   - Get these from your Supabase project settings: Settings → API

4. **Seed the database:**

```bash
pnpm seed
```

This creates a default "Presenter" identity and initial session.

5. **Start the development server:**

```bash
pnpm dev
```

6. **Open your browser:**

   - Navigate to [http://localhost:3000](http://localhost:3000)
   - Grant camera permissions when prompted
   - Click "Start Scanning" to begin face detection

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main page with scanner and event stream
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── FaceScanner.tsx   # Face detection component
│   └── EventStream.tsx   # Event display component
├── lib/                   # Utility functions
│   ├── supabase.ts       # Supabase client
│   ├── database.types.ts # TypeScript types for database
│   ├── events.ts         # Event CRUD operations
│   └── identities.ts     # Identity CRUD operations
├── scripts/               # Utility scripts
│   └── seed.ts           # Database seeding script
└── supabase/             # Database schema
    └── schema.sql        # SQL schema and functions
```

## Development

### Available Scripts

- `pnpm dev` - Start development server (with webpack)
- `pnpm build` - Build for production (with webpack)
- `pnpm start` - Start production server
- `pnpm lint` - Run ESLint
- `pnpm seed` - Seed database with initial data

### Important Notes

- **Always use `--webpack` flag**: The project uses webpack instead of Turbopack due to @vladmandic/human compatibility
- **Camera permissions**: The app requires camera access for face detection
- **Database function**: Make sure you've run `supabase/schema.sql` to create the `match_identity_by_face` function

## Architecture

### Face Detection Flow

1. User grants camera permission
2. Video stream is captured and processed frame-by-frame
3. @vladmandic/human detects faces and extracts embeddings
4. Embeddings are compared against stored identities using pgvector
5. Events are created for new or recognized faces
6. Events are displayed in real-time in the Event Stream

### Database Schema

- **identities**: Stores people with face embeddings (1024-dim vectors)
- **sessions**: Groups events into interactions/meetings
- **events**: Chronological log of VISUAL_OBSERVATION, CONVERSATION_NOTE, and AGENT_WHISPER events

See `supabase/schema.sql` for the complete schema.

## Next Steps

- [ ] Integrate GPT-4o for visual reasoning and context
- [ ] Add ElevenLabs voice integration for audio feedback
- [ ] Implement "Chief of Staff" persona system prompt
- [ ] Add real-time updates with Supabase Realtime
- [ ] Create identity management UI
- [ ] Add conversation note capture

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [@vladmandic/human](https://github.com/vladmandic/human)
- [Supabase Documentation](https://supabase.com/docs)
- [pgvector](https://github.com/pgvector/pgvector)
