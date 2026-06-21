"use client";
import { useEffect, useState } from "react";
import { Camera, Save, SlidersHorizontal } from "lucide-react";
import { useTraffic } from "@/components/traffic-provider";
import { Button, Card, Input, SectionTitle } from "@/components/ui";
import type { Settings } from "@/lib/types";

export default function SettingsPage() {
  const { state, busy, updateSettings } = useTraffic();
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (state) setForm(state.settings); }, [state]);
  if (!form) return <p>Loading settings…</p>;
  const numeric = (key: keyof Settings, label: string, help: string, step = 1) => <label className="rounded-xl border border-border p-4 text-xs font-semibold text-[#40564d]"><span>{label}</span><Input className="mt-2" type="number" step={step} value={Number(form[key])} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /><p className="mt-2 font-normal text-muted">{help}</p></label>;
  return <>
    <SectionTitle title="System Settings" description="Saved values are used immediately by the signal engine and returned to connected ESP32 controllers." />
    <Card className="mx-auto max-w-5xl p-6"><div className="flex items-center gap-3"><SlidersHorizontal className="text-primary" /><div><h2 className="font-bold text-[#173b2f]">Signal algorithm</h2><p className="text-xs text-muted">Validated server-side before being applied.</p></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {numeric("minimumGreen","Minimum green time","Base green duration in seconds.")}
        {numeric("maximumGreen","Maximum green time","Hard safety cap for an adaptive cycle.")}
        {numeric("vehicleFactor","Seconds per vehicle","Added to minimum time for each detected vehicle.",0.1)}
        {numeric("yellowDuration","Yellow duration","Transition interval in seconds.")}
        {numeric("fairnessLimit","Maximum lane wait","Lane is prioritized after this wait.")}
        {numeric("emergencyDuration","Emergency green duration","Default software emergency hold.")}
      </div>
      <div className="mt-7 flex items-center gap-3"><Camera className="text-primary" /><div><h2 className="font-bold text-[#173b2f]">Camera & hardware</h2><p className="text-xs text-muted">The capture interval is sent back in heartbeat and image responses.</p></div></div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {numeric("cameraIntervalSeconds","Camera capture interval","How often ESP32 captures and uploads an image.")}
        {numeric("detectionConfidence","YOLO confidence threshold","Higher values reduce weak detections.",0.05)}
        {numeric("laneCapacity","Vehicles at 100% density","Used to calculate each lane density.")}
        {numeric("deviceTimeout","Heartbeat timeout","Mark hardware offline after this many seconds.")}
      </div>
      <label className="mt-4 flex items-center justify-between rounded-xl border border-border p-4"><div><p className="text-sm font-semibold text-[#173b2f]">Simulation cycle</p><p className="text-xs text-muted">Signals still cycle from current counts when no hardware controls the lamps.</p></div><input type="checkbox" checked={form.simulationMode} onChange={(event) => setForm({ ...form, simulationMode: event.target.checked })} className="h-5 w-5 accent-[#13795b]" /></label>
      <div className="mt-6 flex justify-end"><Button disabled={busy === "settings"} onClick={() => updateSettings(form)}><Save size={16} />{busy === "settings" ? "Saving…" : "Save all settings"}</Button></div>
    </Card>
  </>;
}
