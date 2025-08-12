"use client";
import { useEffect, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001/api";

type Me = { username: string; role: "BCBA" | "RBT" };

export default function RBTDashboard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login/rbt";
  }

  return (
    <main className="min-h-screen p-8 space-y-4">
      <h1 className="text-3xl font-bold">RBT Dashboard (Placeholder)</h1>
      <p>{me ? `Signed in as ${me.username} (${me.role})` : "Checking session…"}</p>
      <div className="space-x-3">
        <a className="underline" href="/dashboard/bcba">Go to BCBA Dashboard</a>
        <button onClick={logout} className="px-3 py-2 border rounded-lg">Logout</button>
      </div>
    </main>
  );
}
