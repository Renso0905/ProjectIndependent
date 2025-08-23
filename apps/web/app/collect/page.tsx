"use client";

import { useEffect, useRef, useState } from "react";
import ClientAndDatePanel from "../../components/collect/ClientAndDatePanel";
import SessionStartBar from "../../components/collect/SessionStartBar";
import BehaviorCard from "../../components/collect/BehaviorCard";
import SkillCard from "../../components/collect/SkillCard";
import EndSessionFooter from "../../components/collect/EndSessionFooter";
import { api } from "../../lib/api";
import type {
  Me,
  Client,
  Behavior,
  Skill,
  DataCollectionMethod as Method,
} from "../../lib/types";

// Local request payload shapes kept here (not part of shared read types)
type EventType = "INC" | "DEC" | "START" | "STOP" | "HIT";
type OutgoingEvent = {
  behavior_id: number;
  event_type: EventType;
  value?: number | null;
  happened_at?: string;
  extra?: any;
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

// --- retry helpers for final flush/end ---
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function withRetry<T>(fn: () => Promise<T>, tries = 3, baseDelay = 500): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < tries - 1) await sleep(baseDelay * Math.pow(2, i)); // 0.5s, 1s, 2s
    }
  }
  throw lastErr;
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // ---- live tallies in React state (no forceRender needed) ----
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [runningStart, setRunningStart] = useState<Record<number, number>>({});
  const [durations, setDurations] = useState<Record<number, number>>({});
  const [skillTallies, setSkillTallies] = useState<
    Record<number, { correct: number; total: number }>
  >({});

  // ---- unsent queues (state + refs so autosave interval sees current data) ----
  const [unsent, setUnsent] = useState<OutgoingEvent[]>([]);
  const [unsentSkill, setUnsentSkill] = useState<OutgoingSkillEvent[]>([]);
  const unsentRef = useRef<OutgoingEvent[]>([]);
  const unsentSkillRef = useRef<OutgoingSkillEvent[]>([]);

  useEffect(() => {
    unsentRef.current = unsent;
  }, [unsent]);
  useEffect(() => {
    unsentSkillRef.current = unsentSkill;
  }, [unsentSkill]);

  // ---- initial load ----
  useEffect(() => {
    api.me()
      .then(setMe)
      .catch(() => setMe(null));
    api.clients
      .list()
      .then(setClients)
      .catch(() => setClients([]));
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

    api.clients
      .behaviors(clientId)
      .then(setBehaviors)
      .catch(() => setBehaviors([]));

    api.clients
      .skills(clientId)
      .then(setSkills)
      .catch(() => setSkills([]));

    // reset session-related state
    setSessionId(null);
    setUnsent([]);
    setUnsentSkill([]);
    setCounts({});
    setRunningStart({});
    setDurations({});
    setSkillTallies({});
    setLastSavedAt(null);
    setEndError(null);
  }, [clientId]);

  // ---- autosave: one interval per active session ----
  useEffect(() => {
    if (!sessionId) return;
    const iv = setInterval(() => {
      flushEvents();
      flushSkillEvents();
    }, 60_000);
    return () => clearInterval(iv);
  }, [sessionId]);

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
    if (!sessionId) return;
    const pending = unsentRef.current;
    if (!pending.length) return;
    try {
      await api.sessions.postEvents(sessionId, pending);
      setUnsent([]); // reset state
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      // soft-fail; keep queue for retry
      console.warn("autosave failed (behaviors):", e);
    }
  }

  async function flushSkillEvents() {
    if (!sessionId) return;
    const pending = unsentSkillRef.current;
    if (!pending.length) return;
    try {
      await api.sessions.postSkillEvents(sessionId, pending);
      setUnsentSkill([]); // reset state
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
    setCounts((m) => ({ ...m, [behavior_id]: (m[behavior_id] ?? 0) + 1 }));
    queue({ behavior_id, event_type: "INC", value: 1, happened_at: nowISO() });
  }
  function dec(behavior_id: number) {
    if (!sessionId) return;
    setCounts((m) => ({
      ...m,
      [behavior_id]: Math.max(0, (m[behavior_id] ?? 0) - 1),
    }));
    queue({ behavior_id, event_type: "DEC", value: -1, happened_at: nowISO() });
  }
  function startTimer(behavior_id: number) {
    if (!sessionId) return;
    setRunningStart((m) => (m[behavior_id] ? m : { ...m, [behavior_id]: Date.now() }));
    queue({ behavior_id, event_type: "START", happened_at: nowISO() });
  }
  function stopTimer(behavior_id: number) {
    if (!sessionId) return;
    setRunningStart((m) => {
      const startMs = m[behavior_id];
      if (!startMs) return m;
      const elapsedSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));
      setDurations((d) => ({ ...d, [behavior_id]: (d[behavior_id] ?? 0) + elapsedSec }));
      queue({ behavior_id, event_type: "STOP", value: elapsedSec, happened_at: nowISO() });
      const { [behavior_id]: _, ...rest } = m;
      return rest;
    });
  }
  function hit(behavior_id: number) {
    if (!sessionId) return;
    setCounts((m) => ({ ...m, [behavior_id]: (m[behavior_id] ?? 0) + 1 }));
    queue({ behavior_id, event_type: "HIT", value: 1, happened_at: nowISO() });
  }

  // ---- skill actions ----
  function correct(skill_id: number) {
    if (!sessionId) return;
    setSkillTallies((m) => {
      const t = m[skill_id] ?? { correct: 0, total: 0 };
      return { ...m, [skill_id]: { correct: t.correct + 1, total: t.total + 1 } };
    });
    queueSkill({ skill_id, event_type: "CORRECT", happened_at: nowISO() });
  }
  function wrong(skill_id: number) {
    if (!sessionId) return;
    setSkillTallies((m) => {
      const t = m[skill_id] ?? { correct: 0, total: 0 };
      return { ...m, [skill_id]: { correct: t.correct, total: t.total + 1 } };
    });
    queueSkill({ skill_id, event_type: "WRONG", happened_at: nowISO() });
  }
  function pct(skill_id: number) {
    const t = skillTallies[skill_id];
    if (!t || t.total === 0) return "0%";
    return `${Math.round((t.correct / t.total) * 100)}%`;
  }

  // ---- end flow ----
  async function onEndSession() {
    setEndError(null);
    setEnding(true);
  }

  async function onSaveAndExit() {
    if (!sessionId) return;
    setEndError(null);

    // stop running timers before final save
    behaviors?.forEach((b) => {
      if (b.method === "DURATION" && runningStart[b.id]) {
        // simulate a stop action to capture elapsed time
        stopTimer(b.id);
      }
    });

    // Final flush with retries; don't clear queues unless success
    try {
      if (unsentRef.current.length > 0) {
        await withRetry(
          () => api.sessions.postEvents(sessionId, unsentRef.current),
          3,
          600
        );
        setUnsent([]); // only clear on success
      }

      if (unsentSkillRef.current.length > 0) {
        await withRetry(
          () => api.sessions.postSkillEvents(sessionId, unsentSkillRef.current),
          3,
          600
        );
        setUnsentSkill([]); // only clear on success
      }

      // End session last (also retried)
      await withRetry(() => api.sessions.end(sessionId), 3, 600);

      const role = me?.role?.toLowerCase() || "rbt";
      window.location.href = `/dashboard/${role}`;
    } catch (e: any) {
      // Do not clear queues; user can try again
      const msg =
        e?.message ||
        (typeof e === "string" ? e : null) ||
        "Failed to save/end session after multiple attempts.";
      setEndError(msg);
    } finally {
      setEnding(false);
    }
  }

  const sessionLocked = !!sessionId;

  return (
    <main className="min-h-screen p-6 space-y-4">
      <header className="flex items-center justify-between">
        <a href="/dashboard/rbt" className="underline">
          ← Back to RBT Dashboard
        </a>
        <div className="text-sm text-gray-600">
          {lastSavedAt ? `Auto-saved: ${lastSavedAt}` : "Autosave: pending"}
        </div>
      </header>

      <h1 className="text-2xl font-semibold">Data Collection</h1>

      {endError && (
        <div className="p-3 border border-red-700 bg-red-900/20 text-red-200 rounded-lg">
          <div className="font-medium">Couldn’t finish saving the session.</div>
          <div className="text-sm opacity-90 mt-1">{endError}</div>
          <div className="text-sm opacity-90 mt-2">
            Your unsent events are still queued locally. Fix your connection and press{" "}
            <b>Save &amp; Exit</b> again.
          </div>
        </div>
      )}

      <ClientAndDatePanel
        clients={clients}
        clientId={clientId}
        setClientId={setClientId}
        sessionDate={sessionDate}
        setSessionDate={setSessionDate}
        sessionLocked={sessionLocked}
      />

      <SessionStartBar
        canStart={!!clientId && !!sessionDate}
        sessionId={sessionId}
        sessionDate={sessionDate}
        onStart={startSession}
      />

      {/* Behaviors */}
      {behaviors && behaviors.length > 0 && (
        <section className="space-y-3">
          {behaviors.map((b) => {
            const count = counts[b.id] ?? 0;
            const running = !!runningStart[b.id];
            const totalSeconds = durations[b.id] ?? 0;
            return (
              <BehaviorCard
                key={b.id}
                b={b}
                sessionId={sessionId}
                count={count}
                running={running}
                totalSeconds={totalSeconds}
                onInc={inc}
                onDec={dec}
                onStart={startTimer}
                onStop={stopTimer}
                onHit={hit}
              />
            );
          })}
        </section>
      )}

      {/* Skills */}
      {skills && skills.length > 0 && (
        <section className="space-y-3">
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
        onCancel={() => {
          setEndError(null);
          setEnding(false);
        }}
      />
    </main>
  );
}
