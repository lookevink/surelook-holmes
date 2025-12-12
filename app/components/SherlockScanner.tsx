"use client";

import { useEffect, useRef, useState } from "react";
import type { Human, Config, Result } from "@vladmandic/human";
import { processFaceDetection } from "../actions/process-face";
import { uploadHeadshot } from "../actions/upload-headshot";
import { useVisualContext } from "../context/VisualContext";
import { extractFaceImage } from "@/lib/face-capture";

const humanConfig: Partial<Config> = {
  // We want to run client-side
  backend: "webgl",
  modelBasePath: "https://unpkg.com/@vladmandic/human/models/",
  face: {
    enabled: true,
    detector: { enabled: true },
    mesh: { enabled: false },
    iris: { enabled: false },
    description: { enabled: true },
    emotion: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: true },
  gesture: { enabled: true },
};

export default function SherlockScanner() {
  const { updateVisualContext } = useVisualContext();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [human, setHuman] = useState<Human | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const lastProcessedRef = useRef<number>(0);
  const capturedHeadshotsRef = useRef<Set<string>>(new Set()); // Track which identities already have headshots
  const PROCESSING_INTERVAL_MS = 2000; // Process every 2 seconds

  // Initialize Human
  useEffect(() => {
    let instance: Human;

    const initHuman = async () => {
      // Dynamic import to avoid SSR issues
      // Default import should resolve to browser version for client-side code
      const HumanLibrary = (await import("@vladmandic/human")).default;
      instance = new HumanLibrary(humanConfig);
      setHuman(instance);
      setStatus("Human AI ready. Waiting for camera...");
      // Warmup
      await instance.warmup();
      setIsReady(true);
    };

    initHuman();
  }, []);

  // WebCam and Detection Loop
  useEffect(() => {
    if (!human || !isReady || !videoRef.current || !canvasRef.current) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            setStatus("Sherlock is watching...");
            requestAnimationFrame(detect);
          };
        }
      } catch (err) {
        console.error("Camera error:", err);
        setStatus("Camera access denied.");
      }
    };

    const detect = async () => {
      if (!human || !videoRef.current || !canvasRef.current) return;

      // Perform detection
      const result: Result = await human.detect(videoRef.current);

      // Draw results (simple overlay)
      if (human.draw) {
        const canvas = canvasRef.current;
        const video = videoRef.current;

        if (canvas.width !== video.videoWidth) canvas.width = video.videoWidth;
        if (canvas.height !== video.videoHeight) canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          // Draw overlay using built-in draw method
          await human.draw.all(canvas, result);
        }
      }

      // Process Face Detection
      if (result.face && result.face.length > 0) {
        const now = Date.now();
        if (now - lastProcessedRef.current > PROCESSING_INTERVAL_MS) {
          const face = result.face[0];
          if (face.embedding && face.box) {
            lastProcessedRef.current = now;
            setStatus("Processing face...");

            // Call Server Action
            processFaceDetection(Array.from(face.embedding))
              .then(async (res) => {
                setStatus(res.message);
                console.log("🔍 [HEADSHOT DEBUG] Identity Result:", {
                  found: res.found,
                  id: res.id,
                  name: res.name,
                  message: res.message,
                });
                
                // UPDATE CONTEXT HERE
                updateVisualContext({
                  ...res,
                  lastSeen: Date.now(),
                });

                // Capture and upload headshot for new faces
                console.log("🔍 [HEADSHOT DEBUG] Checking conditions:", {
                  "!res.found": !res.found,
                  "res.id exists": !!res.id,
                  "already captured": capturedHeadshotsRef.current.has(res.id || ""),
                  "face.box exists": !!face.box,
                  "video ready": !!videoRef.current && videoRef.current.readyState >= 2,
                });

                if (!res.found && res.id && !capturedHeadshotsRef.current.has(res.id)) {
                  console.log("✅ [HEADSHOT DEBUG] Conditions met! Starting headshot capture...");
                  
                  if (!face.box) {
                    console.error("❌ [HEADSHOT DEBUG] face.box is missing!");
                    return;
                  }

                  if (!videoRef.current) {
                    console.error("❌ [HEADSHOT DEBUG] videoRef.current is null!");
                    return;
                  }

                  try {
                    // Mark as captured immediately to prevent duplicate uploads
                    capturedHeadshotsRef.current.add(res.id);
                    console.log("📸 [HEADSHOT DEBUG] Marked as captured, extracting face image...");
                    
                    setStatus("Capturing headshot...");
                    
                    // Extract face image from video
                    console.log("📸 [HEADSHOT DEBUG] Face box:", face.box);
                    const faceBlob = await extractFaceImage(
                      videoRef.current,
                      face.box as [number, number, number, number]
                    );
                    console.log("📸 [HEADSHOT DEBUG] Face blob extracted:", {
                      size: faceBlob.size,
                      type: faceBlob.type,
                    });
                    
                    // Upload to Supabase storage
                    console.log("📤 [HEADSHOT DEBUG] Uploading to Supabase...");
                    const uploadResult = await uploadHeadshot(res.id, faceBlob);
                    console.log("📤 [HEADSHOT DEBUG] Upload result:", uploadResult);
                    
                    if (uploadResult.success) {
                      console.log("✅ [HEADSHOT DEBUG] Headshot uploaded successfully:", uploadResult.url);
                      setStatus(`${res.message} (Headshot saved)`);
                    } else {
                      console.error("❌ [HEADSHOT DEBUG] Failed to upload headshot:", uploadResult.error);
                      // Remove from captured set so we can retry later
                      capturedHeadshotsRef.current.delete(res.id);
                    }
                  } catch (captureError) {
                    console.error("❌ [HEADSHOT DEBUG] Error capturing headshot:", captureError);
                    console.error("❌ [HEADSHOT DEBUG] Error stack:", captureError instanceof Error ? captureError.stack : "No stack");
                    // Remove from captured set so we can retry later
                    capturedHeadshotsRef.current.delete(res.id);
                  }
                } else {
                  console.log("⏭️ [HEADSHOT DEBUG] Skipping headshot capture:", {
                    reason: !res.found ? "face was found (matched)" : !res.id ? "no identity ID" : "already captured",
                  });
                }
              })
              .catch((err) => {
                console.error("Processing error:", err);
                setStatus("Error processing face");
              });
          }
        }
      }

      requestAnimationFrame(detect);
    };

    startCamera();
  }, [human, isReady, updateVisualContext]);

  return (
    <div className="relative flex flex-col items-center justify-center p-4 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900">
      <div className="absolute top-4 left-4 z-10 bg-black/50 text-white px-2 py-1 rounded text-xs font-mono">
        STATUS: {status}
      </div>
      <div className="relative overflow-hidden rounded-lg">
        <video
          ref={videoRef}
          className="w-full max-w-lg aspect-video bg-black object-cover"
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
        />
      </div>
    </div>
  );
}

