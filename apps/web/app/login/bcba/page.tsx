"use client";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function LoginBCBA() {
  const [username, setUsername] = useState("Renso");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setError(null), [username, password]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const { redirect } = await api.login(username, password, "BCBA");
      window.location.href = redirect || "/dashboard/bcba";
    } catch (err: any) {
      setError(err?.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form className="border rounded-2xl p-6 w-full max-w-sm space-y-3" onSubmit={onSubmit}>
        <h1 className="text-2xl font-semibold text-center">BCBA Login</h1>
        <label className="block text-sm">
          Username
          <input className="mt-1 w-full border rounded px-3 py-2" value={username} onChange={(e)=>setUsername(e.target.value)} />
        </label>
        <label className="block text-sm">
          Password
          <input type="password" className="mt-1 w-full border rounded px-3 py-2" value={password} onChange={(e)=>setPassword(e.target.value)} />
        </label>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
