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
//
// cf-connection bootstrap: on a fresh machine localStorage is empty, so we fall
// back to /api/state/global/cf-connection (written at connect time) to recover
// the budgetId before any state reads happen. This is what makes calibration and
// all other DB-persisted state load correctly on new devices without re-connecting.

async function getBudgetId(): Promise<string> {
  // Fast path — already connected on this machine
  try {
    const id = JSON.parse(localStorage.getItem("cf-connection") || "{}").budgetId;
    if (id) return id;
  } catch {}
  // Cold start — fetch from DB bootstrap record written at connect time
  try {
    const r = await fetch("/api/state/global/cf-connection", { signal: AbortSignal.timeout(2000) });
    if (r.ok) {
      const j = await r.json();
      const id = j.value?.budgetId;
      if (id) {
        // Warm the localStorage cache so subsequent sync reads are instant
        try {
          const existing = JSON.parse(localStorage.getItem("cf-connection") || "{}");
          localStorage.setItem("cf-connection", JSON.stringify({ ...j.value, ...existing }));
        } catch {}
        return id;
      }
    }
  } catch {}
  return "demo";
}

// Per-session cache of server state — avoids repeated fetches within a session
let _serverState: Record<string,unknown>|null = null;

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
  const budgetId = await getBudgetId();
  try {
    const state = await loadServerState(budgetId);
    if (state[k] !== undefined) return state[k];
  } catch {}
  // Fall back to localStorage
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function sSet(k: string, v: unknown, loadedAt?: number): Promise<void> {
  // 1. Write localStorage immediately — never loses data
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}

  // 2. Update local session cache
  if (_serverState) _serverState[k] = v;

  // 3. Sync to server in background — fire and forget
  const budgetId = await getBudgetId();
  try {
    const payload = loadedAt != null ? { ...(v as object), _loadedAt: loadedAt } : v;
    fetch(`/api/state/${budgetId}/${k}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    }).catch(() => {
      // Server write failed — localStorage backup already has it, no action needed
    });
  } catch {}
}

// Persist the connection config to the DB under a stable global key so any new
// machine can bootstrap itself without going through the connection wizard again.
export async function sSetConnection(
  budgetId: string,
  accountIds: string[],
  typeOverrides: Record<string,string>
): Promise<void> {
  try {
    await fetch("/api/state/global/cf-connection", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ budgetId, accountIds, typeOverrides }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {}
}

export function resetStateCache(): void {
  _serverState = null;
}

// ── Complete months only ──────────────────────────────────────────────────────
export function completeMonths<T extends { month: string; transactions?: unknown[] }>(months: T[]): T[] {
  const cur = new Date().toISOString().slice(0,7);
  return months.filter(m => m.month < cur && (m.transactions?.length ?? 0) > 0);
}
