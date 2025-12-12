"use client";

import { useState } from "react";
import SherlockScanner from "./components/SherlockScanner";
import EventStream from "@/components/EventStream";
import VoiceManager from "./components/VoiceManager";

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEventCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Sure-Look Holmes
          </h1>
          <p className="text-lg text-gray-600">
            Your personal CRM that sees, remembers, and connects.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Face Scanner</h2>
            <SherlockScanner />
          </div>

          <div className="space-y-4">
            <EventStream refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </main>
      <VoiceManager />
    </div>
  );
}
