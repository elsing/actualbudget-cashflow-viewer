import { SK } from "./constants";

// ── Formatters ────────────────────────────────────────────────────────────────
export const fmt  = (n: number|null|undefined) =>
  new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format((n??0)/100);
export const fmtR = (n: number|null|undefined) => ((n??0)/100).toFixed(2);
export const pc   = (s: string) => Math.round(parseFloat(s||"0")*100);
export const uid  = () => `x${Date.now()}${Math.random().toString(36).slice(2,5)}`;

export const fmtM = (iso: string) => {
  if (!iso) return "";
  const [y,m] = iso.split("-");
  return new Date(+y,+m-1).toLocaleString("en-GB",{month:"short",year:"2-digit"});
};
export const fmtD = (iso: string) => {
  if (!iso) return "";
  const p = iso.split("-");
  return new Date(+p[0],+p[1]-1,+p[2]).toLocaleString("en-GB",{month:"short",day:"numeric"});
};
export const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
export const currentMonthKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
};

// ── Storage ───────────────────────────────────────────────────────────────────
//
// Two-tier strategy:
//   1. localStorage — always written first, works offline, instant reads
//   2. /api/state   — synced in the background, authoritative for cross-device
//
// On read: try DB first (freshest cross-device state), fall back to localStorage.
// On write: write localStorage synchronously, fire DB write async (fire-and-forget).
// If the server is offline: localStorage keeps everything safe. When the server
// comes back, the next sSet will sync the latest value.
//
// The /api/health endpoint tells the UI whether cross-device sync is active —
// it is NOT a gate on whether state is saved. State is always saved locally.

function getBudgetId(): string {
  try { return JSON.parse(localStorage.getItem("cf-connection")||"{}").budgetId || "demo"; }
  catch { return "demo"; }
}

// Per-session cache of server state — avoids repeated fetches within a session
let _serverState: Record<string,unknown>|null = null;
let _serverChecked = false;

async function loadServerState(budgetId: string): Promise<Record<string,unknown>> {
  if (_serverState) return _serverState;
  try {
    const r = await fetch(`/api/state/${budgetId}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error("not ok");
    const j = await r.json();
    _serverState = j.state || {};
  } catch {
    _serverState = {};
  }
  return _serverState!;
}

export async function sGet(k: string): Promise<unknown> {
  const budgetId = getBudgetId();
  try {
    const state = await loadServerState(budgetId);
    if (state[k] !== undefined) return state[k];
  } catch {}
  // Fall back to localStorage
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function sSet(k: string, v: unknown): Promise<void> {
  // 1. Write localStorage immediately — never loses data
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}

  // 2. Update local session cache
  if (_serverState) _serverState[k] = v;

  // 3. Sync to server in background — fire and forget
  const budgetId = getBudgetId();
  try {
    fetch(`/api/state/${budgetId}/${k}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Server write failed — localStorage backup already has it, no action needed
    });
  } catch {}
}

export function resetStateCache(): void {
  _serverState  = null;
  _serverChecked = false;
}

// ── Complete months only ──────────────────────────────────────────────────────
export function completeMonths<T extends { month: string; transactions?: unknown[] }>(months: T[]): T[] {
  const cur = currentMonthKey();
  return months.filter(m => m.month < cur && (m.transactions?.length ?? 0) > 0);
}
