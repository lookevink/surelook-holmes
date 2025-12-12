"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Human, Config, Result } from "@vladmandic/human";
import { getOrCreateActiveSession } from "@/lib/events";
import { processFaceDetection } from "@/app/actions/process-face";
import { FaceDetectionResult } from "@/app/actions/process-face";

interface FaceDetection {
  faceId: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  embedding?: number[];
  identityId?: string;
  identityName?: string;
}

interface SherlockScannerProps {
  onEventCreated?: () => void;
  onIdentityDetected?: (identityId: string | null) => void;
}

const humanConfig: Partial<Config> = {
  backend: "webgl", // Use WebGL for better compatibility
  modelBasePath: "https://unpkg.com/@vladmandic/human/models/",
  face: {
    enabled: true,
    detector: {
      enabled: true,
      rotation: false, // Disable rotation for better performance
      maxDetected: 10, // Max faces to detect
    },
    description: {
      enabled: true, // Enable face embeddings
      modelPath: "https://unpkg.com/@vladmandic/human/models/faceres.json",
    },
  },
  object: {
    enabled: true,
    modelPath: "https://unpkg.com/@vladmandic/human/models/mobilenet.json",
  },
  gesture: {
    enabled: false, // Disable for now to improve performance
  },
};

export default function SherlockScanner({ onEventCreated, onIdentityDetected }: SherlockScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [human, setHuman] = useState<Human | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [detectedFaces, setDetectedFaces] = useState<FaceDetection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastProcessedFacesRef = useRef<Set<string>>(new Set());
  const faceNamesRef = useRef<Map<string, string>>(new Map());
  const faceIdsRef = useRef<Map<string, string>>(new Map()); // Map faceId -> identityId
  const lastReportedIdentityIdRef = useRef<string | null>(null);

  // Initialize Human.js
  useEffect(() => {
    const initHuman = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const HumanLibrary = (await import("@vladmandic/human")).default;
        const instance = new HumanLibrary(humanConfig);
        await instance.warmup(); // Pre-load models
        setHuman(instance);
      } catch (err) {
        console.error("Error initializing Human.js:", err);
        setError("Failed to initialize face detection. Please check your browser compatibility.");
      }
    };

    initHuman();
  }, []);

  // Initialize session
  useEffect(() => {
    const initSession = async () => {
      try {
        const session = await getOrCreateActiveSession();
        setSessionId(session.id);
      } catch (err) {
        console.error("Error initializing session:", err);
        setError("Failed to initialize session.");
      }
    };

    if (human) {
      initSession();
    }
  }, [human]);

  // Start video stream
  const startVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsScanning(true);
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Failed to access camera. Please grant camera permissions.");
    }
  }, []);

  // Stop video stream
  const stopVideo = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    lastProcessedFacesRef.current.clear();
    faceNamesRef.current.clear();
    faceIdsRef.current.clear();
    if (onIdentityDetected) onIdentityDetected(null);
  }, [onIdentityDetected]);

  // Process frame and detect faces
  const processFrame = useCallback(async () => {
    if (!human || !videoRef.current || !canvasRef.current || !isScanning) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Detect faces
    const result: Result = await human.detect(canvas);

    // Process detected faces
    const faces: FaceDetection[] = [];
    const currentFaceIds = new Set<string>();
    let primaryIdentityId: string | null = null;

    if (result.face && result.face.length > 0) {
      // Sort faces by size (largest first) to find primary subject
      const sortedFaces = [...result.face].sort((a, b) => {
        const areaA = a.box[2] * a.box[3];
        const areaB = b.box[2] * b.box[3];
        return areaB - areaA;
      });

      for (let i = 0; i < sortedFaces.length; i++) {
        const face = sortedFaces[i];
        if (!face.box || !face.embedding) continue;

        // Generate a stable ID for this face based on position (snapped to 50px grid)
        const gridX = Math.round(face.box[0] / 50) * 50;
        const gridY = Math.round(face.box[1] / 50) * 50;
        const faceId = `face-${gridX}-${gridY}`;
        
        currentFaceIds.add(faceId);

        // Check if we've already processed this face
        const isNewFace = !lastProcessedFacesRef.current.has(faceId);

        const identityName = faceNamesRef.current.get(faceId);
        const identityId = faceIdsRef.current.get(faceId);

        if (i === 0 && identityId) {
          primaryIdentityId = identityId;
        }

        // Process new faces with server action
        if (isNewFace && sessionId && face.embedding.length > 0) {
          // Fire and forget (or handle promise)
          processFaceDetection(Array.from(face.embedding))
            .then((result: FaceDetectionResult) => {
              if (result.name) {
                faceNamesRef.current.set(faceId, result.name);
              }
              if (result.id) {
                faceIdsRef.current.set(faceId, result.id);
                // If this was the primary face (index 0), update primaryIdentityId immediately?
                // It's async, so it will be picked up in next frame.
              }
              if (onEventCreated) {
                onEventCreated();
              }
            })
            .catch((err) => {
              console.error("Error processing face:", err);
            });
        }

        faces.push({
          faceId,
          confidence: face.score || 0,
          box: {
            x: face.box[0],
            y: face.box[1],
            width: face.box[2],
            height: face.box[3],
          },
          embedding: face.embedding ? Array.from(face.embedding) : undefined,
          identityName,
          identityId,
        });
      }
    }

    // Report primary identity if changed
    if (primaryIdentityId !== lastReportedIdentityIdRef.current) {
      lastReportedIdentityIdRef.current = primaryIdentityId;
      if (onIdentityDetected) {
        onIdentityDetected(primaryIdentityId);
      }
    }

    // Update detected faces
    setDetectedFaces(faces);

    // Update processed faces set
    lastProcessedFacesRef.current = currentFaceIds;

    // Draw bounding boxes
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 2;
    ctx.font = "16px Arial";
    ctx.fillStyle = "#00ff00";

    faces.forEach((face) => {
      ctx.strokeRect(face.box.x, face.box.y, face.box.width, face.box.height);
      const label = face.identityName || "Unknown";
      ctx.fillText(label, face.box.x, face.box.y - 5);
    });

    // Continue processing
    animationFrameRef.current = requestAnimationFrame(processFrame);
  }, [human, isScanning, sessionId, onEventCreated, onIdentityDetected]);

  // Start processing when scanning
  useEffect(() => {
    if (isScanning && human) {
      animationFrameRef.current = requestAnimationFrame(processFrame);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isScanning, human, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopVideo();
    };
  }, [stopVideo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <video
          ref={videoRef}
          className="hidden"
          autoPlay
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="w-full max-w-4xl rounded-lg border border-gray-300 bg-black"
        />
      </div>

      <div className="flex gap-2">
        {!isScanning ? (
          <button
            onClick={startVideo}
            disabled={!human || !!error}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Start Scanning
          </button>
        ) : (
          <button
            onClick={stopVideo}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Stop Scanning
          </button>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {detectedFaces.length > 0 && (
        <div className="p-4 bg-gray-100 rounded">
          <h3 className="font-semibold mb-2">Detected Faces: {detectedFaces.length}</h3>
          <div className="space-y-1">
            {detectedFaces.map((face) => (
              <div key={face.faceId} className="text-sm">
                {face.identityName || "Unknown"} ({(face.confidence * 100).toFixed(1)}%)
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
