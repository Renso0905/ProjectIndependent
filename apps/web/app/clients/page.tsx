"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

type Client = {
  id: number;
  name: string;
  birthdate: string; // ISO date
  info?: string | null;
};

export default function ClientsIndex() {
  const [rows, setRows] = useState<Client[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/clients`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then(setRows)
      .catch((e) => setErr(e?.detail || "Failed to load clients"));
  }, []);

  return (
    <main className="min-h-screen p-8 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <div className="flex items-center gap-2">
          <a href="/dashboard/bcba" className="px-3 py-2 border rounded-lg hover:bg-gray-50">← Back to Dashboard</a>
          <a href="/clients/new" className="px-3 py-2 border rounded-lg hover:bg-gray-50">+ Create Client</a>
        </div>
      </header>

      {err && <p className="text-red-600">{err}</p>}
      {!rows && !err && <p>Loading…</p>}

      {rows && rows.length === 0 && (
        <div className="text-gray-600">
          No clients yet. <a href="/clients/new" className="underline">Create your first client</a>.
        </div>
      )}

      {rows && rows.length > 0 && (
        <ul className="divide-y border rounded-xl">
          {rows.map((c) => (
            <li key={c.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-gray-600">DOB: {c.birthdate}</div>
              </div>
              <a href={`/clients/${c.id}`} className="px-3 py-2 border rounded-lg hover:bg-gray-50">
                Open
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
