// Single source of truth for API shapes used by the web app.
// Keep these aligned with the backend FastAPI models.

export type Role = "BCBA" | "RBT";

export interface Me {
  id: number;
  username: string;
  role: Role;
}

// --- Clients ---
export interface Client {
  id: number;
  name: string;
  birthdate: string;         // ISO yyyy-mm-dd
  info?: string | null;
  created_at: string;        // ISO datetime
}

// --- Behaviors ---
export type DataCollectionMethod = "FREQUENCY" | "DURATION" | "INTERVAL" | "MTS";

export interface Behavior {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: DataCollectionMethod;
  settings: Record<string, unknown>;
  created_at: string;        // ISO datetime
}

export type BehaviorEventType = "INC" | "DEC" | "START" | "STOP" | "HIT";

export interface BehaviorEvent {
  id: number;
  session_id: number;
  behavior_id: number;
  event_type: BehaviorEventType;
  value?: number | null;     // +1/-1 or seconds (STOP)
  happened_at: string;       // ISO datetime
  extra?: Record<string, unknown>;
}

export interface BehaviorSession {
  id: number;
  client_id: number;
  started_at: string;        // ISO datetime
  ended_at?: string | null;  // ISO datetime
}

// --- Skills ---
export type SkillMethod = "PERCENTAGE";

export type SkillType =
  | "LR" | "MAND" | "TACT" | "IV" | "MI"
  | "PLAY" | "VP" | "ADL" | "SOC" | "ACAD" | "OTHER";

export interface Skill {
  id: number;
  client_id: number;
  name: string;
  description?: string | null;
  method: SkillMethod;
  skill_type: SkillType;
  created_at: string;        // ISO datetime
}

export type SkillEventType = "CORRECT" | "WRONG";

export interface SkillEvent {
  id: number;
  session_id: number;
  skill_id: number;
  event_type: SkillEventType;
  happened_at: string;       // ISO datetime
}

// --- Analysis responses (convenience) ---
export interface DatedPoint {
  date: string;              // server sends date (yyyy-mm-dd)
  value: number;             // count, seconds, or percentage
  session_count: number;
}
