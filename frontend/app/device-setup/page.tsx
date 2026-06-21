"use client";
import { useState } from "react";
import { Copy, KeyRound, Plus } from "lucide-react";
import { useTraffic } from "@/components/traffic-provider";
import { Button, Card, Input, SectionTitle } from "@/components/ui";

export default function DeviceSetupPage() {
  const { state, busy, registerDevice } = useTraffic();
  const [form, setForm] = useState({ deviceId: "", junctionName: "", location: "", firmwareVersion: "1.0.0", cameraModel: "OV7670" });
  const [apiKey, setApiKey] = useState("");
  const submit = async () => { const result = await registerDevice(form); setApiKey(result.apiKey); };
  return <>
    <SectionTitle title="ESP32 Device Registration" description="Register hardware and generate the credential used for heartbeat and camera uploads." />
    <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
      <Card className="p-6"><div className="grid gap-4 sm:grid-cols-2">{Object.entries(form).map(([key,value]) => <label key={key} className="text-xs font-semibold capitalize text-[#40564d]">{key.replace(/([A-Z])/g," $1")}<Input className="mt-2" value={value} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /></label>)}</div><Button className="mt-5" disabled={busy === "device" || !form.deviceId || !form.junctionName} onClick={submit}><Plus size={16} />{busy === "device" ? "Registering…" : "Register ESP32"}</Button>
        {apiKey && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><div className="flex items-center gap-2 font-semibold text-amber-900"><KeyRound size={17} /> Copy this API key now</div><div className="mt-3 flex gap-2"><Input readOnly value={apiKey} className="font-mono text-xs" /><Button variant="secondary" onClick={() => navigator.clipboard.writeText(apiKey)}><Copy size={16} /></Button></div><p className="mt-2 text-xs text-amber-700">Only the SHA-256 hash is retained by the server.</p></div>}
      </Card>
      <div className="space-y-5">
        <Card className="p-5"><h2 className="font-bold text-[#173b2f]">Registered devices</h2><div className="mt-4 space-y-3">{state?.devices.length ? state.devices.map((device) => <div key={device.deviceId} className="rounded-xl border border-border p-4"><div className="flex justify-between"><strong>{device.deviceId}</strong><span className={device.online ? "text-emerald-600" : "text-red-600"}>{device.online ? "Online" : "Offline"}</span></div><p className="mt-1 text-xs text-muted">{device.junctionName} · {device.cameraModel} · firmware {device.firmwareVersion}</p><p className="mt-2 text-[11px] text-muted">{device.lastHeartbeat ? `Last heartbeat ${new Date(device.lastHeartbeat).toLocaleString()}` : "Waiting for first authenticated heartbeat"}</p></div>) : <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">No ESP32 devices registered.</p>}</div></Card>
        <Card className="p-5"><h2 className="font-bold text-[#173b2f]">Put these values in the firmware</h2><div className="mt-4 rounded-xl bg-[#102b22] p-4 font-mono text-xs leading-6 text-emerald-50">API_BASE_URL = your Render backend URL<br />DEVICE_ID = the registered Device ID<br />API_KEY = the one-time key shown after registration<br />CAMERA_LANE = lane1, lane2, lane3, or lane4</div><p className="mt-3 text-xs leading-5 text-muted">Every heartbeat and image upload must include the headers <code>X-Device-ID</code> and <code>X-API-Key</code>. Open Installation for the complete pin-by-pin wiring table.</p></Card>
      </div>
    </div>
  </>;
}
