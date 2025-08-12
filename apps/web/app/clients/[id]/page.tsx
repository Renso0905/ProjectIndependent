"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

type Client = {
  id: number;
  name: string;
  birthdate: string;
  info?: string | null;
};

export default function ClientDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [client, setClient] = useState<Client | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_BASE}/clients/${id}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : r.json().then((d) => Promise.reject(d))))
      .then(setClient)
      .catch((e) => setErr(e?.detail || "Failed to load client"));
  }, [id]);

  return (
    <main className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <a href="/clients" className="px-3 py-2 border rounded-lg hover:bg-gray-50">← Back to Clients</a>
      </div>

      {!client && !err && <p>Loading client…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {client && (
        <>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-gray-600">DOB: {client.birthdate}</p>

          <section className="mt-6 p-4 border rounded-xl">
            <h2 className="text-lg font-semibold mb-2">Client Dashboard (Placeholder)</h2>
            <p className="text-gray-600">Behavior plans, skills, deficits will appear here.</p>
          </section>
        </>
      )}
    </main>
  );
}
