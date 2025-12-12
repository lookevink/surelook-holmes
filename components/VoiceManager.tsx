/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useState } from "react";
import { updateIdentity } from "@/app/actions/update-identity";

export default function VoiceManager() {
  const [status, setStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => setStatus("connected"),
    onDisconnect: () => setStatus("disconnected"),
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setErrorMessage(typeof error === "string" ? error : "An error occurred");
      setStatus("disconnected");
    },
    clientTools: {
      update_identity: async (parameters: { identityId: string; name?: string; relationship_status?: string }) => {
        try {
          const result = await updateIdentity(parameters.identityId, {
            name: parameters.name,
            relationship_status: parameters.relationship_status,
          });
          if (result.success) {
            return "Identity updated successfully.";
          } else {
            return "Failed to update identity.";
          }
        } catch {
          return "Error updating identity.";
        }
      },
    },
  });

  const startConversation = useCallback(async () => {
    try {
      const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID;
      if (!agentId) {
        setErrorMessage("Missing NEXT_PUBLIC_ELEVENLABS_AGENT_ID");
        return;
      }

      setStatus("connecting");
      setErrorMessage(null);
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      await conversation.startSession({
        agentId: agentId,
      } as any);
    } catch (error) {
      console.error("Failed to start conversation:", error);
      setErrorMessage("Failed to start conversation. Check console for details.");
      setStatus("disconnected");
    }
  }, [conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {errorMessage && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2">
          {errorMessage}
        </div>
      )}
      
      <div className="flex items-center gap-2 bg-white p-2 rounded-full shadow-lg border border-gray-200">
        <div className={`w-3 h-3 rounded-full ${
          status === "connected" ? "bg-green-500 animate-pulse" : 
          status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-400"
        }`} />
        
        <span className="text-sm font-medium text-gray-700 mr-2">
          {status === "connected" ? "Agent Active" : 
           status === "connecting" ? "Connecting..." : "Agent Offline"}
        </span>

        {status === "connected" ? (
          <button
            onClick={stopConversation}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={startConversation}
            disabled={status === "connecting"}
            className="bg-black hover:bg-gray-800 text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start
          </button>
        )}
      </div>
    </div>
  );
}
