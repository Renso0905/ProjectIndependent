"use client";
import { useEffect, useRef, useState } from "react";
import ClientAndDatePanel from "../../components/collect/ClientAndDatePanel";
import SessionStartBar from "../../components/collect/SessionStartBar";
import BehaviorCard from "../../components/collect/BehaviorCard";
import SkillCard from "../../components/collect/SkillCard";
import EndSessionFooter from "../../components/collect/EndSessionFooter";
import { api } from "../../lib/api";

type Me = { username: string; role: "BCBA" | "RBT" };
type Client = { id: number; name: string; birthdate: string; info?: string | null };

type Method = "FREQUENCY" | "DURATION" | "INTERVAL" | "MTS";
type Behavior = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: Method;
  settings: Record<string, any>;
  created_at: string;
};

type EventType = "INC" | "DEC" | "START" | "STOP" | "HIT";
type OutgoingEvent = {
  behavior_id: number;
  event_type: EventType;
  value?: number | null;
  happened_at?: string;
  extra?: any;
};

type Skill = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: "PERCENTAGE";
  skill_type: string; // NEW
  created_at: string;
};
type OutgoingSkillEvent = {
  skill_id: number;
  event_type: "CORRECT" | "WRONG";
  happened_at?: string;
};

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CollectPage() {
  // ---- top-level state ----
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [behaviors, setBehaviors] = useState<Behavior[] | null>(null);
  const [skills, setSkills] = useState<Skill[] | null>(null);

  const [sessionDate, setSessionDate] = useState<string>(todayStr());
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [unsent, setUnsent] = useState<OutgoingEvent[]>([]);
  const [unsentSkill, setUnsentSkill] = useState<OutgoingSkillEvent[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  // ---- live tallies (not persisted) ----
  const counts = useRef<Map<number, number>>(new Map());
  const runningStart = useRef<Map<number, number>>(new Map());
  const durations = useRef<Map<number, number>>(new Map());
  const skillTallies = useRef<Map<number, { correct: number; total: number }>>(new Map());

  // ---- initial load ----
  useEffect(() => {
    api.me().then(setMe).catch(() => setMe(null));
    api.clients.list().then(setClients).catch(() => setClients([]));
  }, []);

  // ---- when client changes ----
  useEffect(() => {
    if (!clientId) {
      setBehaviors(null);
      setSkills(null);
      return;
    }
    setBehaviors(null);
    setSkills(null);

    api.clients.behaviors(clientId).then(setBehaviors).catch(() => setBehaviors([]));
    api.clients.skills(clientId).then(setSkills).catch(() => setSkills([]));

    // reset session state
    setSessionId(null);
    setUnsent([]);
    setUnsentSkill([]);
    counts.current.clear();
    runningStart.current.clear();
    durations.current.clear();
    skillTallies.current.clear();
  }, [clientId]);

  // ---- autosave every minute ----
  useEffect(() => {
    const iv = setInterval(() => {
      flushEvents();
      flushSkillEvents();
    }, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, unsent, unsentSkill]);

  // ---- helpers ----
  function nowISO() {
    return new Date().toISOString();
  }
  function queue(ev: OutgoingEvent) {
    setUnsent((prev) => [...prev, ev]);
  }
  function queueSkill(ev: OutgoingSkillEvent) {
    setUnsentSkill((prev) => [...prev, ev]);
  }

  async function flushEvents() {
    if (!sessionId || unsent.length === 0) return;
    try {
      await api.sessions.postEvents(sessionId, unsent);
      setUnsent([]);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("autosave failed (behaviors):", e);
    }
  }

  async function flushSkillEvents() {
    if (!sessionId || unsentSkill.length === 0) return;
    try {
      await api.sessions.postSkillEvents(sessionId, unsentSkill);
      setUnsentSkill([]);
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("autosave failed (skills):", e);
    }
  }

  async function startSession() {
    if (!clientId) return alert("Select a client first.");
    if (!sessionDate) return alert("Pick a date for the session.");
    try {
      const s = await api.sessions.start(clientId, sessionDate);
      setSessionId(s.id);
    } catch {
      alert("Failed to start session.");
    }
  }

  // ---- behavior actions ----
  function inc(behavior_id: number) {
    if (!sessionId) return;
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, c + 1);
    queue({ behavior_id, event_type: "INC", value: 1, happened_at: nowISO() });
    forceRender();
  }
  function dec(behavior_id: number) {
    if (!sessionId) return;
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, Math.max(0, c - 1));
    queue({ behavior_id, event_type: "DEC", value: -1, happened_at: nowISO() });
    forceRender();
  }
  function startTimer(behavior_id: number) {
    if (!sessionId) return;
    if (runningStart.current.has(behavior_id)) return;
    runningStart.current.set(behavior_id, Date.now());
    queue({ behavior_id, event_type: "START", happened_at: nowISO() });
    forceRender();
  }
  function stopTimer(behavior_id: number) {
    if (!sessionId) return;
    const startMs = runningStart.current.get(behavior_id);
    if (!startMs) return;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));
    runningStart.current.delete(behavior_id);
    const total = (durations.current.get(behavior_id) ?? 0) + elapsedSec;
    durations.current.set(behavior_id, total);
    queue({ behavior_id, event_type: "STOP", value: elapsedSec, happened_at: nowISO() });
    forceRender();
  }
  function hit(behavior_id: number) {
    if (!sessionId) return;
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, c + 1);
    queue({ behavior_id, event_type: "HIT", value: 1, happened_at: nowISO() });
    forceRender();
  }

  // ---- skill actions ----
  function correct(skill_id: number) {
    if (!sessionId) return;
    const t = skillTallies.current.get(skill_id) ?? { correct: 0, total: 0 };
    t.correct += 1;
    t.total += 1;
    skillTallies.current.set(skill_id, t);
    queueSkill({ skill_id, event_type: "CORRECT", happened_at: nowISO() });
    forceRender();
  }
  function wrong(skill_id: number) {
    if (!sessionId) return;
    const t = skillTallies.current.get(skill_id) ?? { correct: 0, total: 0 };
    t.total += 1;
    skillTallies.current.set(skill_id, t);
    queueSkill({ skill_id, event_type: "WRONG", happened_at: nowISO() });
    forceRender();
  }
  function pct(skill_id: number) {
    const t = skillTallies.current.get(skill_id);
    if (!t || t.total === 0) return "0%";
    return `${Math.round((t.correct / t.total) * 100)}%`;
  }

  // ---- end flow ----
  async function onEndSession() {
    setEnding(true);
  }

  async function onSaveAndExit() {
    // stop running timers
    behaviors?.forEach((b) => {
      if (b.method === "DURATION" && runningStart.current.has(b.id)) {
        stopTimer(b.id);
      }
    });

    try {
      if (sessionId && unsent.length > 0) {
        await api.sessions.postEvents(sessionId, unsent);
        setUnsent([]);
      }
      if (sessionId && unsentSkill.length > 0) {
        await api.sessions.postSkillEvents(sessionId, unsentSkill);
        setUnsentSkill([]);
      }
      if (sessionId) {
        await api.sessions.end(sessionId);
      }
      const role = me?.role?.toLowerCase() || "rbt";
      window.location.href = `/dashboard/${role}`;
    } catch {
      alert("Failed to save/end session. Please try again.");
    } finally {
      setEnding(false);
    }
  }

  // force re-render helper
  const [, setTick] = useState(0);
  function forceRender() {
    setTick((t) => t + 1);
  }

  // ---- render ----
  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Collection</h1>
        <div className="text-sm text-gray-600">
          {lastSavedAt ? `Auto-saved: ${lastSavedAt}` : "Autosave: pending"}
        </div>
      </header>

      <ClientAndDatePanel
        clients={clients}
        clientId={clientId}
        setClientId={setClientId}
        sessionDate={sessionDate}
        setSessionDate={setSessionDate}
        sessionLocked={!!sessionId}
      />

      <SessionStartBar
        canStart={!!clientId && !!sessionDate}
        sessionId={sessionId}
        sessionDate={sessionDate}
        onStart={startSession}
      />

      {behaviors && behaviors.length > 0 && (
        <section className="grid md:grid-cols-2 gap-4">
          {behaviors.map((b) => (
            <BehaviorCard
              key={b.id}
              b={b}
              sessionId={sessionId}
              count={
                b.method === "FREQUENCY" || b.method === "INTERVAL" || b.method === "MTS"
                  ? counts.current.get(b.id) ?? 0
                  : 0
              }
              running={runningStart.current.has(b.id)}
              totalSeconds={durations.current.get(b.id) ?? 0}
              onInc={inc}
              onDec={dec}
              onStart={startTimer}
              onStop={stopTimer}
              onHit={hit}
            />
          ))}
        </section>
      )}

      {skills && skills.length > 0 && (
        <section className="grid md:grid-cols-2 gap-4">
          {skills.map((s) => (
            <SkillCard
              key={s.id}
              s={s}
              sessionId={sessionId}
              percent={pct(s.id)}
              onCorrect={correct}
              onWrong={wrong}
            />
          ))}
        </section>
      )}

      <EndSessionFooter
        ending={ending}
        sessionActive={!!sessionId}
        onEnd={onEndSession}
        onSaveExit={onSaveAndExit}
        onCancel={() => setEnding(false)}
      />
    </main>
  );
}
