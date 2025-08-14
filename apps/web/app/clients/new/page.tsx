"use client";
import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState(""); // YYYY-MM-DD
  const [info, setInfo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [debug, setDebug] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    setDebug(null);

    try {
      const res = await fetch(`${API_BASE}/clients`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          birthdate: birthdate, // "YYYY-MM-DD"
          info: info.trim() || null,
        }),
      });

      const text = await res.text(); // read raw for better debug
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        /* non-JSON error */
      }

      if (!res.ok) {
        setDebug(
          `POST ${API_BASE}/clients → ${res.status}\n${
            text || "(no body)"
          }`,
        );
        throw new Error(
          data?.detail || data?.error || `Create failed (HTTP ${res.status})`,
        );
      }

      // Success → back to BCBA dashboard
      window.location.href = "/dashboard/bcba";
    } catch (err: any) {
      setError(err.message || "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-3">
          <a
            href="/dashboard/bcba"
            className="px-3 py-2 border rounded-lg hover:bg-gray-50"
          >
            ← Back to BCBA Dashboard
          </a>
        </div>

        <form
          onSubmit={onSubmit}
          className="border rounded-2xl p-6 grid gap-3 bg-white"
        >
          <h1 className="text-2xl font-semibold text-center mb-2">
            Create Client
          </h1>

          <label className="block">
            <span className="text-sm">Name</span>
            <input
              className="w-full border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client name"
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Birthdate</span>
            <input
              className="w-full border rounded px-3 py-2"
              type="date"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="text-sm">Information</span>
            <textarea
              className="w-full border rounded px-3 py-2"
              rows={5}
              value={info}
              onChange={(e) => setInfo(e.target.value)}
              placeholder="Notes, background, etc."
            />
          </label>

          {error && <p className="text-red-600">{error}</p>}
          {debug && (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 p-2 rounded border">
              {debug}
            </pre>
          )}

          <button
            disabled={busy}
            className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50 mt-2"
          >
            {busy ? "Creating…" : "Create Client"}
          </button>

          <p className="text-xs text-gray-500 text-center mt-1">
            API: <code>{API_BASE}</code>
          </p>
        </form>
      </div>
    </main>
  );
}
