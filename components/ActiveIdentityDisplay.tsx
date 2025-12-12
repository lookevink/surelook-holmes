"use client";

import { useEffect, useState } from "react";
import { getIdentityById } from "@/lib/identities";
import { getEvents } from "@/lib/events";

interface ActiveIdentityDisplayProps {
  identityId: string | null;
}

interface IdentityDetails {
  id: string;
  name: string;
  relationship_status: string | null;
  headshot_media_url: string | null;
  linkedin_url: string | null;
}

interface NoteEvent {
  id: string;
  content: string;
  created_at: string;
  type: string;
}

export default function ActiveIdentityDisplay({ identityId }: ActiveIdentityDisplayProps) {
  const [identity, setIdentity] = useState<IdentityDetails | null>(null);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!identityId) {
      setIdentity(null);
      setNotes([]);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch identity details
        const identityData = await getIdentityById(identityId);
        if (identityData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setIdentity(identityData as any); 
        }

        // Fetch recent notes/events for this identity
        const eventsData = await getEvents({ identityId, limit: 5 });
        if (eventsData) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setNotes(eventsData as any);
        }
      } catch (error) {
        console.error("Error fetching active identity data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [identityId]);

  if (!identityId || !identity) {
    return null;
  }

  return (
    <div className="w-full bg-white border-t border-gray-200 shadow-lg transform transition-all duration-300 ease-in-out">
      <div className="container mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-6 items-start">
          {/* Identity Profile */}
          <div className="flex-shrink-0 flex flex-col items-center md:items-start space-y-3">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gray-100 border-4 border-blue-100 shadow-md">
              {identity.headshot_media_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={identity.headshot_media_url}
                  alt={identity.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-400 bg-gray-200">
                  {identity.name.charAt(0)}
                </div>
              )}
            </div>
            
            <div className="text-center md:text-left">
              <h2 className="text-2xl font-bold text-gray-900">{identity.name}</h2>
              {identity.relationship_status && (
                <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full mt-1">
                  {identity.relationship_status}
                </span>
              )}
              {identity.linkedin_url && (
                <a
                  href={identity.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block mt-2 text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View LinkedIn Profile
                </a>
              )}
            </div>
          </div>

          {/* Notes & Context */}
          <div className="flex-grow w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Recent Notes & Interactions
            </h3>
            
            <div className="space-y-3 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {notes.length > 0 ? (
                notes.map((note) => (
                  <div key={note.id} className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                    <p className="text-gray-800">{note.content}</p>
                    <span className="text-xs text-gray-400 mt-1 block">
                      {new Date(note.created_at).toLocaleString()} • {note.type}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 italic text-sm">No recent notes found for this contact.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
