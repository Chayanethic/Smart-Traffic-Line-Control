import "dotenv/config";
import crypto from "node:crypto";
import http from "node:http";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import multer from "multer";
import morgan from "morgan";
import { Server } from "socket.io";
import { z } from "zod";
import { append, get, initializeStore, list, save, usingFirestore } from "./store.js";
import { buildTimings, defaultSettings, selectNextLane } from "./traffic-engine.js";

await initializeStore();

const app = express();
const server = http.createServer(app);
const origins = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map((value) => value.trim());
const io = new Server(server, { cors: { origin: origins, methods: ["GET", "POST"] } });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ origin: origins }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("tiny"));

const emptyLanes = { lane1: 0, lane2: 0, lane3: 0, lane4: 0 };
const state = {
  lanes: { ...emptyLanes },
  laneSources: { lane1: "none", lane2: "none", lane3: "none", lane4: "none" },
  currentLane: "lane1",
  phase: "RED",
  timer: 0,
  waits: { ...emptyLanes },
  emergencyLane: null,
  pausedState: null,
  totalVehiclesToday: 0,
  averageWait: 0,
  settings: { ...defaultSettings },
  devices: [],
  lastDetection: null,
  notifications: [],
  startedAt: new Date().toISOString(),
  operation: {
    status: "stopped",
    sessionId: null,
    startedAt: null,
    pausedAt: null,
    accumulatedPausedMs: 0,
    startingVehicleTotal: 0,
  },
  recentSessions: [],
};

const laneSchema = z.object({
  lane1: z.coerce.number().int().min(0).max(999),
  lane2: z.coerce.number().int().min(0).max(999),
  lane3: z.coerce.number().int().min(0).max(999),
  lane4: z.coerce.number().int().min(0).max(999),
});

const settingsSchema = z.object({
  minimumGreen: z.coerce.number().int().min(3).max(300).optional(),
  maximumGreen: z.coerce.number().int().min(5).max(600).optional(),
  vehicleFactor: z.coerce.number().min(0.1).max(20).optional(),
  yellowDuration: z.coerce.number().int().min(1).max(15).optional(),
  deviceTimeout: z.coerce.number().int().min(10).max(600).optional(),
  fairnessLimit: z.coerce.number().int().min(10).max(600).optional(),
  cameraIntervalSeconds: z.coerce.number().int().min(5).max(3600).optional(),
  detectionConfidence: z.coerce.number().min(0.05).max(0.95).optional(),
  laneCapacity: z.coerce.number().int().min(1).max(500).optional(),
  emergencyDuration: z.coerce.number().int().min(5).max(300).optional(),
  simulationMode: z.boolean().optional(),
});

async function restoreState() {
  const saved = await get("intersections", "primary");
  if (saved?.state) Object.assign(state, saved.state, { lastDetection: null });
  if (saved?.settings) state.settings = { ...defaultSettings, ...saved.settings };
  state.operation = {
    status: "stopped",
    sessionId: null,
    startedAt: null,
    pausedAt: null,
    accumulatedPausedMs: 0,
    startingVehicleTotal: state.totalVehiclesToday,
    ...(state.operation || {}),
  };
  state.devices = await listDevices();
  state.recentSessions = await list("operation_sessions", 30);
}

async function listDevices() {
  const registered = await list("device_registry", 200);
  const unique = new Map();
  for (const entry of registered) {
    if (!unique.has(entry.deviceId)) {
      const { apiKeyHash: _secret, ...device } = entry;
      unique.set(entry.deviceId, device);
    }
  }
  return [...unique.values()];
}

async function persistState() {
  const { lastDetection, devices, pausedState, recentSessions, ...persistable } = state;
  await save("intersections", "primary", { state: persistable, settings: state.settings });
}

function densityFor(count) {
  return Math.min(100, Math.round((count / state.settings.laneCapacity) * 100));
}

