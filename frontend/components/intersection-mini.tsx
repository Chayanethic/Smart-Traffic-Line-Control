"use client";
import type { LaneKey, TrafficState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SignalOrb } from "./signal-orb";

const positions: Record<LaneKey, string> = { lane1: "left-1/2 top-4 -translate-x-1/2", lane2: "right-4 top-1/2 -translate-y-1/2", lane3: "bottom-4 left-1/2 -translate-x-1/2", lane4: "left-4 top-1/2 -translate-y-1/2" };
export function IntersectionMini({ state }: { state: TrafficState }) {
  return <div className="grid-bg relative mx-auto aspect-square w-full max-w-[430px] overflow-hidden rounded-2xl border border-border bg-[#e8efe9]">
    <div className="absolute left-[35%] top-0 h-full w-[30%] bg-[#58645f]"><div className="absolute left-1/2 h-full border-l-2 border-dashed border-white/60" /></div>
    <div className="absolute left-0 top-[35%] h-[30%] w-full bg-[#58645f]"><div className="absolute top-1/2 w-full border-t-2 border-dashed border-white/60" /></div>
    <div className="absolute left-[35%] top-[35%] h-[30%] w-[30%] bg-[#4d5954]" />
    {(["lane1","lane2","lane3","lane4"] as LaneKey[]).map((lane, index) => { const active = state.currentLane === lane; return <div key={lane} className={cn("absolute z-10 flex items-center gap-2 rounded-xl border px-2.5 py-2 shadow-sm", positions[lane], active ? "border-emerald-300 bg-emerald-50" : "border-border bg-white")}><SignalOrb color={active && state.phase === "YELLOW" ? "yellow" : active ? "green" : "red"} active size="sm" /><div><div className="text-[9px] uppercase tracking-wider text-muted">Lane {index + 1}</div><div className="text-xs font-bold text-[#173b2f]">{state.lanes[lane]} vehicles</div><div className="text-[9px] text-muted">{state.laneSources[lane]}</div></div></div>; })}
    <div className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-white px-5 py-3 text-center shadow-xl"><div className="text-3xl font-black tabular-nums text-[#173b2f]">{state.timer}</div><div className={cn("text-[9px] font-bold tracking-[.2em]", state.phase === "GREEN" ? "text-emerald-600" : state.phase === "YELLOW" ? "text-amber-600" : "text-red-600")}>{state.phase}</div></div>
  </div>;
}
