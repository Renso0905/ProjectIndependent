"use client";
import { useEffect, useState } from "react";
import { api } from "../lib/api";

type Health = { ok: boolean; version?: string };

export default function Home() {
  const [health, setHealth] = useState<Health | null>(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ ok: false }));
  }, []);

  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Project Independent</h1>
      <p className="text-sm text-gray-600 mb-6">
        API status:{" "}
        {health ? (health.ok ? `OK${health.version ? ` (v${health.version})` : ""}` : "offline") : "checking…"}
      </p>
      <div className="flex gap-3">
        <a href="/login/bcba" className="px-3 py-2 border rounded-lg hover:bg-gray-50">BCBA Login</a>
        <a href="/login/rbt" className="px-3 py-2 border rounded-lg hover:bg-gray-50">RBT Login</a>
      </div>
    </main>
  );
}
