"use client";

import { useEffect, useState } from "react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

export default function HomePage() {
  const [apiStatus, setApiStatus] = useState<string>("checking...");

  useEffect(() => {
    fetch(`${API_BASE}/health`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) =>
        setApiStatus(`API: ${json.status} (v${json.version})`),
      )
      .catch(() => setApiStatus("API: unreachable"));
  }, []);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>Project Independent</h1>
      <p>This is the Next.js frontend for Project Independent (Phase A).</p>

      <div
        style={{
          marginTop: 16,
          padding: 16,
          border: "1px solid #ddd",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <strong>Backend status:</strong>
        <div>{apiStatus}</div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
          Using: <code>{API_BASE}</code>
        </div>
      </div>

      <div style={{ marginTop: 24, display: "grid", gap: 12 }}>
        <a href="/login/bcba" style={linkStyle}>
          BCBA Login
        </a>
        <a href="/login/rbt" style={linkStyle}>
          RBT Login
        </a>
      </div>
    </div>
  );
}

const linkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  background: "#0b5cff",
  color: "white",
  textDecoration: "none",
  borderRadius: 8,
  width: "fit-content",
};
