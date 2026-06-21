export type LaneKey = "lane1" | "lane2" | "lane3" | "lane4";
export type LaneCounts = Record<LaneKey, number>;

export interface DeviceStatus {
  deviceId: string;
  junctionName: string;
  location: string;
  firmwareVersion: string;
  cameraModel: string;
  online: boolean;
  lastHeartbeat: string | null;
  wifiSignal: number | null;
  cameraStatus: string;
}

export interface DetectionResult {
  vehicleCount: number;
  detections: { class: string; confidence: number; box: number[] }[];
  inferenceMs: number;
  imageWidth: number;
  imageHeight: number;
  annotatedImage: string;
  model: string;
  lane: LaneKey;
  source: string;
  capturedAt: string;
  deviceId?: string;
}

export interface Settings {
  minimumGreen: number;
  maximumGreen: number;
  vehicleFactor: number;
  yellowDuration: number;
  deviceTimeout: number;
  fairnessLimit: number;
  simulationMode: boolean;
  cameraIntervalSeconds: number;
  detectionConfidence: number;
  laneCapacity: number;
  emergencyDuration: number;
}

export interface TrafficState {
  lanes: LaneCounts;
  laneSources: Record<LaneKey, string>;
  laneDensity: Record<LaneKey, number>;
  currentLane: LaneKey;
  phase: "GREEN" | "YELLOW" | "RED";
  timer: number;
  waits: LaneCounts;
  emergencyLane: LaneKey | null;
  totalVehiclesToday: number;
  averageWait: number;
  density: number;
  totalQueued: number;
  timings: Record<LaneKey, number>;
  settings: Settings;
  device: DeviceStatus | null;
  devices: DeviceStatus[];
  lastDetection: DetectionResult | null;
  notifications: { id: string; type: string; title: string; message: string; createdAt: string; read: boolean }[];
  operation: {
    status: "running" | "paused" | "stopped";
    sessionId: string | null;
    startedAt: string | null;
    pausedAt: string | null;
    accumulatedPausedMs: number;
    startingVehicleTotal: number;
  };
  recentSessions: {
    id: string;
    sessionId: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: number;
    vehiclesObserved: number;
  }[];
  server: { connected: boolean; persistence: string; uptimeSeconds: number };
}
