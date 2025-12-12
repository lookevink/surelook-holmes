"use client";

import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useVisualContext } from "../context/VisualContext";
import { updateIdentity } from "../actions/update-identity";

export default function VoiceManager() {
  const { currentFaceRef, subscribe } = useVisualContext();
  const lastReportedRef = useRef<{ id: string; time: number } | null>(null);
  const audioCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const deviceSetupDoneRef = useRef<boolean>(false);

  // CRITICAL: micMuted must be false for audio input to work
  // The SDK manages microphone access internally - do NOT call getUserMedia manually
  const [micMuted, setMicMuted] = useState(false);

  // Device selection state
  const [showDeviceSelector, setShowDeviceSelector] = useState(false);
  const [availableDevices, setAvailableDevices] = useState<{
    inputs: MediaDeviceInfo[];
    outputs: MediaDeviceInfo[];
  }>({ inputs: [], outputs: [] });
  const [selectedInputDeviceId, setSelectedInputDeviceId] = useState<string | null>(null);
  const [selectedOutputDeviceId, setSelectedOutputDeviceId] = useState<string | null>(null);

  const conversation = useConversation({
    micMuted, // Pass micMuted state to SDK - must be false to capture audio
    onConnect: () => {
      console.log("[AUDIO] Connected to ElevenLabs");
      console.log("[AUDIO] Microphone muted state:", micMuted);
      console.log("[AUDIO] Starting audio stream monitoring...");
    },
    onDisconnect: () => {
      console.log("[AUDIO] Disconnected from ElevenLabs");
      if (audioCheckIntervalRef.current) {
        clearInterval(audioCheckIntervalRef.current);
        audioCheckIntervalRef.current = null;
      }
    },
    onMessage: (message) => {
      console.log("[AUDIO] Message received:", message);
    },
    onError: (error) => {
      console.error("[AUDIO] Error:", error);
    },
  });

  // Function to check and log audio stream state
  const checkAudioStreams = useCallback(() => {
    console.log("=== AUDIO STREAM CHECK ===");
    console.log("[AUDIO] micMuted state:", micMuted);
    console.log("[AUDIO] Conversation status:", conversation.status);

    // CRITICAL: Check if SDK is actually receiving audio input
    try {
      const inputVolume = conversation.getInputVolume();
      console.log("[AUDIO] Input volume (0-1):", inputVolume);
      if (inputVolume === 0) {
        console.warn("[AUDIO] ⚠️ WARNING: Input volume is 0 - no audio detected!");
      } else {
        console.log("[AUDIO] ✅ Audio input detected! Volume:", inputVolume);
      }
    } catch (err) {
      console.error("[AUDIO] Could not get input volume:", err);
    }

    // Check input frequency data to see if audio is being captured
    try {
      const frequencyData = conversation.getInputByteFrequencyData();
      if (frequencyData && frequencyData.length > 0) {
        const maxFreq = Math.max(...Array.from(frequencyData));
        console.log("[AUDIO] Input frequency data max:", maxFreq);
        if (maxFreq > 0) {
          console.log("[AUDIO] ✅ Audio frequency data detected!");
        } else {
          console.warn("[AUDIO] ⚠️ WARNING: No audio frequency data detected!");
        }
      }
    } catch (err) {
      console.error("[AUDIO] Could not get frequency data:", err);
    }

    // Check all active media streams in the browser
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      console.log("[AUDIO] Available microphone devices:", audioInputs.length);
      if (audioInputs.length > 0) {
        console.log("[AUDIO] First device:", {
          deviceId: audioInputs[0].deviceId,
          label: audioInputs[0].label,
        });
      }
    });

    // Try to get active tracks (this might not work if SDK manages them internally)
    // But we can at least check permissions
    navigator.permissions
      .query({ name: "microphone" as PermissionName })
      .then((result) => {
        console.log("[AUDIO] Microphone permission state:", result.state);
      })
      .catch((err) => {
        console.log("[AUDIO] Could not check microphone permission:", err);
      });

    // Log conversation object properties for debugging
    const convAny = conversation as Record<string, unknown>;
    if ("micMuted" in convAny) {
      console.log("[AUDIO] SDK micMuted property:", convAny.micMuted);
    }

    console.log("=== END AUDIO CHECK ===");
  }, [micMuted, conversation]);

  const [permissionError, setPermissionError] = useState<boolean>(false);

  // Load available audio devices
  const loadDevices = useCallback(async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs = devices.filter((d) => d.kind === "audioinput");
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      setAvailableDevices({ inputs, outputs });

      // Set default selections if not already set
      if (!selectedInputDeviceId && inputs.length > 0) {
        // Prefer real microphones over virtual ones
        const realMic = inputs.find((d) => {
          const label = d.label.toLowerCase();
          return (
            !label.includes("virtual") &&
            !label.includes("hue sync") &&
            !label.includes("blackhole") &&
            !label.includes("loopback")
          );
        });
        setSelectedInputDeviceId(realMic?.deviceId || inputs[0].deviceId);
      }
      if (!selectedOutputDeviceId && outputs.length > 0) {
        setSelectedOutputDeviceId(outputs[0].deviceId);
      }
    } catch (err) {
      console.error("[AUDIO] Error loading devices:", err);
    }
  }, [selectedInputDeviceId, selectedOutputDeviceId]);

  // Change input device
  const changeInputDevice = useCallback(
    async (deviceId: string) => {
      if (conversation.status !== "connected") {
        console.warn("[AUDIO] Cannot change device: not connected");
        return;
      }

      try {
        const convWithDeviceChange = conversation as typeof conversation & {
          changeInputDevice: (config: {
            inputDeviceId?: string;
            deviceId?: string;
          }) => Promise<void>;
        };

        await convWithDeviceChange.changeInputDevice({
          inputDeviceId: deviceId,
        });
        setSelectedInputDeviceId(deviceId);
        console.log("[AUDIO] ✅ Input device changed to:", deviceId);

        // Verify audio after change
        setTimeout(() => checkAudioStreams(), 500);
      } catch (err) {
        console.error("[AUDIO] ❌ Failed to change input device:", err);
        // Try alternative format
        try {
          const convAlt = conversation as typeof conversation & {
            changeInputDevice: (deviceId: string) => Promise<void>;
          };
          await convAlt.changeInputDevice(deviceId);
          setSelectedInputDeviceId(deviceId);
          console.log("[AUDIO] ✅ Input device changed (alternative format)");
          setTimeout(() => checkAudioStreams(), 500);
        } catch (altErr) {
          console.error("[AUDIO] ❌ Alternative format also failed:", altErr);
        }
      }
    },
    [conversation, checkAudioStreams]
  );

  // Change output device (speaker)
  const changeOutputDevice = useCallback(
    async (deviceId: string) => {
      if (conversation.status !== "connected") {
        console.warn("[AUDIO] Cannot change device: not connected");
        return;
      }

      try {
        const convWithOutputChange = conversation as typeof conversation & {
          changeOutputDevice: (config: {
            outputDeviceId?: string;
            deviceId?: string;
          }) => Promise<void>;
        };

        if (convWithOutputChange.changeOutputDevice) {
          await convWithOutputChange.changeOutputDevice({
            outputDeviceId: deviceId,
          });
          setSelectedOutputDeviceId(deviceId);
          console.log("[AUDIO] ✅ Output device changed to:", deviceId);
        } else {
          console.warn("[AUDIO] changeOutputDevice not available in SDK");
        }
      } catch (err) {
        console.error("[AUDIO] ❌ Failed to change output device:", err);
      }
    },
    [conversation]
  );

  // Set up audio monitoring and device selection on connect
  useEffect(() => {
    if (conversation.status === "connected") {
      console.log(
        "[AUDIO] Connection established. Starting audio checks and device setup..."
      );

      // Check audio immediately on connect
      setTimeout(() => checkAudioStreams(), 500);

      // Set up periodic audio checks every 2 seconds
      audioCheckIntervalRef.current = setInterval(() => {
        checkAudioStreams();
      }, 2000);

      // Set up the correct microphone device after connection is established
      // Only do this once per connection to avoid OverconstrainedError
      if (!deviceSetupDoneRef.current) {
        const setupDevice = async () => {
          try {
            // Get available devices and find a REAL microphone (not virtual)
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter((d) => d.kind === "audioinput");

            // Filter out virtual devices and find a real microphone
            const realMicrophones = audioInputs.filter((d) => {
              const label = d.label.toLowerCase();
              return (
                !label.includes("virtual") &&
                !label.includes("hue sync") &&
                !label.includes("blackhole") &&
                !label.includes("loopback")
              );
            });

            // Use user-selected device if available, otherwise auto-select
            let selectedMic: MediaDeviceInfo | undefined;

            if (selectedInputDeviceId) {
              selectedMic = audioInputs.find(
                (d) => d.deviceId === selectedInputDeviceId
              );
            }

            // Fall back to auto-selection if no user selection
            if (!selectedMic) {
              selectedMic =
                realMicrophones.length > 0
                  ? realMicrophones[0]
                  : audioInputs[0];
            }

            if (
              selectedMic &&
              selectedMic.deviceId &&
              conversation.status === "connected" &&
              !deviceSetupDoneRef.current
            ) {
              deviceSetupDoneRef.current = true; // Mark as done before attempting
              console.log("[AUDIO] Setting input device to:", selectedMic.label);
              console.log("[AUDIO] Device ID:", selectedMic.deviceId);

              // Use the shared changeInputDevice function
              await changeInputDevice(selectedMic.deviceId);
            }
          } catch (err) {
            console.error("[AUDIO] Error setting up device:", err);
            deviceSetupDoneRef.current = false;
          }
        };

        // Wait for WebRTC connection to be fully ready before changing device
        setTimeout(setupDevice, 1000);
      } else {
        console.log("[AUDIO] Device already set up, skipping...");
      }

      return () => {
        if (audioCheckIntervalRef.current) {
          clearInterval(audioCheckIntervalRef.current);
          audioCheckIntervalRef.current = null;
        }
      };
    } else if (conversation.status === "disconnected") {
      // Reset device setup flag when disconnected so we can set it again on reconnect
      deviceSetupDoneRef.current = false;
    }
  }, [
    conversation.status,
    conversation,
    checkAudioStreams,
    selectedInputDeviceId,
    changeInputDevice,
  ]);

  useEffect(() => {
    const unsubscribe = subscribe((context) => {
      if (conversation.status !== "connected") return;
      if (context.found && context.id) {
        const now = Date.now();
        const last = lastReportedRef.current;

        // Notify if it's a new person (by ID) or if it's been > 30 seconds since last report for same person
        const isNewPerson = !last || last.id !== context.id;
        const isTimeForUpdate = last && now - last.time > 30000;
        if (isNewPerson || isTimeForUpdate) {
          console.log("Notifying agent about:", context.name, "ID:", context.id);

          // Check if this is a new contact (name starts with "New Contact" or relationship is "New")
          const isNewContact =
            context.name?.startsWith("New Contact") ||
            context.relationship_status === "New";

          let message: string;
          if (isNewContact && context.id) {
            // For new contacts, inform agent to observe and infer (don't ask questions)
            message =
              `System Update: A new face has been detected. Identity ID: ${context.id}. ` +
              `The identity currently has placeholder name "${context.name}" and status "New". ` +
              `Observe conversations silently and infer the person's name and relationship from context. ` +
              `Use 'update_identity' tool silently when you have high confidence. Do NOT ask the user questions.`;
          } else {
            // For known contacts, just provide the info silently
            message =
              `System Update: The user is looking at ${context.name}. Relationship: ${context.relationship_status || "Unknown"}. ` +
              `Identity ID: ${context.id}. Observe and infer any new information from conversations.`;
          }

          if (conversation.status === "connected") {
            conversation.sendUserMessage(message);
            lastReportedRef.current = { id: context.id, time: now };
          }
        }
      }
    });
    return unsubscribe;
  }, [subscribe, conversation]);

  // Load devices when opening selector
  useEffect(() => {
    if (showDeviceSelector) {
      // Use setTimeout to avoid synchronous setState in effect
      setTimeout(() => {
        loadDevices();
      }, 0);
    }
  }, [showDeviceSelector, loadDevices]);

  const startConversation = useCallback(async () => {
    try {
      setPermissionError(false);

      console.log("[AUDIO] Starting ElevenLabs session...");
      console.log("[AUDIO] Pre-start checks:");

      // Check microphone permission before starting
      try {
        const permissionStatus = await navigator.permissions.query({
          name: "microphone" as PermissionName,
        });
        console.log("[AUDIO] Microphone permission:", permissionStatus.state);
        if (permissionStatus.state === "denied") {
          setPermissionError(true);
          console.error("[AUDIO] Microphone permission denied!");
          return;
        }
      } catch (permErr) {
        console.log(
          "[AUDIO] Could not check permission (may not be supported):",
          permErr
        );
      }

      // CRITICAL: Ensure microphone is unmuted before starting
      // The SDK will handle microphone access - don't call getUserMedia manually
      setMicMuted(false);
      console.log("[AUDIO] Set micMuted to false");

      // Get available devices and find a REAL microphone (not virtual)
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === "audioinput");
      console.log("[AUDIO] Found", audioInputs.length, "audio input devices");

      // Log ALL devices first to see what we have
      console.log("[AUDIO] All audio input devices:");
      audioInputs.forEach((mic, idx) => {
        console.log(
          `[AUDIO]   ${idx + 1}. "${mic.label}" (deviceId: ${mic.deviceId.substring(0, 30)}...)`
        );
      });

      // Filter out virtual devices and find a real microphone
      const realMicrophones = audioInputs.filter((d) => {
        const label = d.label.toLowerCase();
        // Exclude virtual devices - but be less aggressive
        return (
          !label.includes("virtual") &&
          !label.includes("hue sync") &&
          !label.includes("blackhole") &&
          !label.includes("loopback")
        );
      });

      console.log("[AUDIO] Real microphones found:", realMicrophones.length);
      if (realMicrophones.length > 0) {
        realMicrophones.forEach((mic, idx) => {
          console.log(
            `[AUDIO]   ${idx + 1}. ${mic.label} (${mic.deviceId.substring(0, 30)}...)`
          );
        });
      } else {
        console.warn(
          "[AUDIO] ⚠️ No real microphones found after filtering! Using first available device."
        );
        console.log("[AUDIO] Will try to use first device:", audioInputs[0]?.label);
      }
      // Start conversation with your Agent ID
      // The SDK with WebRTC will automatically request microphone access
      // DO NOT call getUserMedia - it interferes with the SDK's microphone handling
      console.log("[AUDIO] Calling conversation.startSession...");
      await conversation.startSession({
        agentId:
          process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ||
          "agent_1501kbp048yeetssw77wfxrrdyee",
        connectionType: "webrtc",
        clientTools: {
          get_visual_context: async () => {
            console.log("Agent requested visual context");
            const context = currentFaceRef.current;
            if (!context) {
              return "I don't see anyone clearly right now.";
            }
            // Return the context as a string or object
            // The Agent will receive this as the tool output
            return JSON.stringify({
              id: context.id,
              name: context.name || "Unknown Person",
              status: context.relationship_status || "Unknown",
              last_seen_seconds_ago:
                (Date.now() - (context.lastSeen || 0)) / 1000,
              is_match: context.found,
            });
          },
          update_identity: async (parameters: {
            identityId: string;
            name?: string;
            relationship_status?: string;
          }) => {
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

      console.log("[AUDIO] Session started successfully.");
      console.log(
        "[AUDIO] Waiting for connection... (device will be set automatically on connect)"
      );

      // Device selection is now handled in the useEffect that watches for connection status
      // This ensures the WebRTC connection is fully ready before changing devices
    } catch (error) {
      console.error("[AUDIO] Failed to start conversation:", error);
      console.error("[AUDIO] Error details:", {
        name: (error as Error).name,
        message: (error as Error).message,
        stack: (error as Error).stack,
      });
      if (
        error instanceof DOMException &&
        (error.name === "NotAllowedError" ||
          error.name === "PermissionDeniedError")
      ) {
        setPermissionError(true);
      }
    }
  }, [conversation, currentFaceRef]);

  const stopConversation = useCallback(async () => {
    console.log("[AUDIO] Stopping conversation...");
    if (audioCheckIntervalRef.current) {
      clearInterval(audioCheckIntervalRef.current);
      audioCheckIntervalRef.current = null;
    }
    await conversation.endSession();
    console.log("[AUDIO] Conversation stopped");
  }, [conversation]);

  return (
    <>
      {/* Device Selector Modal */}
      {showDeviceSelector && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setShowDeviceSelector(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">
                Audio Devices
              </h2>
              <button
                onClick={() => setShowDeviceSelector(false)}
                className="text-zinc-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Microphone Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Microphone
                </label>
                <select
                  value={selectedInputDeviceId || ""}
                  onChange={(e) => {
                    const deviceId = e.target.value;
                    setSelectedInputDeviceId(deviceId);
                    if (conversation.status === "connected") {
                      changeInputDevice(deviceId);
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableDevices.inputs.length === 0 ? (
                    <option value="">No microphones found</option>
                  ) : (
                    availableDevices.inputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Microphone ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Speaker Selection */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Speaker
                </label>
                <select
                  value={selectedOutputDeviceId || ""}
                  onChange={(e) => {
                    const deviceId = e.target.value;
                    setSelectedOutputDeviceId(deviceId);
                    if (conversation.status === "connected") {
                      changeOutputDevice(deviceId);
                    }
                  }}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {availableDevices.outputs.length === 0 ? (
                    <option value="">No speakers found</option>
                  ) : (
                    availableDevices.outputs.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Speaker ${device.deviceId.substring(0, 8)}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="pt-2 border-t border-zinc-700">
                <button
                  onClick={() => {
                    loadDevices();
                  }}
                  className="w-full bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-md text-sm transition-colors"
                >
                  Refresh Devices
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Controls */}
      <div className="fixed bottom-4 right-4 z-50 flex gap-2">
        <div className="flex flex-col items-end gap-2">
          {permissionError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md text-sm mb-2 max-w-xs">
              Microphone access denied. Please allow microphone access in your
              browser settings to use the voice agent.
            </div>
          )}
          <div
            className={`px-3 py-1 rounded-full text-xs font-mono ${
              conversation.status === "connected"
                ? "bg-green-500 text-white"
                : "bg-zinc-200 text-zinc-600"
            }`}
          >
            {conversation.status === "connected"
              ? micMuted
                ? "Mic Muted"
                : "Listening"
              : "Voice Off"}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setShowDeviceSelector(true)}
              className="bg-zinc-700 hover:bg-zinc-600 text-white px-3 py-2 rounded-full shadow-lg transition-all text-sm"
              title="Select Audio Devices"
            >
              🎤🔊
            </button>

            {conversation.status === "connected" ? (
              <button
                onClick={stopConversation}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full shadow-lg transition-all"
              >
                Stop Agent
              </button>
            ) : (
              <button
                onClick={startConversation}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full shadow-lg transition-all"
              >
                {permissionError ? "Retry Permission" : "Start Agent"}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

