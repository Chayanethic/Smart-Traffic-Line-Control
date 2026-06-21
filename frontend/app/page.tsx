"use client";
import Link from "next/link";
import { Ambulance, Camera, Car, Clock3, Cpu, Radio, Settings, TrendingUp } from "lucide-react";
import { useTraffic } from "@/components/traffic-provider";
import { Badge, Button, Card, PageSkeleton, SectionTitle } from "@/components/ui";
import { IntersectionMini } from "@/components/intersection-mini";
import { OperationControl } from "@/components/operation-control";
import type { LaneKey } from "@/lib/types";

function Metric({ label, value, note, icon: Icon }: { label: string; value: string | number; note: string; icon: React.ElementType }) {
  return <Card className="p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted">{label}</p><p className="mt-2 text-2xl font-black text-[#173b2f]">{value}</p><p className="mt-1 text-[11px] text-muted">{note}</p></div><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e8f2ed] text-primary"><Icon size={19} /></span></div></Card>;
}

export default function DashboardPage() {
  const { state, loading } = useTraffic();
  if (loading || !state) return <PageSkeleton />;
  return <>
    <SectionTitle title="Traffic Operations Overview" description="Every value below comes from the live backend state—manual input, camera detection, or ESP32 telemetry." action={<Badge className="border-emerald-200 bg-emerald-50 text-emerald-700"><Radio size={12} /> REAL-TIME</Badge>} />
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Metric label="Active signal" value={`Lane ${state.currentLane.slice(-1)}`} note={`${state.phase} · ${state.timer}s remaining`} icon={Radio} />
      <Metric label="Vehicles queued" value={state.totalQueued} note="Current counts across four lanes" icon={Car} />
      <Metric label="Highest density" value={`${state.density}%`} note={`Capacity setting: ${state.settings.laneCapacity}/lane`} icon={TrendingUp} />
      <Metric label="Emergency" value={state.emergencyLane ? `Lane ${state.emergencyLane.slice(-1)}` : "Clear"} note={state.emergencyLane ? "Priority cycle active" : "Normal operation"} icon={Ambulance} />
      <Metric label="Connected devices" value={state.devices.filter((device) => device.online).length} note={`${state.devices.length} registered`} icon={Cpu} />
      <Metric label="Camera interval" value={`${state.settings.cameraIntervalSeconds}s`} note="Returned to ESP32 on heartbeat" icon={Camera} />
      <Metric label="Total observed" value={state.totalVehiclesToday} note="Accumulated accepted count updates" icon={Car} />
      <Metric label="Backend uptime" value={`${Math.floor(state.server.uptimeSeconds / 60)}m`} note={`Persistence: ${state.server.persistence}`} icon={Clock3} />
    </div>
    <div className="mt-5"><OperationControl /></div>
    <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-bold text-[#173b2f]">Live intersection</h2><p className="text-xs text-muted">Signal timing changes when real counts change.</p></div><Link href="/simulator"><Button variant="secondary">Open controls</Button></Link></div><IntersectionMini state={state} /></Card>
      <div className="space-y-5">
        <Card className="p-5"><div className="flex items-center justify-between"><div><h2 className="font-bold text-[#173b2f]">Lane measurements</h2><p className="text-xs text-muted">Source identifies how each count was obtained.</p></div><Link href="/settings"><Button variant="ghost"><Settings size={16} /> Configure</Button></Link></div><div className="mt-4 space-y-3">{(["lane1","lane2","lane3","lane4"] as LaneKey[]).map((lane, i) => <div key={lane} className="rounded-xl border border-border p-3"><div className="flex items-center justify-between"><strong className="text-sm text-[#173b2f]">Lane {i + 1}</strong><span className="text-sm font-bold">{state.lanes[lane]} vehicles</span></div><div className="mt-2 h-2 rounded-full bg-[#e7ede9]"><div className="h-full rounded-full bg-primary" style={{ width: `${state.laneDensity[lane]}%` }} /></div><div className="mt-2 flex justify-between text-[10px] text-muted"><span>{state.laneSources[lane]}</span><span>{state.laneDensity[lane]}% density · {state.timings[lane]}s green</span></div></div>)}</div></Card>
        <Card className="p-5"><h2 className="font-bold text-[#173b2f]">Latest camera analysis</h2>{state.lastDetection ? <div className="mt-4 overflow-hidden rounded-xl border border-border"><img src={state.lastDetection.annotatedImage} alt="Latest detection" className="w-full" /><div className="p-3 text-sm"><strong>{state.lastDetection.vehicleCount} vehicles</strong><span className="ml-2 text-muted">Lane {state.lastDetection.lane.slice(-1)} · {state.lastDetection.inferenceMs} ms</span></div></div> : <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No image analyzed since this server started. Upload one from Intersection & vision or send one from an ESP32.</div>}</Card>
      </div>
    </div>
  </>;
}
