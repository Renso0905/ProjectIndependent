"use client";
import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

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
  happened_at?: string; // ISO
  extra?: any;
};

export default function CollectPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState<number | null>(null);
  const [behaviors, setBehaviors] = useState<Behavior[] | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);

  const [unsent, setUnsent] = useState<OutgoingEvent[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  // Local counters/timers for live display
  const counts = useRef<Map<number, number>>(new Map());
  const runningStart = useRef<Map<number, number>>(new Map()); // behavior_id -> ms timestamp
  const durations = useRef<Map<number, number>>(new Map()); // behavior_id -> total seconds

  // Load current user & clients
  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setMe(null));

    fetch(`${API_BASE}/collect/clients`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setClients)
      .catch(() => setClients([]));
  }, []);

  // When a client is selected: fetch behaviors and start a session
  useEffect(() => {
    if (!clientId) return;
    setBehaviors(null);
    setSessionId(null);
    setUnsent([]);
    counts.current.clear();
    runningStart.current.clear();
    durations.current.clear();

    fetch(`${API_BASE}/collect/clients/${clientId}/behaviors`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setBehaviors)
      .catch(() => setBehaviors([]));

    fetch(`${API_BASE}/sessions/start`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: clientId }),
    })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then((json) => setSessionId(json.id))
      .catch((e) => {
        alert(`Failed to start session: ${e?.detail || "unknown error"}`);
      });
  }, [clientId]);

  // Autosave every minute
  useEffect(() => {
    const iv = setInterval(() => {
      flushEvents();
    }, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, unsent]);

  function nowISO() {
    return new Date().toISOString();
  }

  function queue(ev: OutgoingEvent) {
    setUnsent((prev) => [...prev, ev]);
  }

  async function flushEvents() {
    if (!sessionId || unsent.length === 0) return;
    const payload = { events: unsent };
    try {
      const r = await fetch(`${API_BASE}/sessions/${sessionId}/events`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setUnsent([]); // cleared on success
      setLastSavedAt(new Date().toLocaleTimeString());
    } catch (e) {
      console.warn("autosave failed:", e);
      // keep unsent as-is for next attempt
    }
  }

  // Behavior actions
  function inc(behavior_id: number) {
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, c + 1);
    queue({ behavior_id, event_type: "INC", value: 1, happened_at: nowISO() });
    forceRender();
  }
  function dec(behavior_id: number) {
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, Math.max(0, c - 1));
    queue({ behavior_id, event_type: "DEC", value: -1, happened_at: nowISO() });
    forceRender();
  }

  function startTimer(behavior_id: number) {
    if (runningStart.current.has(behavior_id)) return; // already running
    runningStart.current.set(behavior_id, Date.now());
    queue({ behavior_id, event_type: "START", happened_at: nowISO() });
    forceRender();
  }
  function stopTimer(behavior_id: number) {
    const startMs = runningStart.current.get(behavior_id);
    if (!startMs) return;
    const elapsedSec = Math.max(1, Math.round((Date.now() - startMs) / 1000));
    runningStart.current.delete(behavior_id);
    const total = (durations.current.get(behavior_id) ?? 0) + elapsedSec;
    durations.current.set(behavior_id, total);
    queue({
      behavior_id,
      event_type: "STOP",
      value: elapsedSec,
      happened_at: nowISO(),
    });
    forceRender();
  }

  function hit(behavior_id: number) {
    // For INTERVAL or MTS – a single occurrence within/at the sample
    const c = counts.current.get(behavior_id) ?? 0;
    counts.current.set(behavior_id, c + 1);
    queue({ behavior_id, event_type: "HIT", value: 1, happened_at: nowISO() });
    forceRender();
  }

  // simple way to reflect ref changes
  const [, setTick] = useState(0);
  function forceRender() {
    setTick((t) => t + 1);
  }

  async function onEndSession() {
    setEnding(true);
  }

  async function onSaveAndExit() {
    // Auto-stop any running timers (best-effort)
    behaviors?.forEach((b) => {
      if (b.method === "DURATION" && runningStart.current.has(b.id)) {
        stopTimer(b.id);
      }
    });

    // Flush remaining events and end session
    try {
      if (sessionId && unsent.length > 0) {
        await fetch(`${API_BASE}/sessions/${sessionId}/events`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: unsent }),
        });
        setUnsent([]);
      }
      if (sessionId) {
        await fetch(`${API_BASE}/sessions/${sessionId}/end`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
      // Back to correct dashboard
      const role = me?.role?.toLowerCase() || "rbt";
      window.location.href = `/dashboard/${role}`;
    } catch (e) {
      alert("Failed to save/end session. Please try again.");
    } finally {
      setEnding(false);
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Data Collection</h1>
        <div className="text-sm text-gray-600">
          {lastSavedAt ? `Auto-saved: ${lastSavedAt}` : "Autosave: pending"}
        </div>
      </header>

      {/* Client picker */}
      <section className="border rounded-xl p-4 space-y-3">
        <label className="block">
          <span className="text-sm">Select Client</span>
          <select
            className="w-full border rounded px-3 py-2 mt-1"
            value={clientId ?? ""}
            onChange={(e) =>
              setClientId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">-- choose client --</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (DOB {c.birthdate})
              </option>
            ))}
          </select>
        </label>
        {clientId && !behaviors && <p>Loading behaviors…</p>}
      </section>

      {/* Behavior controls */}
      {behaviors && behaviors.length > 0 && (
        <section className="grid md:grid-cols-2 gap-4">
          {behaviors.map((b) => (
            <article key={b.id} className="border rounded-xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{b.name}</div>
                  <div className="text-xs text-gray-600">
                    Method: {b.method}
                    {b.settings?.interval_seconds
                      ? ` · interval ${b.settings.interval_seconds}s`
                      : ""}
                  </div>
                </div>
              </div>

              {/* Controls by method */}
              {b.method === "FREQUENCY" && (
                <div className="flex items-center gap-2">
                  <button
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => dec(b.id)}
                  >
                    −
                  </button>
                  <div className="min-w-[3rem] text-center font-mono">
                    {counts.current.get(b.id) ?? 0}
                  </div>
                  <button
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => inc(b.id)}
                  >
                    +
                  </button>
                </div>
              )}

              {b.method === "DURATION" && (
                <div className="flex items-center gap-3">
                  {!runningStart.current.has(b.id) ? (
                    <button
                      className="px-3 py-2 border rounded-lg"
                      onClick={() => startTimer(b.id)}
                    >
                      Start
                    </button>
                  ) : (
                    <button
                      className="px-3 py-2 border rounded-lg"
                      onClick={() => stopTimer(b.id)}
                    >
                      Stop
                    </button>
                  )}
                  <div className="text-sm text-gray-700">
                    Total: {durations.current.get(b.id) ?? 0}s{" "}
                    {runningStart.current.has(b.id) ? (
                      <em className="text-gray-500">(running)</em>
                    ) : null}
                  </div>
                </div>
              )}

              {(b.method === "INTERVAL" || b.method === "MTS") && (
                <div className="flex items-center gap-3">
                  <button
                    className="px-3 py-2 border rounded-lg"
                    onClick={() => hit(b.id)}
                  >
                    Mark Occurred
                  </button>
                  <div className="text-sm text-gray-700">
                    Hits: {counts.current.get(b.id) ?? 0}
                  </div>
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {/* End session flow */}
      <footer className="pt-2">
        {!ending ? (
          <button
            disabled={!sessionId}
            onClick={onEndSession}
            className="px-4 py-2 border rounded-lg hover:bg-gray-50"
          >
            End Session
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-gray-700">Finish and save?</span>
            <button
              onClick={onSaveAndExit}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Save & Exit
            </button>
            <button
              onClick={() => setEnding(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </footer>
    </main>
  );
}
