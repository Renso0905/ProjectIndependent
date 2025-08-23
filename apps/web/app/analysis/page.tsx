"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import type { Client, Behavior, Skill, DatedPoint as Point } from "../../lib/types";

type BehaviorMeta = { id: number; name: string; method: string };
type SkillMeta = { id: number; name: string; method: string; skill_type?: string };

export default function AnalysisPage() {
  // ---- Data sources ----
  const [clients, setClients] = useState<Client[]>([]);
  const [behaviors, setBehaviors] = useState<Behavior[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);

  // ---- Selections ----
  const [clientId, setClientId] = useState<number | "">("");
  const [behaviorId, setBehaviorId] = useState<number | "">("");
  const [skillId, setSkillId] = useState<number | "">("");

  // ---- Analysis state ----
  const [points, setPoints] = useState<Point[]>([]);
  const [behaviorMeta, setBehaviorMeta] = useState<BehaviorMeta | null>(null);
  const [skillMeta, setSkillMeta] = useState<SkillMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Track component mount to avoid setState after unmount
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Load clients once
  useEffect(() => {
    let ignore = false;
    api.clients
      .list()
      .then((cs) => {
        if (!ignore && mounted.current) setClients(cs);
      })
      .catch(() => {
        if (!ignore && mounted.current) setClients([]);
      });
    return () => {
      ignore = true;
    };
  }, []);

  // When client changes: fetch behaviors & skills (cancelable)
  useEffect(() => {
    // Reset view in one pass
    setBehaviors([]);
    setBehaviorId("");
    setBehaviorMeta(null);
    setSkills([]);
    setSkillId("");
    setSkillMeta(null);
    setPoints([]);
    setErrMsg(null);

    if (!clientId) return;

    const ac = new AbortController();
    const { signal } = ac;

    Promise.all([
      api.clients.behaviors(Number(clientId)),
      api.clients.skills(Number(clientId)),
    ])
      .then(([bs, ss]) => {
        if (signal.aborted || !mounted.current) return;
        setBehaviors(bs);
        setSkills(ss);
      })
      .catch(() => {
        if (signal.aborted || !mounted.current) return;
        setBehaviors([]);
        setSkills([]);
      });

    return () => ac.abort();
  }, [clientId]);

  // Fetch analysis when a behavior or skill is selected (cancelable)
  useEffect(() => {
    // Clear current graph state in one shot
    setPoints([]);
    setErrMsg(null);
    setBehaviorMeta(null);
    setSkillMeta(null);

    const hasBehavior = !!behaviorId;
    const hasSkill = !!skillId;

    if (!hasBehavior && !hasSkill) return;

    const ac = new AbortController();
    const { signal } = ac;

    async function run() {
      setLoading(true);
      try {
        if (hasBehavior) {
          const data = await api.analysis.behavior(Number(behaviorId));
          if (signal.aborted || !mounted.current) return;
          setBehaviorMeta(data.behavior);
          const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
          return;
        }
        if (hasSkill) {
          const data = await api.analysis.skill(Number(skillId));
          if (signal.aborted || !mounted.current) return;
          setSkillMeta(data.skill);
          const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
          return;
        }
      } catch (e: any) {
        if (signal.aborted || !mounted.current) return;
        const status = e?.status;
        setErrMsg(
          status === 403
            ? "Access denied: Analysis is BCBA-only."
            : status ? `Error ${status}: Failed to load analysis.` : "Failed to load analysis."
        );
      } finally {
        if (!signal.aborted && mounted.current) setLoading(false);
      }
    }

    run();
    return () => ac.abort();
  }, [behaviorId, skillId]);

  // Exclusive selection handlers (avoid effect churn)
  function onBehaviorChange(v: string) {
    const id = v ? Number(v) : "";
    setBehaviorId(id);
    if (id !== "") setSkillId("");
  }
  function onSkillChange(v: string) {
    const id = v ? Number(v) : "";
    setSkillId(id);
    if (id !== "") setBehaviorId("");
  }

  const isSkill = !!skillMeta;
  const yDomain = useMemo<[number, number]>(() => {
    if (isSkill) return [0, 100];
    if (!points || points.length === 0) return [0, 1];
    const max = Math.max(...points.map((p) => p.value ?? 0));
    return [0, max === 0 ? 1 : Math.ceil(max * 1.1)];
  }, [points, isSkill]);

  const subtitle =
    behaviorMeta
      ? `${behaviorMeta.name} — ${behaviorMeta.method}`
      : skillMeta
      ? `${skillMeta.skill_type ?? ""}${skillMeta.skill_type ? " - " : ""}${skillMeta.name} — ${skillMeta.method}`
      : "Select a behavior or skill";

  return (
    <main className="min-h-screen p-6 space-y-4">
      <a className="underline" href="/dashboard/bcba">
        ← Back to BCBA Dashboard
      </a>

      <h1 className="text-2xl font-semibold">Data Analysis</h1>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <div className="text-sm mb-1">Client</div>
          <select
            className="w-full border rounded px-3 py-2"
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
        </label>

        <label className="block">
          <div className="text-sm mb-1">Behavior</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={behaviorId}
            onChange={(e) => onBehaviorChange(e.target.value)}
            disabled={!clientId}
          >
            <option value="">-- choose behavior --</option>
            {behaviors.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · {b.method}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-sm mb-1">Skill</div>
          <select
            className="w-full border rounded px-3 py-2"
            value={skillId}
            onChange={(e) => onSkillChange(e.target.value)}
            disabled={!clientId}
          >
            <option value="">-- choose skill --</option>
            {skills.map((s) => (
              <option key={s.id} value={s.id}>
                {s.skill_type} - {s.name} · {s.method}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="text-sm text-gray-600">{subtitle}</div>

      {loading && <p>Loading…</p>}
      {errMsg && !loading && <p className="text-red-500">{errMsg}</p>}

      {(behaviorMeta || skillMeta) && points.length === 0 && !loading && !errMsg && (
        <p>No data yet for this selection.</p>
      )}

      {points.length > 0 && !errMsg && (
        <div className="w-full">
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={points}>
              <CartesianGrid stroke="#374151" />
              <XAxis dataKey="date" stroke="#e5e7eb" />
              <YAxis domain={yDomain} stroke="#e5e7eb" />
              <Tooltip
                contentStyle={{
                  background: "#111827",
                  borderColor: "#374151",
                  color: "#e5e7eb",
                }}
              />
              <Line type="monotone" dataKey="value" stroke="#60a5fa" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {process.env.NODE_ENV !== "production" && !errMsg && (
        <details className="mt-4">
          <summary className="cursor-pointer">Debug</summary>
          <pre className="text-xs mt-2 p-3 bg-gray-900 text-gray-100 rounded">
            {JSON.stringify({ behaviorMeta, skillMeta, pointsCount: points.length }, null, 2)}
          </pre>
        </details>
      )}
    </main>
  );
}
