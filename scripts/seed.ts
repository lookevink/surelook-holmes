import { createIdentity } from "../lib/identities";
import { createSession, createEvent } from "../lib/events";

/**
 * Seed script to create initial data for testing
 * 
 * Run with: pnpm seed
 * 
 * Make sure you have NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
 * set in your .env.local file
 */

async function seed() {
  console.log("🌱 Starting seed...");

  try {
    // Create a default "Presenter" identity
    // Note: In a real scenario, you would have an actual face embedding
    // For now, we'll create an identity without an embedding
    console.log("Creating default identity...");
    const presenter = await createIdentity({
      name: "Presenter",
      relationshipStatus: "Self",
      metadata: {
        note: "Default identity for the presenter/demo",
      },
    });
    console.log("✅ Created identity:", presenter.id, presenter.name);

    // Create an initial session
    console.log("Creating initial session...");
    const session = await createSession("Initial Demo Session");
    console.log("✅ Created session:", session.id);

    // Create a sample event
    console.log("Creating sample event...");
    const event = await createEvent({
      sessionId: session.id,
      type: "VISUAL_OBSERVATION",
      content: "System initialized. Ready to scan faces.",
      relatedIdentityId: null,
    });
    console.log("✅ Created event:", event.id);

    console.log("\n✨ Seed completed successfully!");
    console.log("\nNext steps:");
    console.log("1. Start the dev server: pnpm dev");
    console.log("2. Grant camera permissions when prompted");
    console.log("3. Click 'Start Scanning' to begin face detection");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seed();

