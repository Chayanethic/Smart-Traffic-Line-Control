"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { DetectionResult, LaneCounts, LaneKey, Settings, TrafficState } from "@/lib/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type Feedback = { type: "success" | "error"; message: string } | null;
type ContextValue = {
  state: TrafficState | null;
  connected: boolean;
  loading: boolean;
  busy: string | null;
  feedback: Feedback;
  clearFeedback: () => void;
  refresh: () => Promise<void>;
  updateVehicles: (lanes: LaneCounts) => Promise<void>;
  triggerEmergency: (lane: LaneKey) => Promise<void>;
  clearEmergency: () => Promise<void>;
  updateSettings: (settings: Partial<Settings>) => Promise<void>;
  registerDevice: (data: Record<string, string>) => Promise<{ apiKey: string }>;
  analyzeImage: (file: File, lane: LaneKey) => Promise<DetectionResult>;
  controlOperation: (action: "start" | "pause" | "stop") => Promise<void>;
};

const TrafficContext = createContext<ContextValue | null>(null);

export function TrafficProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TrafficState | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const request = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await fetch(`${API_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = typeof data.error === "string"
        ? data.error
        : data.error?.formErrors?.[0] || Object.values(data.error?.fieldErrors || {}).flat().join(" ") || `Request failed (${response.status})`;
      throw new Error(message);
    }
    return data;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await request<TrafficState>("/api/dashboard");
      setState(next);
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh().catch((error) => setFeedback({ type: "error", message: error.message }));
    const socket: Socket = io(API_URL, { transports: ["websocket", "polling"], timeout: 5000 });
    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("traffic:update", (next: TrafficState) => setState(next));
    socket.on("vision:result", (detection: DetectionResult) => setState((current) => current ? { ...current, lastDetection: detection } : current));
    socket.on("notification:new", (notification) => setState((current) => current ? { ...current, notifications: [notification, ...current.notifications] } : current));
    return () => { socket.disconnect(); };
  }, [refresh]);

  const run = useCallback(async <T,>(name: string, action: () => Promise<T>, message: string) => {
    setBusy(name);
    setFeedback(null);
    try {
      const result = await action();
      setFeedback({ type: "success", message });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      setFeedback({ type: "error", message });
      throw error;
    } finally {
      setBusy(null);
    }
  }, []);

  const updateVehicles = useCallback((lanes: LaneCounts) => run("vehicles", async () => {
    const result = await request<{ dashboard: TrafficState }>("/api/vehicle-count", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...lanes, source: "manual" }),
    });
    setState(result.dashboard);
  }, "Manual vehicle counts saved and signal timing recalculated."), [request, run]);

  const triggerEmergency = useCallback((lane: LaneKey) => run("emergency", async () => {
    const result = await request<{ dashboard: TrafficState }>("/api/emergency", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lane, triggeredBy: "web-operator" }),
    });
    setState(result.dashboard);
  }, `Emergency green activated for Lane ${lane.slice(-1)}.`), [request, run]);

  const clearEmergency = useCallback(() => run("emergency", async () => {
    const result = await request<{ dashboard: TrafficState }>("/api/emergency/clear", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ triggeredBy: "web-operator" }),
    });
    setState(result.dashboard);
  }, "Emergency mode cleared and the normal cycle resumed."), [request, run]);

  const updateSettings = useCallback((settings: Partial<Settings>) => run("settings", async () => {
    const result = await request<{ dashboard: TrafficState }>("/api/settings", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings),
    });
    setState(result.dashboard);
  }, "System and camera settings saved."), [request, run]);

  const registerDevice = useCallback((data: Record<string, string>) => run("device", async () => {
    const result = await request<{ apiKey: string }>("/api/device/register", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    await refresh();
    return result;
  }, "ESP32 device registered. Copy its API key now."), [refresh, request, run]);

  const analyzeImage = useCallback((file: File, lane: LaneKey) => run("vision", async () => {
    const form = new FormData();
    form.append("image", file);
    form.append("lane", lane);
    form.append("source", "manual-upload");
    const result = await request<{ detection: DetectionResult; dashboard: TrafficState }>("/api/vision/analyze", { method: "POST", body: form });
    setState(result.dashboard);
    return result.detection;
  }, `Image analyzed and Lane ${lane.slice(-1)} updated.`), [request, run]);

  const controlOperation = useCallback((action: "start" | "pause" | "stop") => run("operation", async () => {
    const result = await request<{ dashboard: TrafficState }>(`/api/operation/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startedBy: "web-operator", stoppedBy: "web-operator" }),
    });
    setState(result.dashboard);
  }, action === "start" ? "Traffic operation started." : action === "pause" ? "Traffic operation paused." : "Traffic operation stopped and session saved."), [request, run]);

  const value = useMemo(() => ({ state, connected, loading, busy, feedback, clearFeedback: () => setFeedback(null), refresh, updateVehicles, triggerEmergency, clearEmergency, updateSettings, registerDevice, analyzeImage, controlOperation }), [state, connected, loading, busy, feedback, refresh, updateVehicles, triggerEmergency, clearEmergency, updateSettings, registerDevice, analyzeImage, controlOperation]);
  return <TrafficContext.Provider value={value}>{children}</TrafficContext.Provider>;
}

export function useTraffic() {
  const context = useContext(TrafficContext);
  if (!context) throw new Error("useTraffic must be used inside TrafficProvider");
  return context;
}
