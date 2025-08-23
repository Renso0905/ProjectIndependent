"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Client } from "../../lib/types";

export default function ClientsPage() {
  const [items, setItems] = useState<Client[] | null>(null);

  useEffect(() => {
    api.clients
      .list()
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <main className="min-h-screen p-6 space-y-4">
      <header className="flex items-center justify-between">
        <a href="/dashboard/bcba" className="underline">
          ← Back to Dashboard
        </a>
        <a href="/clients/new" className="px-3 py-2 border rounded-lg hover:bg-gray-50">
          + Add Client
        </a>
      </header>

      <h1 className="text-2xl font-semibold">Clients</h1>

      {!items && <p>Loading…</p>}

      {items && items.length === 0 && <p>No clients yet.</p>}

      {items && items.length > 0 && (
        <ul className="space-y-3">
          {items.map((c) => (
            <li key={c.id} className="border rounded-lg p-3">
              <a className="underline" href={`/clients/${c.id}`}>
                {c.name}
              </a>
              <div className="text-sm text-gray-600">DOB: {c.birthdate}</div>
              {c.info ? <div className="text-sm mt-1">{c.info}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