function dashboard() {
  const totalQueued = Object.values(state.lanes).reduce((sum, value) => sum + value, 0);
  const onlineDevices = state.devices.filter((device) => device.online);
  return {
    ...state,
    device: onlineDevices[0] || state.devices[0] || null,
    timings: buildTimings(state.lanes, state.settings),
    laneDensity: Object.fromEntries(Object.entries(state.lanes).map(([lane, count]) => [lane, densityFor(count)])),
    density: densityFor(Math.max(...Object.values(state.lanes))),
    totalQueued,
    server: { connected: true, persistence: usingFirestore() ? "firestore" : "local", uptimeSeconds: Math.round(process.uptime()) },
  };
}

function signalPayload() {
  const timings = buildTimings(state.lanes, state.settings);
  return {
    operationStatus: state.operation.status,
    currentLane: state.currentLane,
    phase: state.phase,
    timer: state.timer,
    emergencyLane: state.emergencyLane,
    timings,
    lanes: Object.fromEntries(Object.keys(state.lanes).map((lane) => [
      lane,
      {
        red: lane !== state.currentLane || state.phase === "RED",
        yellow: lane === state.currentLane && state.phase === "YELLOW",
        green: lane === state.currentLane && state.phase === "GREEN",
        vehicleCount: state.lanes[lane],
        calculatedGreenSeconds: timings[lane],
      },
    ])),
    cameraIntervalSeconds: state.settings.cameraIntervalSeconds,
    serverTime: new Date().toISOString(),
  };
}

function emitDashboard() {
  io.emit("traffic:update", dashboard());
  io.emit("signal:update", { currentLane: state.currentLane, phase: state.phase, timer: state.timer, emergencyLane: state.emergencyLane });
}

function addNotification(type, title, message) {
  const notification = { id: crypto.randomUUID(), type, title, message, createdAt: new Date().toISOString(), read: false };
  state.notifications = [notification, ...state.notifications].slice(0, 50);
  io.emit("notification:new", notification);
  return notification;
}

async function findDevice(deviceId) {
  const devices = await list("device_registry", 200);
  return devices.find((device) => device.deviceId === deviceId);
}

async function authenticateDevice(req, res, next) {
  const deviceId = String(req.headers["x-device-id"] || req.body?.deviceId || req.query.deviceId || "");
  const apiKey = String(req.headers["x-api-key"] || "");
  if (!deviceId || !apiKey) return res.status(401).json({ error: "X-Device-ID and X-API-Key are required." });
  const device = await findDevice(deviceId);
  const hash = crypto.createHash("sha256").update(apiKey).digest("hex");
  if (!device || device.apiKeyHash !== hash) return res.status(401).json({ error: "Invalid device credentials." });
  req.device = device;
  next();
}

async function applyLaneCounts(lanes, source, metadata = {}) {
  state.lanes = { ...lanes };
  Object.keys(lanes).forEach((lane) => { state.laneSources[lane] = source; });
  const total = Object.values(lanes).reduce((sum, value) => sum + value, 0);
  state.totalVehiclesToday += total;
  if (state.operation.status === "running" && (state.phase === "RED" || state.timer <= 0)) {
    state.currentLane = selectNextLane(state.lanes, state.waits, state.currentLane, null, state.settings);
    state.phase = "GREEN";
    state.timer = buildTimings(state.lanes, state.settings)[state.currentLane];
  }
  await append("traffic_data", { lanes, total, source, ...metadata });
  await persistState();
  emitDashboard();
}

app.get("/health", (_req, res) => res.json({ ok: true, visionService: process.env.VISION_SERVICE_URL || null, persistence: usingFirestore() ? "firestore" : "local" }));
app.get("/api/dashboard", (_req, res) => res.json(dashboard()));
app.get("/api/signal", (_req, res) => res.json(signalPayload()));
app.get("/api/device/status", (_req, res) => res.json({ devices: state.devices }));
app.get("/api/settings", (_req, res) => res.json(state.settings));
app.get("/api/analytics", async (_req, res) => res.json({ traffic: await list("traffic_data", 500), emergencies: await list("emergency_logs", 100), systemLogs: await list("system_logs", 100) }));
app.get("/api/operation/sessions", async (_req, res) => res.json(await list("operation_sessions", 100)));
app.get("/api/emergency/logs", async (_req, res) => res.json(await list("emergency_logs", 100)));

