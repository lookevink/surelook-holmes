"use client";

import { useState, useEffect } from "react";
import SherlockScanner from "./components/SherlockScanner";
import EventStream from "@/components/EventStream";
import VoiceManager from "./components/VoiceManager";
import HighlightedProfile from "@/components/HighlightedProfile";
import IdentitySlider from "@/components/IdentitySlider";
import { useVisualContext } from "./context/VisualContext";
import { getIdentityById } from "@/lib/identities";

interface Identity {
  id: string;
  name: string;
  relationship_status: string | null;
  headshot_media_url: string | null;
  linkedin_url: string | null;
}

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedIdentity, setSelectedIdentity] = useState<Identity | null>(null);
  const { subscribe } = useVisualContext();

  // Subscribe to VisualContext to auto-select matched identities
  useEffect(() => {
    const unsubscribe = subscribe(async (context) => {
      // When a face is matched (found: true) and has an ID, auto-select it
      if (context.found && context.id) {
        try {
          // Fetch full identity data
          const identityData = await getIdentityById(context.id);
          setSelectedIdentity(identityData as Identity);
          // Trigger refresh to update notes
          setRefreshTrigger((prev) => prev + 1);
        } catch (error) {
          console.error("Error fetching matched identity:", error);
        }
      }
    });

    return unsubscribe;
  }, [subscribe]);

  const handleSelectIdentity = (identity: Identity) => {
    setSelectedIdentity(identity);
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="container mx-auto px-4 py-8 max-w-7xl flex-grow">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sure-Look Holmes
          </h1>
          <p className="text-lg text-gray-600">
            Your personal CRM that sees, remembers, and connects.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Face Scanner</h2>
            <SherlockScanner />
          </div>

          <div className="space-y-4">
            <div className="mb-4">
              <HighlightedProfile 
                identityId={selectedIdentity?.id || null} 
                refreshTrigger={refreshTrigger}
              />
            </div>
            {/* <EventStream refreshTrigger={refreshTrigger} /> */}
          </div>
        </div>
        
        <IdentitySlider 
          selectedIdentityId={selectedIdentity?.id || null}
          onSelectIdentity={handleSelectIdentity}
        />
      </main>
      <VoiceManager />
    </div>
  );
}
