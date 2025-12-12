/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from "react";
import { getIdentities } from "@/lib/identities";
import Image from "next/image";

interface Identity {
  id: string;
  name: string;
  relationship_status: string | null;
  headshot_media_url: string | null;
  linkedin_url: string | null;
}

export default function IdentitySlider() {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchIdentities = async () => {
      try {
        const data = await getIdentities();
        if (data) {
          // Filter for identities that have a headshot or linkedin url
          // casting to any because the type definition might not be fully updated in the library return type yet
          // although we updated the insert, the select return type comes from database.types.ts which was updated.
          // However, to be safe and avoid type errors if the generated types aren't perfectly aligned:
          const validIdentities = data.filter(
            (id: any) => id.headshot_media_url || id.linkedin_url
          );
          setIdentities(validIdentities as Identity[]);
        }
      } catch (error) {
        console.error("Failed to fetch identities", error);
      } finally {
        setLoading(false);
      }
    };

    fetchIdentities();
  }, []);

  if (loading) {
    return <div className="h-32 flex items-center justify-center text-gray-500">Loading profiles...</div>;
  }

  if (identities.length === 0) {
    return null;
  }

  return (
    <div className="w-full py-6 bg-white border-t border-gray-200">
      <div className="container mx-auto px-4">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Network</h3>
        <div className="flex overflow-x-auto gap-4 pb-4 scrollbar-hide snap-x">
          {identities.map((identity) => (
            <div
              key={identity.id}
              className="flex-none w-48 bg-gray-50 rounded-lg border border-gray-200 p-3 flex flex-col items-center snap-start hover:shadow-md transition-shadow"
            >
              <div className="relative w-24 h-24 mb-3 rounded-full overflow-hidden bg-gray-200 border-2 border-white shadow-sm">
                {identity.headshot_media_url ? (
                  <img
                    src={identity.headshot_media_url}
                    alt={identity.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-gray-400">
                    {identity.name.charAt(0)}
                  </div>
                )}
              </div>
              
              <h4 className="font-medium text-gray-900 text-center truncate w-full" title={identity.name}>
                {identity.name}
              </h4>
              
              {identity.relationship_status && (
                <p className="text-xs text-gray-500 mb-2 truncate w-full text-center">
                  {identity.relationship_status}
                </p>
              )}

              {identity.linkedin_url && (
                <a
                  href={identity.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                >
                  <span>View LinkedIn</span>
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                  </svg>
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
