"use client";
import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";
type Me = { username: string; role: "BCBA" | "RBT" };

export default function BCBADashboard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setMe)
      .catch(() => setMe(null));
  }, []);

  async function logout() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login/bcba";
  }

  return (
    <main className="min-h-screen p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">BCBA Dashboard</h1>
          <p className="text-gray-600">
            {me ? `Signed in as ${me.username} (${me.role})` : "Checking session…"}
          </p>
        </div>
        <div className="space-x-3">
          <a className="underline" href="/dashboard/rbt">
            Go to RBT Dashboard
          </a>
          <button onClick={logout} className="px-3 py-2 border rounded-lg">
            Logout
          </button>
        </div>
      </header>

      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <a href="/collect" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            ▶ Start Data Collection
          </a>
          <a href="/clients/new" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            + Create Client
          </a>
          <a href="/clients" className="px-4 py-2 border rounded-lg hover:bg-gray-50">
            View Clients
          </a>
        </div>
      </section>
    </main>
  );
}