app.post("/api/vehicle-count", async (req, res) => {
  const parsed = laneSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await applyLaneCounts(parsed.data, req.body.source || "manual", { updatedBy: req.body.updatedBy || "web" });
  res.json({ success: true, dashboard: dashboard() });
});

app.post("/api/settings", async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const next = { ...state.settings, ...parsed.data };
  if (next.maximumGreen < next.minimumGreen) return res.status(400).json({ error: "Maximum green time must be greater than minimum green time." });
  state.settings = next;
  await persistState();
  emitDashboard();
  res.json({ success: true, settings: state.settings, dashboard: dashboard() });
});

app.post("/api/operation/start", async (req, res) => {
  const now = new Date().toISOString();
  if (state.operation.status === "running") return res.status(409).json({ error: "Traffic operation is already running." });

  if (state.operation.status === "paused") {
    const pausedFor = Date.now() - new Date(state.operation.pausedAt).getTime();
    state.operation = {
      ...state.operation,
      status: "running",
      pausedAt: null,
      accumulatedPausedMs: state.operation.accumulatedPausedMs + pausedFor,
    };
  } else {
    state.operation = {
      status: "running",
      sessionId: crypto.randomUUID(),
      startedAt: now,
      pausedAt: null,
      accumulatedPausedMs: 0,
      startingVehicleTotal: state.totalVehiclesToday,
      startedBy: req.body.startedBy || "web-operator",
    };
  }

  if (state.phase === "RED" || state.timer <= 0) {
    state.currentLane = selectNextLane(state.lanes, state.waits, state.currentLane, null, state.settings);
    state.phase = "GREEN";
    state.timer = buildTimings(state.lanes, state.settings)[state.currentLane];
  }
  await persistState();
  emitDashboard();
  res.json({ success: true, dashboard: dashboard() });
});

app.post("/api/operation/pause", async (_req, res) => {
  if (state.operation.status !== "running") return res.status(409).json({ error: "Only a running operation can be paused." });
  state.operation = { ...state.operation, status: "paused", pausedAt: new Date().toISOString() };
  await persistState();
  emitDashboard();
  res.json({ success: true, dashboard: dashboard() });
});

app.post("/api/operation/stop", async (req, res) => {
  if (state.operation.status === "stopped") return res.status(409).json({ error: "Traffic operation is already stopped." });
  const endedAt = new Date().toISOString();
  const currentPause = state.operation.status === "paused" && state.operation.pausedAt
    ? Date.now() - new Date(state.operation.pausedAt).getTime()
    : 0;
  const durationMs = Math.max(0,
    Date.now() - new Date(state.operation.startedAt).getTime()
    - state.operation.accumulatedPausedMs - currentPause,
  );
  const session = await append("operation_sessions", {
    sessionId: state.operation.sessionId,
    startedAt: state.operation.startedAt,
    endedAt,
    durationSeconds: Math.round(durationMs / 1000),
    stoppedBy: req.body.stoppedBy || "web-operator",
    vehiclesObserved: Math.max(0, state.totalVehiclesToday - (state.operation.startingVehicleTotal || 0)),
  });
  state.recentSessions = [session, ...state.recentSessions].slice(0, 30);
  state.operation = { status: "stopped", sessionId: null, startedAt: null, pausedAt: null, accumulatedPausedMs: 0, startingVehicleTotal: state.totalVehiclesToday };
  state.phase = "RED";
  state.timer = 0;
  state.emergencyLane = null;
  state.pausedState = null;
  await persistState();
  emitDashboard();
  res.json({ success: true, dashboard: dashboard(), session });
});

