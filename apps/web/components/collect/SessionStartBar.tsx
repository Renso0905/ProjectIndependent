"use client";
export default function SessionStartBar({
  canStart,
  sessionId,
  sessionDate,
  onStart,
}: {
  canStart: boolean;
  sessionId: number | null;
  sessionDate: string;
  onStart: () => void;
}) {
  return (
    <section className="border rounded-xl p-4 flex items-center gap-3">
      <button
        className="px-4 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50"
        onClick={onStart}
        disabled={!canStart || !!sessionId}
      >
        ▶ Start Session
      </button>
      {sessionId ? (
        <span className="text-sm text-green-700">Session #{sessionId} started for {sessionDate}</span>
      ) : (
        <span className="text-sm text-gray-600">Pick client & date, then start.</span>
      )}
    </section>
  );
}
