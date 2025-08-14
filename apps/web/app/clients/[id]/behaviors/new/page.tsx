"use client";
import { useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

type Method = "FREQUENCY" | "DURATION" | "INTERVAL" | "MTS";

export default function NewBehaviorPage() {
  const params = useParams<{ id: string }>();
  const clientId = params?.id;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<Method>("FREQUENCY");
  const [intervalSeconds, setIntervalSeconds] = useState<number>(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload: any = {
        name: name.trim(),
        description: description.trim() || null,
        method,
        settings: {},
      };
      if (method === "INTERVAL" || method === "MTS") {
        payload.settings.interval_seconds = Number(intervalSeconds);
      }

      const res = await fetch(`${API_BASE}/clients/${clientId}/behaviors`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.detail || data?.error || "Create failed");
      }
      // back to client detail
      window.location.href = `/clients/${clientId}`;
    } catch (err: any) {
      setError(err.message || "Failed to create behavior");
    } finally {
      setBusy(false);
    }
  }

  const needsInterval = method === "INTERVAL" || method === "MTS";

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-3">
          <a
            href={`/clients/${clientId}`}
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            ← Back to Client
          </a>
        </div>

        <form onSubmit={onSubmit} className="border rounded-2xl p-6 grid gap-3 bg-white">
          <h1 className="text-2xl font-semibold text-center mb-2">Add Behavior</h1>

          <label className="block">
            <span className="text-sm">Behavior name</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Elopement, SIB, Task refusal"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Description (optional)</span>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Define the behavior topographically."
            />
          </label>

          <label className="block">
            <span className="text-sm">Collection method</span>
            <select
              className="w-full border rounded px-3 py-2"
              value={method}
              onChange={(e) => setMethod(e.target.value as Method)}
            >
              <option value="FREQUENCY">Frequency (count)</option>
              <option value="DURATION">Duration (time)</option>
              <option value="INTERVAL">Interval (partial/whole)</option>
              <option value="MTS">MTS (momentary time sampling)</option>
            </select>
          </label>

          {needsInterval && (
            <label className="block">
              <span className="text-sm">Interval length (seconds)</span>
              <input
                className="w-full border rounded px-3 py-2"
                type="number"
                min={1}
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                required
              />
            </label>
          )}

          {error && <p className="text-red-600">{error}</p>}

          <button
            disabled={busy}
            className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50 mt-2"
          >
            {busy ? "Saving…" : "Save Behavior"}
          </button>

          <p className="text-xs text-gray-500 text-center mt-1">
            API: <code>{API_BASE}</code>
          </p>
        </form>
      </div>
    </main>
  );
}
