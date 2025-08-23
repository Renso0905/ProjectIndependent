"use client";
import { useEffect, useState } from "react";
import { api, type Me } from "../../../lib/api";

export default function RBTDashboard() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let mounted = true;
    api.me()
      .then((u) => mounted && setMe(u as Me))
      .catch(() => mounted && setMe(null));
    return () => {
      mounted = false;
    };
  }, []);

  async function logout() {
    try {
      await api.logout();
    } finally {
      window.location.href = "/login/rbt";
    }
  }

  return (
    <main className="min-h-screen p-8 space-y-4">
      <h1 className="text-3xl font-bold">RBT Dashboard</h1>
      <p>{me ? `Signed in as ${me.username} (${me.role})` : "Checking session…"}</p>
      <div className="space-x-3">
        <a className="px-4 py-2 border rounded-lg hover:bg-gray-50" href="/collect">
          ▶ Start Data Collection
        </a>
        <a className="underline" href="/dashboard/bcba">
          Go to BCBA Dashboard
        </a>
        <button onClick={logout} className="px-3 py-2 border rounded-lg">
          Logout
        </button>
      </div>
    </main>
  );
}
