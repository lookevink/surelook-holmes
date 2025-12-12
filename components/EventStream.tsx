"use client";

import { useEffect, useState } from "react";
import { getEvents } from "@/lib/events";
import type { Database } from "@/lib/database.types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface EventStreamProps {
  refreshTrigger?: number;
}

export default function EventStream({ refreshTrigger }: EventStreamProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await getEvents({ limit: 50 });
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [refreshTrigger]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getEventTypeColor = (type: Event["type"]) => {
    switch (type) {
      case "VISUAL_OBSERVATION":
        return "bg-blue-100 border-blue-300 text-blue-800";
      case "CONVERSATION_NOTE":
        return "bg-green-100 border-green-300 text-green-800";
      case "AGENT_WHISPER":
        return "bg-purple-100 border-purple-300 text-purple-800";
      default:
        return "bg-gray-100 border-gray-300 text-gray-800";
    }
  };

  const getEventTypeLabel = (type: Event["type"]) => {
    switch (type) {
      case "VISUAL_OBSERVATION":
        return "👁️ Visual";
      case "CONVERSATION_NOTE":
        return "💬 Conversation";
      case "AGENT_WHISPER":
        return "🤫 Agent";
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">
        Loading events...
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold mb-4">Event Stream</h2>
      {events.length === 0 ? (
        <div className="p-4 text-center text-gray-500 border border-gray-200 rounded">
          No events yet. Start scanning to detect faces and create events.
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {events.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded border ${getEventTypeColor(event.type)}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold">
                      {getEventTypeLabel(event.type)}
                    </span>
                    <span className="text-xs text-gray-600">
                      {formatTime(event.created_at)}
                    </span>
                  </div>
                  <p className="text-sm">{event.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

