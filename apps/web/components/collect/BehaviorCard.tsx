"use client";
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

export default function BehaviorCard({
  b,
  sessionId,
  count,
  running,
  totalSeconds,
  onInc,
  onDec,
  onStart,
  onStop,
  onHit,
}: {
  b: Behavior;
  sessionId: number | null;
  count: number;
  running: boolean;
  totalSeconds: number;
  onInc: (id: number) => void;
  onDec: (id: number) => void;
  onStart: (id: number) => void;
  onStop: (id: number) => void;
  onHit: (id: number) => void;
}) {
  return (
    <article className="border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{b.name}</div>
          <div className="text-xs text-gray-600">
            Method: {b.method}
            {b.settings?.interval_seconds ? ` · interval ${b.settings.interval_seconds}s` : ""}
          </div>
        </div>
      </div>

      {b.method === "FREQUENCY" && (
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 border rounded-lg" onClick={() => onDec(b.id)} disabled={!sessionId}>
            −
          </button>
          <div className="min-w-[3rem] text-center font-mono">{count}</div>
          <button className="px-3 py-2 border rounded-lg" onClick={() => onInc(b.id)} disabled={!sessionId}>
            +
          </button>
        </div>
      )}

      {b.method === "DURATION" && (
        <div className="flex items-center gap-3">
          {!running ? (
            <button className="px-3 py-2 border rounded-lg" onClick={() => onStart(b.id)} disabled={!sessionId}>
              Start
            </button>
          ) : (
            <button className="px-3 py-2 border rounded-lg" onClick={() => onStop(b.id)}>
              Stop
            </button>
          )}
          <div className="text-sm text-gray-700">
            Total: {totalSeconds}s {running ? <em className="text-gray-500">(running)</em> : null}
          </div>
        </div>
      )}

      {(b.method === "INTERVAL" || b.method === "MTS") && (
        <div className="flex items-center gap-3">
          <button className="px-3 py-2 border rounded-lg" onClick={() => onHit(b.id)} disabled={!sessionId}>
            Mark Occurred
          </button>
          <div className="text-sm text-gray-700">Hits: {count}</div>
        </div>
      )}
    </article>
  );
}
