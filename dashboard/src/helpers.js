import { SK } from "./constants.js";

// ── Formatters ────────────────────────────────────────────────────────────────
export const fmt  = (n) => new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format((n??0)/100);
export const fmtR = (n) => ((n??0)/100).toFixed(2);
export const pc   = (s) => Math.round(parseFloat(s||"0")*100);
export const uid  = () => `x${Date.now()}${Math.random().toString(36).slice(2,5)}`;

export const fmtM = (iso) => {
  if (!iso) return "";
  const [y,m] = iso.split("-");
  return new Date(+y,+m-1).toLocaleString("en-GB",{month:"short",year:"2-digit"});
};

export const fmtD = (iso) => {
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

// ── Storage — API-backed with localStorage fallback ───────────────────────────
const CF_API = "/cf-api";

function getBudgetId() {
  try {
    const conn = JSON.parse(localStorage.getItem("cf-connection") || "{}");
    return conn.budgetId || "demo";
  } catch { return "demo"; }
}

let _serverState    = null;
let _serverAvailable = null;

async function checkServer() {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const r = await fetch(`${CF_API}/health`, { signal: AbortSignal.timeout(2000) });
    _serverAvailable = r.ok;
  } catch { _serverAvailable = false; }
  return _serverAvailable;
}

async function loadServerState(budgetId) {
  if (_serverState) return _serverState;
  try {
    const r = await fetch(`${CF_API}/state/${budgetId}`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error("not ok");
    const j = await r.json();
    _serverState = j.state || {};
  } catch { _serverState = {}; }
  return _serverState;
}

export async function sGet(k) {
  const budgetId = getBudgetId();
  if (await checkServer()) {
    const state = await loadServerState(budgetId);
    if (state[k] !== undefined) return state[k];
    try { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } catch {}
    return null;
  }
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; }
}

export async function sSet(k, v) {
  const budgetId = getBudgetId();
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
  if (_serverState) _serverState[k] = v;
  if (!await checkServer()) return;
  try {
    await fetch(`${CF_API}/state/${budgetId}/${k}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(v),
      signal: AbortSignal.timeout(5000),
    });
  } catch { _serverAvailable = null; }
}

export function resetStateCache() {
  _serverState    = null;
  _serverAvailable = null;
}

// ── Complete months only ──────────────────────────────────────────────────────
export function completeMonths(months) {
  const cur = currentMonthKey();
  return months.filter(m => m.month < cur && m.transactions?.length > 0);
}