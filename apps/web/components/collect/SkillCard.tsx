"use client";

import type { Skill } from "../../lib/types";

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
  const canAct = !!sessionId;

  return (
    <article className="border rounded-lg p-3">
      <header className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">{s.name}</h3>
          <div className="text-xs text-gray-600">
            {s.skill_type} · {s.method}
          </div>
        </div>
        <div className="text-xl tabular-nums">{percent}</div>
      </header>

      <div className="mt-3 flex gap-2">
        <button
          className="px-3 py-2 border rounded-lg"
          onClick={() => onCorrect(s.id)}
          disabled={!canAct}
        >
          Correct
        </button>
        <button
          className="px-3 py-2 border rounded-lg"
          onClick={() => onWrong(s.id)}
          disabled={!canAct}
        >
          Wrong
        </button>
      </div>
    </article>
  );
}
