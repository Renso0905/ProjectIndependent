"use client";

import type { Behavior, DataCollectionMethod as Method } from "../../lib/types";

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
  const canAct = !!sessionId;

  return (
    <article className="border rounded-lg p-3">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{b.name}</h3>
          <div className="text-xs text-gray-600">
            Method: {b.method as Method}
            {b.description ? ` — ${b.description}` : null}
          </div>
        </div>
        {b.method === "FREQUENCY" && (
          <div className="text-2xl tabular-nums">{count}</div>
        )}
        {b.method === "DURATION" && (
          <div className="text-sm tabular-nums">{totalSeconds}s</div>
        )}
      </header>

      {/* Controls */}
      <div className="mt-3 flex flex-wrap gap-2">
        {b.method === "FREQUENCY" && (
          <>
            <button
              className="px-3 py-2 border rounded-lg"
              onClick={() => onInc(b.id)}
              disabled={!canAct}
            >
              +1
            </button>
            <button
              className="px-3 py-2 border rounded-lg"
              onClick={() => onDec(b.id)}
              disabled={!canAct}
            >
              −1
            </button>
          </>
        )}

        {b.method === "DURATION" && (
          <>
            {!running ? (
              <button
                className="px-3 py-2 border rounded-lg"
                onClick={() => onStart(b.id)}
                disabled={!canAct}
              >
                Start
              </button>
            ) : (
              <button
                className="px-3 py-2 border rounded-lg"
                onClick={() => onStop(b.id)}
                disabled={!canAct}
              >
                Stop
              </button>
            )}
          </>
        )}

        {(b.method === "INTERVAL" || b.method === "MTS") && (
          <button
            className="px-3 py-2 border rounded-lg"
            onClick={() => onHit(b.id)}
            disabled={!canAct}
          >
            Hit
          </button>
        )}
      </div>
    </article>
  );
}
