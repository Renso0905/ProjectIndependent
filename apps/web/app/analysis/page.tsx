"use client";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

type Client = { id: number; name: string; birthdate: string };
type Behavior = { id: number; client_id: number; name: string; method: "FREQUENCY"|"DURATION"|"MTS"|"INTERVAL"; settings: any };
type Point = { date: string; value: number; session_count?: number };
type BehaviorMeta = { id: number; name: string; method: string };

export default function AnalysisPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | "">("");
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [behaviorId, setBehaviorId] = useState<number | "">("");
  const [points, setPoints] = useState<Point[]>([]);
  const [behaviorMeta, setBehaviorMeta] = useState<BehaviorMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<any>(null); // optional: raw payload

  useEffect(() => {
    fetch(`${API_BASE}/collect/clients`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    setBehaviors([]);
    setBehaviorId("");
    setPoints([]);
    setBehaviorMeta(null);
    if (!clientId) return;

    fetch(`${API_BASE}/collect/clients/${clientId}/behaviors`, { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setBehaviors)
      .catch(() => setBehaviors([]));
  }, [clientId]);

  useEffect(() => {
    setPoints([]);
    setBehaviorMeta(null);
    setDebug(null);
    if (!behaviorId) return;
    setLoading(true);
    fetch(`${API_BASE}/analysis/behavior/${behaviorId}/session-points`, { credentials: "include" })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text();
          throw new Error(`Analysis ${r.status}: ${txt}`);
        }
        return r.json();
      })
      .then((data) => {
        setDebug(data);
        setBehaviorMeta(data.behavior);
        const ps: Point[] = (data.points || []).sort((a: Point, b: Point) =>
          a.date.localeCompare(b.date)
        );
        setPoints(ps);
      })
      .catch((e) => console.warn(e))
      .finally(() => setLoading(false));
  }, [behaviorId]);

  // Y domain that still shows a dot/line if all values are 0 or there is only one point
  const yDomain = useMemo<[number, number]>(() => {
    if (!points || points.length === 0) return [0, 1];
    const max = Math.max(...points.map(p => p.value ?? 0));
    return [0, max === 0 ? 1 : Math.ceil(max * 1.1)];
  }, [points]);

  const yLabel =
    behaviorMeta?.method === "DURATION"
      ? "Seconds (per date)"
      : behaviorMeta?.method === "FREQUENCY"
      ? "Count (per date)"
      : "Hits (per date)";

  // colors for dark bg
  const axisStroke = "#e5e7eb";   // gray-200
  const axisTick = "#e5e7eb";
  const gridStroke = "#374151";   // gray-700
  const lineStroke = "#60a5fa";   // blue-400
  const tooltipBg = "#111827";    // gray-900
  const tooltipBorder = "#374151";
  const tooltipText = "#e5e7eb";

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Analysis</h1>
        <a className="text-sm underline" href="/dashboard/bcba">← Back to BCBA Dashboard</a>
      </header>

      <section className="grid md:grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 space-y-2">
          <label className="text-sm">Client</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={clientId}
            onChange={e => setClientId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">-- choose client --</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} (DOB {c.birthdate})
              </option>
            ))}
          </select>
        </div>
        <div className="border rounded-xl p-4 space-y-2">
          <label className="text-sm">Behavior</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={behaviorId}
            onChange={e => setBehaviorId(e.target.value ? Number(e.target.value) : "")}
            disabled={!clientId}
          >
            <option value="">-- choose behavior --</option>
            {behaviors.map(b => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.method}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">
            {behaviorMeta ? `${behaviorMeta.name} — ${behaviorMeta.method}` : "Select a behavior"}
          </div>
          <div className="text-sm text-gray-400">{loading ? "Loading…" : null}</div>
        </div>

        {/* Helpful message if no points */}
        {behaviorMeta && points.length === 0 && !loading && (
          <p className="text-gray-400 text-sm">No data yet for this behavior.</p>
        )}

        {/* Chart */}
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke={axisStroke} tick={{ fill: axisTick }} />
              <YAxis
                domain={yDomain}
                stroke={axisStroke}
                tick={{ fill: axisTick }}
                label={{ value: yLabel, angle: -90, position: "insideLeft", fill: axisTick }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: tooltipBg, borderColor: tooltipBorder, color: tooltipText }}
                labelStyle={{ color: tooltipText }}
                itemStyle={{ color: tooltipText }}
              />
              <Line type="monotone" dataKey="value" stroke={lineStroke} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Optional debug (only useful during dev) */}
        {process.env.NODE_ENV !== "production" && debug && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-gray-400">Debug payload</summary>
            <pre className="text-xs whitespace-pre-wrap opacity-70">
              {JSON.stringify(debug, null, 2)}
            </pre>
          </details>
        )}
      </section>
    </main>
  );
}
