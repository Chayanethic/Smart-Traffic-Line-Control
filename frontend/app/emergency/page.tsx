"use client";
import { AlertTriangle, Ambulance, Check } from "lucide-react";
import { useTraffic } from "@/components/traffic-provider";
import { Badge, Button, Card, SectionTitle } from "@/components/ui";
import type { LaneKey } from "@/lib/types";

export default function EmergencyPage() {
  const { state, busy, triggerEmergency, clearEmergency } = useTraffic();
  if (!state) return <p>Loading emergency controls…</p>;
  const lanes: LaneKey[] = ["lane1","lane2","lane3","lane4"];
  return <>
    <SectionTitle title="Emergency Signal Priority" description="This command is sent to the backend, logged, broadcast in real time, and returned to the ESP32 signal controller." action={<Badge className={state.emergencyLane ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}>{state.emergencyLane ? "PRIORITY ACTIVE" : "NORMAL OPERATION"}</Badge>} />
    {state.emergencyLane && <Card className="mb-5 border-red-200 bg-red-50 p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><AlertTriangle className="text-red-600" /><div className="flex-1"><strong className="text-red-900">Lane {state.emergencyLane.slice(-1)} has green priority</strong><p className="text-sm text-red-700">Normal cycle is paused with {state.timer}s remaining.</p></div><Button variant="danger" disabled={busy === "emergency"} onClick={clearEmergency}><Check size={16} /> Clear & resume</Button></div></Card>}
    <div className="grid gap-4 sm:grid-cols-2">{lanes.map((lane, i) => <Card key={lane} className="p-5"><Ambulance className="text-primary" /><h2 className="mt-4 font-bold text-[#173b2f]">Lane {i + 1}</h2><p className="mt-1 text-sm text-muted">Immediately switch this approach to green for {state.settings.emergencyDuration} seconds.</p><Button className="mt-5 w-full" variant={state.emergencyLane === lane ? "danger" : "secondary"} disabled={busy === "emergency" || Boolean(state.emergencyLane)} onClick={() => triggerEmergency(lane)}>{state.emergencyLane === lane ? "Currently active" : `Activate Lane ${i + 1}`}</Button></Card>)}</div>
    <Card className="mt-5 p-5"><h2 className="font-bold text-[#173b2f]">Recent events</h2><div className="mt-3 space-y-2">{state.notifications.filter((item) => item.type === "emergency").length ? state.notifications.filter((item) => item.type === "emergency").map((item) => <div key={item.id} className="rounded-xl border border-border p-3 text-sm"><strong>{item.title}</strong><p className="text-muted">{item.message}</p></div>) : <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">No emergency events in this server session.</p>}</div></Card>
  </>;
}