app.post("/api/device/register", async (req, res) => {
  const { deviceId, junctionName, location, firmwareVersion = "1.0.0", cameraModel = "OV7670" } = req.body;
  if (!deviceId || !junctionName) return res.status(400).json({ error: "Device ID and junction name are required." });
  if (await findDevice(deviceId)) return res.status(409).json({ error: "Device ID already exists." });
  const apiKey = `stcs_${crypto.randomBytes(24).toString("hex")}`;
  const device = {
    deviceId, junctionName, location: location || "", firmwareVersion, cameraModel,
    apiKeyHash: crypto.createHash("sha256").update(apiKey).digest("hex"),
    online: false, wifiSignal: null, cameraStatus: "not-seen", lastHeartbeat: null,
  };
  await append("device_registry", device);
  state.devices = await listDevices();
  emitDashboard();
  res.status(201).json({ success: true, apiKey, device: state.devices.find((item) => item.deviceId === deviceId) });
});

app.delete("/api/device/:deviceId", async (_req, res) => res.status(501).json({ error: "Device deletion is disabled to preserve audit history. Rotate the device ID instead." }));

app.post("/api/device/heartbeat", authenticateDevice, async (req, res) => {
  const now = new Date().toISOString();
  const updated = {
    ...req.device, online: true, wifiSignal: Number(req.body.wifiSignal ?? req.device.wifiSignal),
    firmwareVersion: req.body.firmwareVersion || req.device.firmwareVersion, cameraStatus: req.body.cameraStatus || "ready",
    lastHeartbeat: now, lastIp: req.ip,
  };
  await append("device_registry", updated);
  state.devices = [updated, ...state.devices.filter((device) => device.deviceId !== updated.deviceId)];
  io.emit("device:online", updated);
  emitDashboard();
  res.json({ success: true, serverTime: now, signal: signalPayload(), settings: { cameraIntervalSeconds: state.settings.cameraIntervalSeconds } });
});

app.post("/api/emergency", async (req, res) => {
  const lane = String(req.body.lane || "");
  if (!Object.hasOwn(state.lanes, lane)) return res.status(400).json({ error: "Choose lane1, lane2, lane3, or lane4." });
  if (!state.emergencyLane) state.pausedState = { currentLane: state.currentLane, phase: state.phase, timer: state.timer };
  state.emergencyLane = lane;
  state.currentLane = lane;
  state.phase = "GREEN";
  state.timer = Number(req.body.duration || state.settings.emergencyDuration);
  const event = await append("emergency_logs", { lane, status: "active", triggeredBy: req.body.triggeredBy || "operator" });
  addNotification("emergency", "Emergency priority activated", `Lane ${lane.slice(-1)} has immediate green priority.`);
  await persistState();
  io.emit("emergency:triggered", event);
  emitDashboard();
  res.json({ success: true, dashboard: dashboard(), event });
});

app.post("/api/emergency/clear", async (req, res) => {
  const lane = state.emergencyLane;
  if (state.pausedState) Object.assign(state, state.pausedState);
  state.emergencyLane = null;
  state.pausedState = null;
  const event = await append("emergency_logs", { lane, status: "cleared", triggeredBy: req.body.triggeredBy || "operator" });
  await persistState();
  emitDashboard();
  res.json({ success: true, dashboard: dashboard(), event });
});

app.post("/api/vision/analyze", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image file is required." });
  const lane = String(req.body.lane || "");
  if (!Object.hasOwn(state.lanes, lane)) return res.status(400).json({ error: "A valid lane is required." });
  const visionUrl = process.env.VISION_SERVICE_URL || "http://localhost:8000";
  const form = new FormData();
  form.append("image", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
  form.append("confidence", String(state.settings.detectionConfidence));
  try {
    const response = await fetch(`${visionUrl}/detect`, { method: "POST", body: form, signal: AbortSignal.timeout(120000) });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result.detail || result.error || "Vehicle detector failed." });
    const lanes = { ...state.lanes, [lane]: result.vehicleCount };
    state.lastDetection = { ...result, lane, source: req.body.source || "manual-upload", capturedAt: new Date().toISOString() };
    state.laneSources[lane] = req.body.source || "camera";
    await applyLaneCounts(lanes, state.laneSources[lane], { lane, vehicleCount: result.vehicleCount, inferenceMs: result.inferenceMs });
    io.emit("vision:result", state.lastDetection);
    res.json({ success: true, detection: state.lastDetection, dashboard: dashboard() });
  } catch (error) {
    res.status(503).json({ error: `Vision service unavailable: ${error.message}` });
  }
});

