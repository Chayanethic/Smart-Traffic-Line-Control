"use client";
import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { API_URL, useTraffic } from "@/components/traffic-provider";
import { Card, SectionTitle } from "@/components/ui";

type RecordItem = { createdAt: string; total?: number; source?: string; lane?: string; status?: string };
export default function AnalyticsPage() {
  const { state } = useTraffic();
  const [traffic, setTraffic] = useState<RecordItem[]>([]);
  const [emergencies, setEmergencies] = useState<RecordItem[]>([]);
  useEffect(() => { fetch(`${API_URL}/api/analytics`).then((response) => response.json()).then((data) => { setTraffic(data.traffic || []); setEmergencies(data.emergencies || []); }); }, []);
  const chart = [...traffic].reverse().slice(-20).map((item) => ({ time: new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), vehicles: item.total || 0 }));
  return <>
    <SectionTitle title="Measured Analytics" description="Charts are built only from accepted manual or camera count events." />
    <div className="grid gap-3 sm:grid-cols-3"><Card className="p-5"><p className="text-xs text-muted">Count updates</p><p className="mt-2 text-3xl font-black text-[#173b2f]">{traffic.length}</p></Card><Card className="p-5"><p className="text-xs text-muted">Vehicles observed</p><p className="mt-2 text-3xl font-black text-[#173b2f]">{state?.totalVehiclesToday || 0}</p></Card><Card className="p-5"><p className="text-xs text-muted">Emergency events</p><p className="mt-2 text-3xl font-black text-[#173b2f]">{emergencies.length}</p></Card></div>
    <Card className="mt-5 p-5"><h2 className="font-bold text-[#173b2f]">Recent traffic measurements</h2>{chart.length ? <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid stroke="#dbe5df" vertical={false} /><XAxis dataKey="time" tick={{ fontSize: 10 }} /><YAxis /><Tooltip /><Bar dataKey="vehicles" fill="#13795b" radius={[5,5,0,0]} /></BarChart></ResponsiveContainer></div> : <div className="mt-4 rounded-xl border border-dashed border-border p-12 text-center text-sm text-muted">No measurements yet. Add manual counts or analyze a traffic image.</div>}</Card>
    <Card className="mt-5 p-5"><h2 className="font-bold text-[#173b2f]">Data audit trail</h2><div className="mt-3 space-y-2">{traffic.slice(0,30).map((item, index) => <div key={`${item.createdAt}-${index}`} className="flex justify-between rounded-xl border border-border p-3 text-sm"><span>{item.source || "unknown source"}</span><span className="text-muted">{item.total || 0} vehicles · {new Date(item.createdAt).toLocaleString()}</span></div>)}</div></Card>
  </>;
}
