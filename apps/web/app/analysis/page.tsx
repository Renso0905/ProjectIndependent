// apps/web/app/analysis/page.tsx
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
import type {
  Client,
  Behavior,
  Skill,
  DatedPoint as Point,
  SessionSummary,
  SessionDetails,
} from "../../lib/types";

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
          // Handle either shape:
          // 1) { behavior, points }  (your original)
          // 2) Point[]               (simple array)
          const data: any = await api.analysis.behavior(Number(behaviorId));
          if (signal.aborted || !mounted.current) return;

          if (Array.isArray(data)) {
            // Build meta from the selected Behavior if API returns array
            const b = behaviors.find((x) => x.id === Number(behaviorId));
            setBehaviorMeta(b ? { id: b.id, name: b.name, method: b.method } : null);
            const sorted = data.slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
            setPoints(sorted);
          } else {
            setBehaviorMeta(data.behavior ?? null);
            const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
            setPoints(sorted);
          }
          return;
        }
        if (hasSkill) {
          const data: any = await api.analysis.skill(Number(skillId));
          if (signal.aborted || !mounted.current) return;

          if (Array.isArray(data)) {
            const s = skills.find((x) => x.id === Number(skillId));
            setSkillMeta(s ? { id: s.id, name: s.name, method: s.method, skill_type: s.skill_type } : null);
            const sorted = data.slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
            setPoints(sorted);
          } else {
            setSkillMeta(data.skill ?? null);
            const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
            setPoints(sorted);
          }
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
  }, [behaviorId, skillId, behaviors, skills]);

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

  // =========================
  // Session Manager (NEW)
  // =========================
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [filterClientIdText, setFilterClientIdText] = useState<string>(""); // optional filter
  const [sessionsBusy, setSessionsBusy] = useState(false);
  const [sessionsErr, setSessionsErr] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [details, setDetails] = useState<Record<number, SessionDetails>>({});

  // Default to last 14 days
  useEffect(() => {
    const today = new Date();
    const prior = new Date(today);
    prior.setDate(prior.getDate() - 14);
    setDateFrom(prior.toISOString().slice(0, 10));
    setDateTo(today.toISOString().slice(0, 10));
  }, []);

  async function loadSessions() {
    setSessionsBusy(true);
    setSessionsErr(null);
    try {
      const list = await api.sessions.list({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        client_id: filterClientIdText ? Number(filterClientIdText) : undefined,
      });
      setSessions(list);
    } catch (e: any) {
      setSessionsErr(e?.message || "Failed to load sessions");
    } finally {
      setSessionsBusy(false);
    }
  }

  async function toggleExpand(id: number) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
    if (!details[id]) {
      try {
        const d = await api.sessions.details(id);
        setDetails((prev) => ({ ...prev, [id]: d }));
      } catch (e: any) {
        setSessionsErr(e?.message || "Failed to load session details");
      }
    }
  }

  async function onDeleteSession(id: number) {
    if (!confirm("Delete this entire session and all its data?")) return;
    try {
      await api.sessions.delete(id);
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setDetails((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      // Optional: if the chart shows a target affected by this session, refresh
      await refreshChartIfAffected();
    } catch (e: any) {
      alert(e?.message || "Failed to delete session");
    }
  }

  async function onDeleteBehaviorEvent(sessionId: number, eventId: number) {
    if (!confirm("Delete this behavior event?")) return;
    try {
      await api.sessions.deleteBehaviorEvent(eventId);
      setDetails((prev) => {
        const d = prev[sessionId];
        if (!d) return prev;
        const next = { ...prev };
        next[sessionId] = {
          ...d,
          behaviors: d.behaviors.map((grp) => ({
            ...grp,
            events: grp.events.filter((e) => e.id !== eventId),
          })),
        };
        return next;
      });
      await refreshChartIfAffected();
    } catch (e: any) {
      alert(e?.message || "Failed to delete behavior event");
    }
  }

  async function onDeleteSkillEvent(sessionId: number, eventId: number) {
    if (!confirm("Delete this skill event?")) return;
    try {
      await api.sessions.deleteSkillEvent(eventId);
      setDetails((prev) => {
        const d = prev[sessionId];
        if (!d) return prev;
        const next = { ...prev };
        next[sessionId] = {
          ...d,
          skills: d.skills.map((grp) => ({
            ...grp,
            events: grp.events.filter((e) => e.id !== eventId),
          })),
        };
        return next;
      });
      await refreshChartIfAffected();
    } catch (e: any) {
      alert(e?.message || "Failed to delete skill event");
    }
  }

  // If the selected chart target belongs to the same client as the deleted data,
  // refresh the series to reflect changes.
  async function refreshChartIfAffected() {
    try {
      if (behaviorId) {
        const data: any = await api.analysis.behavior(Number(behaviorId));
        if (Array.isArray(data)) {
          const b = behaviors.find((x) => x.id === Number(behaviorId));
          setBehaviorMeta(b ? { id: b.id, name: b.name, method: b.method } : null);
          const sorted = data.slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
        } else {
          setBehaviorMeta(data.behavior ?? null);
          const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
        }
      } else if (skillId) {
        const data: any = await api.analysis.skill(Number(skillId));
        if (Array.isArray(data)) {
          const s = skills.find((x) => x.id === Number(skillId));
          setSkillMeta(s ? { id: s.id, name: s.name, method: s.method, skill_type: s.skill_type } : null);
          const sorted = data.slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
        } else {
          setSkillMeta(data.skill ?? null);
          const sorted = (data.points ?? []).slice().sort((a: Point, b: Point) => a.date.localeCompare(b.date));
          setPoints(sorted);
        }
      }
    } catch {
      // ignore; non-blocking
    }
  }

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

      <div className="text-sm text-gray-600">
        {behaviorMeta
          ? `${behaviorMeta.name} — ${behaviorMeta.method}`
          : skillMeta
          ? `${skillMeta.skill_type ?? ""}${skillMeta.skill_type ? " - " : ""}${skillMeta.name} — ${skillMeta.method}`
          : "Select a behavior or skill"}
      </div>

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
              <YAxis domain={isSkill ? [0, 100] : yDomain} stroke="#e5e7eb" />
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

      {/* ===== Session Manager (NEW) ===== */}
      <section className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold">Session Manager</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <div className="text-xs font-medium text-gray-600">Date from</div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600">Date to</div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="border rounded px-2 py-1"
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-600">Client ID (optional)</div>
            <input
              placeholder="e.g., 1"
              value={filterClientIdText}
              onChange={(e) => setFilterClientIdText(e.target.value)}
              className="border rounded px-2 py-1 w-32"
            />
          </div>
          <button
            onClick={loadSessions}
            disabled={sessionsBusy}
            className="bg-black text-white rounded px-3 py-1"
          >
            {sessionsBusy ? "Loading..." : "Search"}
          </button>
          {sessionsErr && <span className="text-red-600 text-sm">{sessionsErr}</span>}
        </div>

        <div className="rounded border divide-y">
          {sessions.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              No sessions found for the chosen filters.
            </div>
          )}

          {sessions.map((s) => {
            const isOpen = !!expanded[s.id];
            const d = details[s.id];
            return (
              <div key={s.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm">
                    <div className="font-medium">
                      Session #{s.id} — {s.date} — Client: {s.client_name ?? s.client_id}
                    </div>
                    <div className="text-gray-500">
                      Beh.Events: {s.behavior_event_count} &middot; Skill.Events: {s.skill_event_count}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleExpand(s.id)}
                      className="border rounded px-3 py-1"
                    >
                      {isOpen ? "Hide" : "View targets"}
                    </button>
                    <button
                      onClick={() => onDeleteSession(s.id)}
                      className="border border-red-600 text-red-600 rounded px-3 py-1"
                    >
                      Delete session
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <div className="mt-4 space-y-4">
                    {!d && <div className="text-sm text-gray-500">Loading details…</div>}

                    {d && (
                      <>
                        {/* Behaviors */}
                        <div>
                          <div className="font-semibold mb-2">Behaviors</div>
                          {d.behaviors.length === 0 && (
                            <div className="text-sm text-gray-500">No behavior events.</div>
                          )}
                          <div className="space-y-2">
                            {d.behaviors.map((grp) => (
                              <div key={grp.behavior.id} className="rounded border p-3">
                                <div className="text-sm font-medium">
                                  {grp.behavior.name}{" "}
                                  <span className="text-gray-500">({grp.behavior.method})</span>
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {grp.events.map((e) => (
                                    <li key={e.id} className="flex items-center justify-between text-sm">
                                      <div className="text-gray-700">
                                        {e.happened_at} — {e.event_type}
                                        {e.value != null ? ` (value: ${e.value})` : ""}
                                      </div>
                                      <button
                                        onClick={() => onDeleteBehaviorEvent(d.id, e.id)}
                                        className="text-red-600 hover:underline"
                                      >
                                        delete
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Skills */}
                        <div>
                          <div className="font-semibold mb-2">Skills</div>
                          {d.skills.length === 0 && (
                            <div className="text-sm text-gray-500">No skill events.</div>
                          )}
                          <div className="space-y-2">
                            {d.skills.map((grp) => (
                              <div key={grp.skill.id} className="rounded border p-3">
                                <div className="text-sm font-medium">
                                  {grp.skill.name}{" "}
                                  <span className="text-gray-500">({grp.skill.skill_type})</span>
                                </div>
                                <ul className="mt-2 space-y-1">
                                  {grp.events.map((e) => (
                                    <li key={e.id} className="flex items-center justify-between text-sm">
                                      <div className="text-gray-700">
                                        {e.happened_at} — {e.event_type}
                                      </div>
                                      <button
                                        onClick={() => onDeleteSkillEvent(d.id, e.id)}
                                        className="text-red-600 hover:underline"
                                      >
                                        delete
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
