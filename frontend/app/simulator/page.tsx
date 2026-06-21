"use client";
import { useEffect, useState } from "react";
import { Camera, Car, ImageUp, Save } from "lucide-react";
import { IntersectionMini } from "@/components/intersection-mini";
import { useTraffic } from "@/components/traffic-provider";
import { Badge, Button, Card, Input, PageSkeleton, SectionTitle, Spinner } from "@/components/ui";
import type { LaneCounts, LaneKey } from "@/lib/types";
import { OperationControl } from "@/components/operation-control";

export default function SimulatorPage() {
  const { state, loading, busy, updateVehicles, analyzeImage } = useTraffic();
  const [counts, setCounts] = useState<LaneCounts>({ lane1: 0, lane2: 0, lane3: 0, lane4: 0 });
  const [lane, setLane] = useState<LaneKey>("lane1");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { if (state) setCounts(state.lanes); }, [state]);
  if (loading || !state) return <PageSkeleton />;
  const lanes: LaneKey[] = ["lane1", "lane2", "lane3", "lane4"];
  return <>
    <SectionTitle title="Intersection & Vehicle Detection" description="Use manual counts or analyze a camera image. Both paths update the same live signal engine." action={<Badge className="border-emerald-200 bg-emerald-50 text-emerald-700"><Camera size={12} /> YOLO READY</Badge>} />
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5"><h2 className="font-bold text-[#173b2f]">Live signal state</h2><p className="mb-4 text-xs text-muted">Counts shown here are authoritative server values.</p><IntersectionMini state={state} /></Card>
      <div className="space-y-5">
        <Card className="p-5"><div className="flex items-center gap-3"><Car className="text-primary" /><div><h2 className="font-bold text-[#173b2f]">Manual lane counts</h2><p className="text-xs text-muted">Enter the visible queue for every lane.</p></div></div>
          <div className="mt-4 grid grid-cols-2 gap-3">{lanes.map((key, i) => <label key={key} className="text-xs font-semibold text-[#40564d]">Lane {i + 1}<Input className="mt-2" type="number" min={0} max={999} value={counts[key]} onChange={(event) => setCounts((current) => ({ ...current, [key]: Math.max(0, Number(event.target.value)) }))} /></label>)}</div>
          <Button className="mt-4 w-full" disabled={busy === "vehicles"} onClick={() => updateVehicles(counts)}>{busy === "vehicles" ? <Spinner /> : <Save size={16} />}{busy === "vehicles" ? "Saving…" : "Save counts & recalculate signals"}</Button>
        </Card>
        <Card className="p-5"><div className="flex items-center gap-3"><ImageUp className="text-primary" /><div><h2 className="font-bold text-[#173b2f]">Test with a traffic image</h2><p className="text-xs text-muted">The image is analyzed in memory and is not stored.</p></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr]"><select className="h-11 rounded-xl border border-border bg-white px-3 text-sm" value={lane} onChange={(event) => setLane(event.target.value as LaneKey)}>{lanes.map((key, i) => <option key={key} value={key}>Lane {i + 1}</option>)}</select><Input type="file" accept="image/jpeg,image/png,image/bmp,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></div>
          <Button className="mt-3 w-full" disabled={!file || busy === "vision"} onClick={() => file && analyzeImage(file, lane)}>{busy === "vision" ? <Spinner /> : <Camera size={16} />}{busy === "vision" ? "Detecting vehicles…" : "Analyze image & update lane"}</Button>
          {state.lastDetection && <div className="mt-4 overflow-hidden rounded-xl border border-border"><img src={state.lastDetection.annotatedImage} alt="Latest vehicle detection" className="w-full" /><div className="flex flex-wrap items-center justify-between gap-2 p-3 text-xs"><strong className="text-[#173b2f]">{state.lastDetection.vehicleCount} vehicles detected on Lane {state.lastDetection.lane.slice(-1)}</strong><span className="text-muted">{state.lastDetection.model} · {state.lastDetection.inferenceMs} ms</span></div></div>}
        </Card>
      </div>
    </div>
    <div className="mt-5"><OperationControl /></div>
  </>;
}
