"use client";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "../../lib/api";

type Client = { id: number; name: string; birthdate: string };

// Behaviors
type Behavior = {
  id: number;
  client_id: number;
  name: string;
  method: "FREQUENCY" | "DURATION" | "MTS" | "INTERVAL";
  settings: any;
};
type BehaviorMeta = { id: number; name: string; method: string };

// Skills (with skill_type)
type Skill = { id: number; client_id: number; name: string; method: "PERCENTAGE"; skill_type: string };
type SkillMeta = { id: number; name: string; method: string; skill_type?: string };

type Point = { date: string; value: number; session_count?: number };

export default function AnalysisPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | "">("");

  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [behaviorId, setBehaviorId] = useState<number | "">("");
  const [behaviorMeta, setBehaviorMeta] = useState<BehaviorMeta | null>(null);

  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillId, setSkillId] = useState<number | "">("");
  const [skillMeta, setSkillMeta] = useState<SkillMeta | null>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<any>(null);

  useEffect(() => {
    api.clients.list().then(setClients).catch(() => setClients([]));
  }, []);

  useEffect(() => {
    setBehaviors([]); setBehaviorId(""); setBehaviorMeta(null);
    setSkills([]); setSkillId(""); setSkillMeta(null);
    setPoints([]); setDebug(null);
    if (!clientId) return;

    api.clients.behaviors(Number(clientId)).then(setBehaviors).catch(() => setBehaviors([]));
    api.clients.skills(Number(clientId)).then(setSkills).catch(() => setSkills([]));
  }, [clientId]);

  useEffect(() => {
    setPoints([]); setDebug(null); setBehaviorMeta(null); setSkillMeta(null);

    async function go() {
      if (behaviorId) {
        setLoading(true);
        try {
          const data = await api.analysis.behavior(Number(behaviorId));
          setDebug(data);
          setBehaviorMeta(data.behavior);
          const ps = (data.points || []).sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(ps);
        } finally {
          setLoading(false);
        }
        return;
      }

      if (skillId) {
        setLoading(true);
        try {
          const data = await api.analysis.skill(Number(skillId));
          setDebug(data);
          setSkillMeta(data.skill);
          const ps = (data.points || []).sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(ps);
        } finally {
          setLoading(false);
        }
        return;
      }
    }

    go();
  }, [behaviorId, skillId]);

  const isSkill = !!skillMeta;
  const yDomain = useMemo<[number, number]>(() => {
    if (isSkill) return [0, 100];
    if (!points || points.length === 0) return [0, 1];
    const max = Math.max(...points.map((p) => p.value ?? 0));
    return [0, max === 0 ? 1 : Math.ceil(max * 1.1)];
  }, [points, isSkill]);

  const yLabel = isSkill
    ? "Percent correct (%)"
    : behaviorMeta?.method === "DURATION"
    ? "Seconds (per date)"
    : behaviorMeta?.method === "FREQUENCY"
    ? "Count (per date)"
    : "Hits (per date)";

  const axisStroke = "#e5e7eb";
  const axisTick = "#e5e7eb";
  const gridStroke = "#374151";
  const lineStroke = "#60a5fa";
  const tooltipBg = "#111827";
  const tooltipBorder = "#374151";
  const tooltipText = "#e5e7eb";

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Analysis</h1>
        <a className="text-sm underline" href="/dashboard/bcba">← Back to BCBA Dashboard</a>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4 space-y-2">
          <label className="text-sm">Client</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={clientId}
            onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
          >
            <option value="">-- choose client --</option>
            {clients.map((c) => (
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
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setBehaviorId(v);
              if (v !== "") setSkillId("");
            }}
            disabled={!clientId}
          >
            <option value="">-- choose behavior --</option>
            {behaviors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.method}
              </option>
            ))}
          </select>
        </div>

        <div className="border rounded-xl p-4 space-y-2">
          <label className="text-sm">Skill</label>
          <select
            className="w-full border rounded px-3 py-2 bg-transparent"
            value={skillId}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setSkillId(v);
              if (v !== "") setBehaviorId("");
            }}
            disabled={!clientId}
          >
            <option value="">-- choose skill --</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.skill_type} - {s.name} · {s.method}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section className="border rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="font-semibold">
            {behaviorMeta
              ? `${behaviorMeta.name} — ${behaviorMeta.method}`
              : skillMeta
              ? `${skillMeta.skill_type ?? ""}${skillMeta.skill_type ? " - " : ""}${skillMeta.name} — ${skillMeta.method}`
              : "Select a behavior or skill"}
          </div>
          <div className="text-sm text-gray-400">{loading ? "Loading…" : null}</div>
        </div>

        {(behaviorMeta || skillMeta) && points.length === 0 && !loading && (
          <p className="text-gray-400 text-sm">No data yet for this selection.</p>
        )}

        <div style={{ width: "100%", height: 320 }}>
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
