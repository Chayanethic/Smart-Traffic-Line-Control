"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Ambulance, BarChart3, Bell, BookOpen, Bot, CheckCheck, Cpu, Gauge, Menu, Radio, Settings, TrafficCone, X } from "lucide-react";
import { useState } from "react";
import { useTraffic } from "./traffic-provider";
import { Badge, Button } from "./ui";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Overview", icon: Gauge }, { href: "/simulator", label: "Intersection & vision", icon: TrafficCone },
  { href: "/hardware", label: "Hardware", icon: Cpu }, { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/emergency", label: "Emergency", icon: Ambulance }, { href: "/device-setup", label: "Device setup", icon: Bot },
  { href: "/installation", label: "Installation", icon: BookOpen }, { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { state, connected, feedback, clearFeedback } = useTraffic();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  return <div className="min-h-screen">
    {open && <button className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setOpen(false)} />}
    <aside className={cn("fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#d8e3dc] bg-[#183c30] text-white transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full")}>
      <div className="flex h-20 items-center gap-3 border-b border-white/10 px-5"><div className="grid h-10 w-10 place-items-center rounded-xl bg-white text-primary"><Radio size={22} /></div><div><div className="font-black">STCS</div><div className="text-[10px] uppercase tracking-[.18em] text-emerald-100/60">Traffic Operations</div></div><button className="ml-auto lg:hidden" onClick={() => setOpen(false)}><X /></button></div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">{links.map(({ href, label, icon: Icon }) => { const active = href === "/" ? path === "/" : path.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition", active ? "bg-white text-[#183c30]" : "text-emerald-50/70 hover:bg-white/10 hover:text-white")}><Icon size={18} />{label}{href === "/emergency" && state?.emergencyLane && <span className="ml-auto h-2 w-2 animate-pulse rounded-full bg-red-400" />}</Link>; })}</nav>
      <div className="m-4 rounded-xl bg-white/10 p-3 text-xs"><div className="flex items-center gap-2 font-semibold"><span className={cn("h-2 w-2 rounded-full", connected ? "bg-emerald-300" : "bg-amber-300")} />{connected ? "Server connected" : "Server disconnected"}</div><p className="mt-2 text-emerald-50/60">Storage: {state?.server?.persistence || "checking"}</p></div>
    </aside>
    <div className="lg:pl-64">
      <header className="sticky top-0 z-30 flex h-20 items-center border-b border-border bg-white/90 px-4 backdrop-blur sm:px-7"><Button variant="ghost" className="w-11 p-0 lg:hidden" onClick={() => setOpen(true)}><Menu /></Button><div className="hidden sm:block"><p className="text-sm font-semibold text-[#173b2f]">Primary intersection</p><p className="text-xs text-muted">Real-time traffic management</p></div><div className="ml-auto flex items-center gap-2"><Badge className={connected ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}><Activity size={12} />{connected ? "LIVE" : "OFFLINE"}</Badge><button aria-label="Open notifications" onClick={() => setNotificationsOpen((value) => !value)} className="relative grid h-11 w-11 place-items-center rounded-xl border border-border bg-white text-muted hover:bg-[#f1f6f3]"><Bell size={18} />{state?.notifications?.length ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" /> : null}</button></div></header>
      {notificationsOpen && <div className="animate-slide-in fixed right-4 top-24 z-50 w-[calc(100vw-2rem)] max-w-sm overflow-hidden rounded-2xl border border-border bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-border p-4"><div><h2 className="font-bold text-[#173b2f]">Notifications</h2><p className="text-xs text-muted">Hardware and emergency events</p></div><button onClick={() => setNotificationsOpen(false)} className="rounded-lg p-2 text-muted hover:bg-[#eef4f0]"><X size={18} /></button></div><div className="max-h-96 overflow-y-auto p-3">{state?.notifications?.length ? state.notifications.map((item) => <div key={item.id} className="mb-2 rounded-xl border border-border p-3 last:mb-0"><strong className="text-sm text-[#173b2f]">{item.title}</strong><p className="mt-1 text-xs leading-5 text-muted">{item.message}</p><p className="mt-2 text-[10px] text-[#8b9993]">{new Date(item.createdAt).toLocaleString()}</p></div>) : <div className="p-8 text-center"><CheckCheck className="mx-auto text-emerald-500" /><p className="mt-3 text-sm font-semibold">All clear</p><p className="text-xs text-muted">No notifications in this session.</p></div>}</div></div>}
      {feedback && <button onClick={clearFeedback} className={cn("animate-slide-in fixed right-5 top-24 z-[60] max-w-sm rounded-xl border p-4 text-left text-sm shadow-lg", feedback.type === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>{feedback.message}</button>}
      <main className="p-4 sm:p-7">{children}</main>
    </div>
  </div>;
}
