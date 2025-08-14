"use client";
import { useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

export default function BCBALoginPage() {
  const [username, setUsername] = useState("Renso");
  const [password, setPassword] = useState("1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, portal: "bcba" }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data?.detail || data?.error || "Login failed",
        );
      window.location.href = data.redirectTo;
    } catch (err: any) {
      setError(
        err.message.includes("Failed to fetch")
          ? "Cannot reach API. Is it running on localhost:8001?"
          : err.message,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div style={{ width: "100%", maxWidth: 480 }}>
        <div style={{ marginBottom: 12 }}>
          <a href="/" style={backStyle} aria-label="Back to Home">
            ← Home
          </a>
        </div>

        <form onSubmit={onSubmit} style={cardStyle}>
          <h1
            className="text-2xl font-semibold text-center"
            style={{ marginBottom: 12 }}
          >
            BCBA Login
          </h1>
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input
              className="w-full border rounded px-3 py-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p style={{ color: "#b00020" }}>{error}</p>}
          <button
            disabled={busy}
            className="w-full rounded-lg px-4 py-2 border hover:bg-gray-50"
            style={{ marginTop: 8 }}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="text-center text-sm" style={{ marginTop: 8 }}>
            Not BCBA?{" "}
            <a className="underline" href="/login/rbt">
              RBT login
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #ddd",
  borderRadius: 12,
  padding: 24,
  display: "grid",
  gap: 12,
  background: "#fff",
};

const backStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ddd",
  textDecoration: "none",
  color: "#111",
  background: "#f7f7f7",
};
