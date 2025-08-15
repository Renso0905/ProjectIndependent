"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "../../../lib/api";

type Client = { id: number; name: string; birthdate: string; info?: string | null };
type Behavior = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: "FREQUENCY" | "DURATION" | "INTERVAL" | "MTS";
  settings: Record<string, any>;
  created_at: string;
};
type Skill = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: "PERCENTAGE";
  skill_type: string; // NEW
  created_at: string;
};

export default function ClientDashboardPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [client, setClient] = useState<Client | null>(null);
  const [behaviors, setBehaviors] = useState<Behavior[] | null>(null);
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    api.clients
      .get(Number(id))
      .then(setClient)
      .catch((e) => setErr(e?.message || "Failed to load client"));

    api.clients
      .behaviors(Number(id))
      .then(setBehaviors)
      .catch(() => setBehaviors([]));

    api.clients
      .skills(Number(id))
      .then(setSkills)
      .catch(() => setSkills([]));
  }, [id]);

  return (
    <main className="min-h-screen p-8 space-y-6">
      <div className="flex items-center justify-between">
        <a href="/clients" className="px-3 py-2 border rounded-lg hover:bg-gray-50">
          ← Back to Clients
        </a>
        {id && (
          <div className="flex items-center gap-2">
            <a href={`/clients/${id}/behaviors/new`} className="px-3 py-2 border rounded-lg hover:bg-gray-50">
              + Add Behavior
            </a>
            <a href={`/clients/${id}/skills/new`} className="px-3 py-2 border rounded-lg hover:bg-gray-50">
              + Add Skill
            </a>
          </div>
        )}
      </div>

      {!client && !err && <p>Loading client…</p>}
      {err && <p className="text-red-600">{err}</p>}

      {client && (
        <>
          <h1 className="text-2xl font-bold">{client.name}</h1>
          <p className="text-gray-600">DOB: {client.birthdate}</p>
          {client.info && <p className="text-gray-700 mt-2">{client.info}</p>}

          <section className="mt-6 p-4 border rounded-xl">
            <h2 className="text-lg font-semibold mb-2">Behaviors</h2>
            {!behaviors && <p>Loading behaviors…</p>}
            {behaviors && behaviors.length === 0 && <p className="text-gray-600">No behaviors yet.</p>}
            {behaviors && behaviors.length > 0 && (
              <ul className="divide-y">
                {behaviors.map((b) => (
                  <li key={b.id} className="py-3">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-sm text-gray-600">
                      Method: {b.method}{" "}
                      {b.settings?.interval_seconds ? `(interval: ${b.settings.interval_seconds}s)` : null}
                    </div>
                    {b.description && <div className="text-sm text-gray-700">{b.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-6 p-4 border rounded-xl">
            <h2 className="text-lg font-semibold mb-2">Skills</h2>
            {!skills && <p>Loading skills…</p>}
            {skills && skills.length === 0 && <p className="text-gray-600">No skills yet.</p>}
            {skills && skills.length > 0 && (
              <ul className="divide-y">
                {skills.map((s) => (
                  <li key={s.id} className="py-3">
                    <div className="font-medium">{s.skill_type} - {s.name}</div>
                    <div className="text-sm text-gray-600">Method: {s.method}</div>
                    {s.description && <div className="text-sm text-gray-700">{s.description}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
