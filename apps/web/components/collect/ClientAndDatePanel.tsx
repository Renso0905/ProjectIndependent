"use client";

import type { Client } from "../../lib/types";

export default function ClientAndDatePanel({
  clients,
  clientId,
  setClientId,
  sessionDate,
  setSessionDate,
  sessionLocked,
}: {
  clients: Client[];
  clientId: number | null;
  setClientId: (v: number | null) => void;
  sessionDate: string;
  setSessionDate: (v: string) => void;
  sessionLocked: boolean;
}) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <div className="text-sm mb-1">Client</div>
        <select
          className="w-full border rounded px-3 py-2"
          value={clientId ?? ""}
          onChange={(e) =>
            setClientId(e.target.value ? Number(e.target.value) : null)
          }
          disabled={sessionLocked}
        >
          <option value="">-- choose client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (DOB {c.birthdate})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <div className="text-sm mb-1">Session Date</div>
        <input
          type="date"
          className="w-full border rounded px-3 py-2"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          disabled={sessionLocked}
        />
      </label>
    </section>
  );
}
