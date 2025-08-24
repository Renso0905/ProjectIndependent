// apps/web/lib/api.ts
//
//  Single source of truth for ALL HTTP calls.
//  Do NOT call `fetch()` or reference `NEXT_PUBLIC_API_BASE` anywhere outside this file.
//  Pages/components must import and use `api.<method>()` only.

import type {
  Me,
  Client,
  Behavior,
  Skill,
  BehaviorSession,
  BehaviorEvent,
  SkillEvent,
  BehaviorEventType,
  SkillEventType,
  DatedPoint,
  // NEW
  SessionSummary,
  SessionDetails,
} from "./types";

// Re-export shared types so pages can import from either "lib/types" or "lib/api"
export * from "./types";

// ---- Base URL ----
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

// ---- Session helpers (used by apiFetch + login/logout) ----
function getSessionHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const uid = localStorage.getItem("uid");
  const uname = localStorage.getItem("uname");
  const h: Record<string, string> = {};
  if (uid) {
    h["X-User-Id"] = uid;
    // Bearer fallback for dev-friendly header auth (API also reads cookies)
    h["Authorization"] = `Bearer ${uid}`;
  }
  if (uname) h["X-Username"] = uname;
  return h;
}

function setSessionUser(id?: number, username?: string) {
  if (typeof window === "undefined") return;
  if (id != null) localStorage.setItem("uid", String(id));
  if (username) localStorage.setItem("uname", username);
}

function clearSessionUser() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("uid");
  localStorage.removeItem("uname");
}

// ---- Fetch wrapper ----
export type ApiError = { status: number; message: string };

async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getSessionHeaders(),
      ...(init?.headers || {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text
    ? (() => {
        try {
          return JSON.parse(text);
        } catch {
          return text as unknown;
        }
      })()
    : null;

  if (!res.ok) {
    const message =
      (data && (data as any).detail) ||
      (data && (data as any).error) ||
      (data && (data as any).message) ||
      `HTTP ${res.status}`;
    const err: ApiError = { status: res.status, message };
    throw err;
  }

  return data as T;
}

// ---- API surface ----
export const api = {
  // health
  health: () => apiFetch<{ ok: boolean; version?: string }>("/health"),

  // auth
  me: () => apiFetch<Me>("/auth/me"),

  login: async (username: string, password: string, portal: "BCBA" | "RBT") => {
    const data = await apiFetch<{
      redirect: string;
      user_id?: number;
      username?: string;
      role?: string;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password, portal }),
    });
    if (data?.user_id && data?.username) setSessionUser(data.user_id, data.username);
    return data;
  },

  logout: async () => {
    await apiFetch<{ ok: boolean }>("/auth/logout", {
      method: "POST",
      body: "{}",
    });
    clearSessionUser();
  },

  // clients & resources
  clients: {
    list: () => apiFetch<Client[]>("/collect/clients"),
    get: (id: number) => apiFetch<Client>(`/clients/${id}`),

    behaviors: (id: number) =>
      apiFetch<Behavior[]>(`/collect/clients/${id}/behaviors`),

    skills: (id: number) =>
      apiFetch<Skill[]>(`/collect/clients/${id}/skills`),

    create: (payload: { name: string; birthdate: string; info?: string | null }) =>
      apiFetch<Client>("/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    createBehavior: (
      clientId: number,
      payload: {
        name: string;
        description?: string | null;
        method: Behavior["method"];
        settings?: Record<string, unknown>;
      }
    ) =>
      apiFetch<Behavior>(`/clients/${clientId}/behaviors`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),

    createSkill: (
      clientId: number,
      payload: {
        name: string;
        description?: string | null;
        method?: Skill["method"]; // defaults to PERCENTAGE on server
        skill_type?: Skill["skill_type"]; // defaults to OTHER on server
      }
    ) =>
      apiFetch<Skill>(`/clients/${clientId}/skills`, {
        method: "POST",
        body: JSON.stringify({
          method: "PERCENTAGE",
          skill_type: "OTHER",
          ...payload,
        }),
      }),
  },

  // sessions & events
  sessions: {
    start: (client_id: number, date: string) =>
      apiFetch<BehaviorSession>("/sessions/start", {
        method: "POST",
        body: JSON.stringify({ client_id, date }),
      }),

    end: (id: number) =>
      apiFetch<BehaviorSession>(`/sessions/${id}/end`, {
        method: "POST",
        body: "{}",
      }),

    postEvents: (id: number, events: Array<{ behavior_id: number; event_type: BehaviorEventType; value?: number | null; happened_at: string; extra?: Record<string, unknown> }>) =>
      apiFetch<{ ok: boolean; created: number }>(`/sessions/${id}/events`, {
        method: "POST",
        body: JSON.stringify({ events }),
      }),

    postSkillEvents: (id: number, events: Array<{ skill_id: number; event_type: SkillEventType; happened_at: string }>) =>
      apiFetch<{ ok: boolean; created: number }>(`/sessions/${id}/skill-events`, {
        method: "POST",
        body: JSON.stringify({ events }),
      }),

    // NEW
    list: (opts?: { date_from?: string; date_to?: string; client_id?: number }) => {
      const params = new URLSearchParams();
      if (opts?.date_from) params.set("date_from", opts.date_from);
      if (opts?.date_to) params.set("date_to", opts.date_to);
      if (opts?.client_id != null) params.set("client_id", String(opts.client_id));
      const q = params.toString();
      return apiFetch<SessionSummary[]>(`/sessions${q ? `?${q}` : ""}`);
    },

    details: (id: number) => apiFetch<SessionDetails>(`/sessions/${id}/details`),

    delete: (id: number) =>
      apiFetch<void>(`/sessions/${id}`, { method: "DELETE" }),

    deleteBehaviorEvent: (eventId: number) =>
      apiFetch<void>(`/sessions/events/behavior/${eventId}`, { method: "DELETE" }),

    deleteSkillEvent: (eventId: number) =>
      apiFetch<void>(`/sessions/events/skill/${eventId}`, { method: "DELETE" }),
  },

  // analysis
  analysis: {
    behavior: (behaviorId: number) =>
      apiFetch<DatedPoint[]>(`/analysis/behavior/${behaviorId}/session-points`),
    skill: (skillId: number) =>
      apiFetch<DatedPoint[]>(`/analysis/skill/${skillId}/session-points`),
  },
};