app.post("/api/device/image", authenticateDevice, upload.single("image"), async (req, res) => {
  req.body.source = `camera:${req.device.deviceId}`;
  const lane = String(req.body.lane || "");
  if (!req.file || !Object.hasOwn(state.lanes, lane)) return res.status(400).json({ error: "Image and valid lane are required." });
  const visionUrl = process.env.VISION_SERVICE_URL || "http://localhost:8000";
  const form = new FormData();
  form.append("image", new Blob([req.file.buffer], { type: req.file.mimetype }), req.file.originalname);
  form.append("confidence", String(state.settings.detectionConfidence));
  try {
    const response = await fetch(`${visionUrl}/detect`, { method: "POST", body: form, signal: AbortSignal.timeout(120000) });
    const result = await response.json();
    if (!response.ok) return res.status(502).json({ error: result.detail || "Vehicle detector failed." });
    state.lastDetection = { ...result, lane, deviceId: req.device.deviceId, source: "esp32-camera", capturedAt: new Date().toISOString() };
    await applyLaneCounts({ ...state.lanes, [lane]: result.vehicleCount }, `camera:${req.device.deviceId}`, { lane, vehicleCount: result.vehicleCount, inferenceMs: result.inferenceMs });
    io.emit("vision:result", state.lastDetection);
    res.json({ success: true, vehicleCount: result.vehicleCount, density: densityFor(result.vehicleCount), signal: signalPayload(), nextCaptureSeconds: state.settings.cameraIntervalSeconds });
  } catch (error) {
    res.status(503).json({ error: `Vision service unavailable: ${error.message}` });
  }
});

io.on("connection", (socket) => socket.emit("traffic:update", dashboard()));

setInterval(async () => {
  const timeout = state.settings.deviceTimeout * 1000;
  let changed = false;
  state.devices = state.devices.map((device) => {
    if (device.online && device.lastHeartbeat && Date.now() - new Date(device.lastHeartbeat).getTime() > timeout) {
      changed = true;
      const offline = { ...device, online: false };
      io.emit("device:offline", offline);
      addNotification("warning", "Device disconnected", `${device.deviceId} missed the heartbeat timeout.`);
      append("system_logs", { level: "warning", message: `${device.deviceId} heartbeat timed out.` });
      return offline;
    }
    return device;
  });
  if (changed) emitDashboard();
}, 5000);

setInterval(async () => {
  if (state.operation.status !== "running") return;
  if (state.phase === "RED" && Object.values(state.lanes).every((count) => count === 0)) return;
  state.timer = Math.max(0, state.timer - 1);
  Object.keys(state.waits).forEach((lane) => { state.waits[lane] = lane === state.currentLane ? 0 : state.waits[lane] + 1; });
  if (state.timer === 0) {
    if (state.emergencyLane) return;
    if (state.phase === "GREEN") {
      state.phase = "YELLOW";
      state.timer = state.settings.yellowDuration;
    } else {
      state.currentLane = selectNextLane(state.lanes, state.waits, state.currentLane, null, state.settings);
      state.phase = "GREEN";
      state.timer = buildTimings(state.lanes, state.settings)[state.currentLane];
    }
  }
  emitDashboard();
}, 1000);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.code === "LIMIT_FILE_SIZE" ? 413 : 500).json({ error: error.message || "Internal server error." });
});

await restoreState();
const port = Number(process.env.PORT || 4000);
server.listen(port, () => console.log(`STCS API listening on port ${port}`));

export { app, server, state };
