"use client";
import { useEffect, useState } from "react";
import { api } from "../../lib/api";

type Client = { id: number; name: string; birthdate: string; info?: string | null };

export default function ClientsPage() {
  const [items, setItems] = useState<Client[] | null>(null);

  useEffect(() => {
    api.clients.list().then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between">
        <a href="/dashboard/bcba" className="px-3 py-2 border rounded-lg hover:bg-gray-50">← Back to Dashboard</a>
        <a href="/clients/new" className="px-3 py-2 border rounded-lg hover:bg-gray-50">+ Add Client</a>
      </div>

      <h1 className="text-2xl font-bold mt-6 mb-4">Clients</h1>

      {!items && <p>Loading…</p>}
      {items && items.length === 0 && <p className="text-gray-600">No clients yet.</p>}
      {items && items.length > 0 && (
        <ul className="divide-y">
          {items.map((c) => (
            <li key={c.id} className="py-3">
              <a href={`/clients/${c.id}`} className="font-medium hover:underline">{c.name}</a>
              <div className="text-sm text-gray-600">DOB: {c.birthdate}</div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
