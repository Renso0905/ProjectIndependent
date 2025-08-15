// apps/web/lib/api.ts

// ---- Base URL ----
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8001/api";

// ---- Session helpers (used by apiFetch + login/logout) ----
function getSessionHeaders() {
  if (typeof window === "undefined") return {};
  const uid = localStorage.getItem("uid");
  const uname = localStorage.getItem("uname");
  const h: Record<string, string> = {};
  if (uid) {
    h["X-User-Id"] = uid;
    h["Authorization"] = `Bearer ${uid}`;   // <-- add bearer fallback
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
type ApiError = { status: number; message: string };

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
          return text as any;
        }
      })()
    : null;

  if (!res.ok) {
    const message =
      (data && (data.detail || data.error || data.message)) || `HTTP ${res.status}`;
    const err: ApiError = { status: res.status, message };
    throw err;
  }
  return data as T;
}

// ---- Shared types (match backend) ----
export type Me = { username: string; role: "BCBA" | "RBT" };

export type Client = {
  id: number;
  name: string;
  birthdate: string;
  info?: string | null;
};

export type Method = "FREQUENCY" | "DURATION" | "INTERVAL" | "MTS";

export type Behavior = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: Method;
  settings: any;
  created_at: string;
};

export type Skill = {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: "PERCENTAGE";
  skill_type: string; // e.g., "LR", "MAND", ...
  created_at: string;
};

export type Session = {
  id: number;
  client_id: number;
  started_at: string;
  ended_at: string | null;
};

export type BehaviorEventOut = {
  behavior_id: number;
  event_type: "INC" | "DEC" | "START" | "STOP" | "HIT";
  value?: number | null;
  happened_at?: string;
  extra?: any;
};

export type SkillEventOut = {
  skill_id: number;
  event_type: "CORRECT" | "WRONG";
  happened_at?: string;
};

export type AnalysisPoint = { date: string; value: number; session_count?: number };

export type BehaviorAnalysis = {
  behavior: { id: number; name: string; method: string };
  points: AnalysisPoint[];
};

export type SkillAnalysis = {
  skill: { id: number; name: string; method: string; skill_type?: string };
  points: AnalysisPoint[];
};

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
    await apiFetch<{ ok: boolean }>("/auth/logout", { method: "POST", body: "{}" });
    clearSessionUser();
  },

  // clients & resources
  clients: {
    list: () => apiFetch<Client[]>("/collect/clients"),
    get: (id: number) => apiFetch<Client>(`/clients/${id}`),

    behaviors: (id: number) =>
      apiFetch<Behavior[]>(`/collect/clients/${id}/behaviors`),

    skills: (id: number) => apiFetch<Skill[]>(`/collect/clients/${id}/skills`),

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
        method: Method;
        settings?: any;
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
        method?: "PERCENTAGE";
        skill_type?: string; // defaulted on server to OTHER if missing
      }
    ) =>
      apiFetch<Skill>(`/clients/${clientId}/skills`, {
        method: "POST",
        body: JSON.stringify({ method: "PERCENTAGE", skill_type: "OTHER", ...payload }),
      }),
  },

  // sessions & events
  sessions: {
    start: (client_id: number, date: string) =>
      apiFetch<Session>("/sessions/start", {
        method: "POST",
        body: JSON.stringify({ client_id, date }),
      }),

    end: (id: number) =>
      apiFetch<Session>(`/sessions/${id}/end`, {
        method: "POST",
        body: "{}",
      }),

    postEvents: (id: number, events: BehaviorEventOut[]) =>
      apiFetch<{ ok: boolean; created: number }>(`/sessions/${id}/events`, {
        method: "POST",
        body: JSON.stringify({ events }),
      }),

    postSkillEvents: (id: number, events: SkillEventOut[]) =>
      apiFetch<{ ok: boolean; created: number }>(`/sessions/${id}/skill-events`, {
        method: "POST",
        body: JSON.stringify({ events }),
      }),
  },

  // analysis
  analysis: {
    behavior: (behaviorId: number) =>
      apiFetch<BehaviorAnalysis>(`/analysis/behavior/${behaviorId}/session-points`),

    skill: (skillId: number) =>
      apiFetch<SkillAnalysis>(`/analysis/skill/${skillId}/session-points`),
  },
};
