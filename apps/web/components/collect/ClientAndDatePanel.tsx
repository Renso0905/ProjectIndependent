"use client";
type Client = { id: number; name: string; birthdate: string };

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
    <section className="grid md:grid-cols-2 gap-4">
      <div className="border rounded-xl p-4 space-y-2">
        <label className="block text-sm">Select Client</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={clientId ?? ""}
          onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : null)}
          disabled={sessionLocked}
        >
          <option value="">-- choose client --</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} (DOB {c.birthdate})
            </option>
          ))}
        </select>
      </div>
      <div className="border rounded-xl p-4 space-y-2">
        <label className="block text-sm">Session Date</label>
        <input
          type="date"
          className="w-full border rounded px-3 py-2"
          value={sessionDate}
          onChange={(e) => setSessionDate(e.target.value)}
          disabled={!clientId || sessionLocked}
        />
      </div>
    </section>
  );
}
