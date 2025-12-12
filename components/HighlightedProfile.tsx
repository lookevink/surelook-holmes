"use client";

import { useEffect, useState } from "react";
import { getEvents } from "@/lib/events";
import { getIdentityById } from "@/lib/identities";
import type { Database } from "@/lib/database.types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface Identity {
  id: string;
  name: string;
  relationship_status: string | null;
  headshot_media_url: string | null;
  linkedin_url: string | null;
}

interface HighlightedProfileProps {
  identityId: string | null;
  refreshTrigger?: number;
}

export default function HighlightedProfile({ identityId, refreshTrigger }: HighlightedProfileProps) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [notes, setNotes] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identityId) {
      setIdentity(null);
      setNotes([]);
      return;
    }

    const fetchProfileAndNotes = async () => {
      setLoading(true);
      try {
        // Fetch identity details
        const identityData = await getIdentityById(identityId);
        setIdentity(identityData as Identity);

        // Fetch NOTES events for this identity
        const eventsData = await getEvents({ identityId, limit: 50 });
        const notesEvents = (eventsData || []).filter(
          (event) => event.type === "NOTES"
        );
        setNotes(notesEvents);
      } catch (error) {
        console.error("Error fetching profile and notes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileAndNotes();
  }, [identityId, refreshTrigger]);

  if (!identityId || !identity) {
    return null;
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Highlighted Profile</h3>
      
      {/* Profile Card */}
      <div className="flex items-start gap-4 mb-6 pb-6 border-b border-gray-200">
        <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-200 border-2 border-gray-300 flex-shrink-0">
          {identity.headshot_media_url ? (
            <img
              src={identity.headshot_media_url}
              alt={identity.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-gray-400">
              {identity.name.charAt(0)}
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 text-lg mb-1">{identity.name}</h4>
          
          {identity.relationship_status && (
            <p className="text-sm text-gray-600 mb-2">{identity.relationship_status}</p>
          )}

          {identity.linkedin_url && (
            <a
              href={identity.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 inline-flex"
            >
              <span>View LinkedIn</span>
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Notes Section */}
      <div>
        <h4 className="text-md font-semibold mb-3 text-gray-800">Notes</h4>
        {loading ? (
          <div className="text-sm text-gray-500">Loading notes...</div>
        ) : notes.length === 0 ? (
          <div className="text-sm text-gray-500 italic">No notes yet.</div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded border bg-yellow-50 border-yellow-200"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className="text-xs font-semibold text-yellow-800">
                    📝 Note
                  </span>
                  <span className="text-xs text-gray-600">
                    {formatTime(note.created_at)}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

