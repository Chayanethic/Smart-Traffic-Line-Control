"use client";

import { useEffect, useState } from "react";
import { CircleStop, Pause, Play, TimerReset } from "lucide-react";
import { useTraffic } from "./traffic-provider";
import { Badge, Button, Card, Spinner } from "./ui";

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;
  return [hours, minutes, remaining].map((value) => String(value).padStart(2, "0")).join(":");
}

export function OperationControl() {
  const { state, busy, controlOperation } = useTraffic();
  const [now, setNow] = useState(Date.now());
  const status = state?.operation.status || "stopped";

  useEffect(() => {
    if (status !== "running") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [status]);

  if (!state) return null;
  const elapsed = state.operation.startedAt
    ? Math.max(0, Math.floor((now - new Date(state.operation.startedAt).getTime() - state.operation.accumulatedPausedMs) / 1000))
    : 0;

  return <Card className="p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#e8f2ed] text-primary"><TimerReset size={21} /></span>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="font-bold text-[#173b2f]">Traffic operation</h2>
          <Badge className={status === "running" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : status === "paused" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{status.toUpperCase()}</Badge>
        </div>
        <p className="mt-1 text-xs text-muted">{state.operation.startedAt ? `Started ${new Date(state.operation.startedAt).toLocaleString()} · active ${formatDuration(elapsed)}` : "Start a session to begin the traffic signal timeline."}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy === "operation" || status === "running"} onClick={() => controlOperation("start")}>{busy === "operation" ? <Spinner /> : <Play size={16} />}{status === "paused" ? "Resume" : "Start"}</Button>
        <Button variant="secondary" disabled={busy === "operation" || status !== "running"} onClick={() => controlOperation("pause")}><Pause size={16} /> Pause</Button>
        <Button variant="danger" disabled={busy === "operation" || status === "stopped"} onClick={() => controlOperation("stop")}><CircleStop size={16} /> Stop</Button>
      </div>
    </div>
    <div className="mt-5 border-t border-border pt-4">
      <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Saved operating timeline</h3>
      <div className="mt-3 space-y-2">
        {state.recentSessions.length ? state.recentSessions.slice(0, 6).map((session) => <div key={session.id} className="flex flex-col justify-between gap-1 rounded-xl border border-border bg-[#fafcfb] p-3 text-xs sm:flex-row sm:items-center"><span className="font-semibold text-[#173b2f]">{new Date(session.startedAt).toLocaleDateString()} · {new Date(session.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} to {new Date(session.endedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span><span className="text-muted">{formatDuration(session.durationSeconds)} active · {session.vehiclesObserved} observed</span></div>) : <p className="rounded-xl border border-dashed border-border p-5 text-center text-xs text-muted">No completed operating sessions yet.</p>}
      </div>
    </div>
  </Card>;
}
