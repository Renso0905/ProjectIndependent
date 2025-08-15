"use client";

type Skill = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: "PERCENTAGE";
  skill_type: string; // NEW
  created_at: string;
};

export default function SkillCard({
  s,
  sessionId,
  percent,
  onCorrect,
  onWrong,
}: {
  s: Skill;
  sessionId: number | null;
  percent: string;
  onCorrect: (id: number) => void;
  onWrong: (id: number) => void;
}) {
  return (
    <article className="border rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{s.skill_type} - {s.name}</div>
          <div className="text-xs text-gray-600">Method: {s.method}</div>
        </div>
        <div className="text-sm font-mono">
          % Correct: <span className="font-semibold">{percent}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button className="px-3 py-2 border rounded-lg" onClick={() => onWrong(s.id)} disabled={!sessionId}>
          − Wrong
        </button>
        <button className="px-3 py-2 border rounded-lg" onClick={() => onCorrect(s.id)} disabled={!sessionId}>
          + Correct
        </button>
      </div>
    </article>
  );
}
