"use client";

import { createContext, useContext, useRef, useState, useCallback, ReactNode } from "react";

export interface VisualContextData {
  found: boolean;
  id?: string;
  name?: string;
  relationship_status?: string;
  similarity?: number;
  lastSeen?: number;
}

interface VisualContextType {
  currentFaceRef: React.MutableRefObject<VisualContextData | null>;
  updateVisualContext: (data: VisualContextData) => void;
  subscribe: (callback: (context: VisualContextData) => void) => () => void;
}

const VisualContext = createContext<VisualContextType | undefined>(undefined);

export function VisualContextProvider({ children }: { children: ReactNode }) {
  const [currentFace, setCurrentFace] = useState<VisualContextData | null>(null);
  const currentFaceRef = useRef<VisualContextData | null>(null);
  const subscribersRef = useRef<Set<(context: VisualContextData) => void>>(new Set());

  const updateVisualContext = useCallback((data: VisualContextData) => {
    const updatedData = {
      ...data,
      lastSeen: data.lastSeen || Date.now(),
    };
    
    currentFaceRef.current = updatedData;
    setCurrentFace(updatedData);
    
    // Notify all subscribers
    subscribersRef.current.forEach((callback) => {
      callback(updatedData);
    });
  }, []);

  const subscribe = useCallback((callback: (context: VisualContextData) => void) => {
    subscribersRef.current.add(callback);
    
    // Return unsubscribe function
    return () => {
      subscribersRef.current.delete(callback);
    };
  }, []);

  return (
    <VisualContext.Provider
      value={{
        currentFaceRef,
        updateVisualContext,
        subscribe,
      }}
    >
      {children}
    </VisualContext.Provider>
  );
}

export function useVisualContext() {
  const context = useContext(VisualContext);
  if (context === undefined) {
    throw new Error("useVisualContext must be used within a VisualContextProvider");
  }
  return context;
}

