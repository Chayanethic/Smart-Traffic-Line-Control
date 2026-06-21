export const defaultSettings = {
  minimumGreen: 10,
  maximumGreen: 45,
  vehicleFactor: 1.2,
  yellowDuration: 3,
  deviceTimeout: 30,
  fairnessLimit: 75,
  simulationMode: true,
  cameraIntervalSeconds: 15,
  detectionConfidence: 0.35,
  laneCapacity: 30,
  emergencyDuration: 20,
};

export function calculateGreenTime(vehicleCount, settings = defaultSettings) {
  const raw = settings.minimumGreen + vehicleCount * settings.vehicleFactor;
  return Math.round(Math.min(settings.maximumGreen, Math.max(settings.minimumGreen, raw)));
}

export function buildTimings(lanes, settings = defaultSettings) {
  return Object.fromEntries(
    Object.entries(lanes).map(([lane, count]) => [lane, calculateGreenTime(Number(count), settings)]),
  );
}

export function selectNextLane(lanes, waits, currentLane, emergencyLane = null, settings = defaultSettings) {
  if (emergencyLane) return emergencyLane;

  const entries = Object.entries(lanes);
  const starved = entries
    .filter(([lane]) => lane !== currentLane && (waits[lane] || 0) >= settings.fairnessLimit)
    .sort((a, b) => (waits[b[0]] || 0) - (waits[a[0]] || 0));

  if (starved.length) return starved[0][0];

  return entries
    .filter(([lane]) => lane !== currentLane)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || "lane1";
}
