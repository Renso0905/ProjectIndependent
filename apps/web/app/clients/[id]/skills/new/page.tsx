"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../../../lib/api";

const SKILL_TYPES = [
  { code: "LR", label: "Listener Responding (LR)" },
  { code: "MAND", label: "Manding (MAND)" },
  { code: "TACT", label: "Tacting (TACT)" },
  { code: "IV", label: "Intraverbal (IV)" },
  { code: "MI", label: "Motor Imitation (MI)" },
  { code: "PLAY", label: "Play/Leisure (PLAY)" },
  { code: "VP", label: "Visual Perception (VP)" },
  { code: "ADL", label: "Adaptive/Self-Help (ADL)" },
  { code: "SOC", label: "Social (SOC)" },
  { code: "ACAD", label: "Academic (ACAD)" },
  { code: "OTHER", label: "Other" },
];

export default function NewSkillPage() {
  const { id } = useParams<{ id: string }>();

  const [skillType, setSkillType] = useState("LR"); // <-- dropdown value
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      if (!id) throw new Error("Missing client id");
      await api.clients.createSkill(Number(id), {
        name: name.trim(),
        description: description.trim() || null,
        method: "PERCENTAGE",
        skill_type: skillType, // <-- sent to API
      });
      window.location.href = `/clients/${id}`;
    } catch (err: any) {
      setError(err?.message || "Failed to create skill");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-3">
          <a href={`/clients/${id}`} className="px-3 py-2 border rounded-lg hover:bg-gray-50">
            ← Back to Client
          </a>
        </div>

        <form onSubmit={onSubmit} className="border rounded-2xl p-6 grid gap-3 bg-white">
          <h1 className="text-2xl font-semibold text-center mb-2">Add Skill</h1>

          {/* Skill Type dropdown */}
          <label className="block">
            <span className="text-sm">Skill Type</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={skillType}
              onChange={(e) => setSkillType(e.target.value)}
            >
              {SKILL_TYPES.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-sm">Skill name</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Sit"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Description</span>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, prompt levels, etc."
            />
          </label>

          <label className="block">
            <span className="text-sm">Method</span>
            <input className="w-full border rounded px-3 py-2 bg-gray-50" value="PERCENTAGE" disabled />
          </label>

          {error && <p className="text-red-600">{error}</p>}

          <button disabled={busy} className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50 mt-2">
            {busy ? "Creating…" : "Create Skill"}
          </button>
        </form>
      </div>
    </main>
  );
}
