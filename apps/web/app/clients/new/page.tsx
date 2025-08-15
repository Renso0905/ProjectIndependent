"use client";
import { useState } from "react";
import { api } from "../../../lib/api";

export default function NewClientPage() {
  const [name, setName] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      await api.clients.create({ name: name.trim(), birthdate, info: info.trim() || null });
      window.location.href = "/clients";
    } catch (err: any) {
      setError(err?.message || "Failed to create client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-xl">
        <div className="mb-3">
          <a href="/clients" className="px-3 py-2 border rounded-lg hover:bg-gray-50">← Back to Clients</a>
        </div>

        <form onSubmit={onSubmit} className="border rounded-2xl p-6 grid gap-3 bg-white">
          <h1 className="text-2xl font-semibold text-center mb-2">Add Client</h1>

          <label className="block">
            <span className="text-sm">Name</span>
            <input className="w-full border rounded px-3 py-2" value={name} onChange={(e)=>setName(e.target.value)} required />
          </label>

          <label className="block">
            <span className="text-sm">Birthdate</span>
            <input type="date" className="w-full border rounded px-3 py-2" value={birthdate} onChange={(e)=>setBirthdate(e.target.value)} required />
          </label>

          <label className="block">
            <span className="text-sm">Info</span>
            <textarea className="w-full border rounded px-3 py-2" rows={4} value={info} onChange={(e)=>setInfo(e.target.value)} />
          </label>

          {error && <p className="text-red-600">{error}</p>}
          <button disabled={busy} className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50 mt-2">
            {busy ? "Creating…" : "Create Client"}
          </button>
        </form>
      </div>
    </main>
  );
}
