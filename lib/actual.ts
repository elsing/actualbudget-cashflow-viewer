/**
 * Server-side Actual Budget API client.
 * All calls go through here — the API key never reaches the browser.
 */

const BASE = (process.env.ACTUAL_API_URL ?? "http://localhost:5007").replace(/\/$/, "");
const KEY  =  process.env.ACTUAL_API_KEY ?? "";

export function actualHeaders(): Record<string, string> {
  return { "x-api-key": KEY, "Content-Type": "application/json" };
}

export async function actualFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${BASE}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, { ...init, headers: { ...actualHeaders(), ...(init?.headers ?? {}) } });
}

/** Typed helpers for the endpoints we use */
export async function getBudgets() {
  const r = await actualFetch("/v1/budgets");
  if (!r.ok) throw new Error(`Actual API ${r.status}: ${r.statusText}`);
  const j = await r.json();
  return (j.data ?? j ?? []) as ActualBudget[];
}

export async function getAccounts(syncId: string) {
  const r = await actualFetch(`/v1/budgets/${syncId}/accounts`);
  if (!r.ok) throw new Error(`Actual API ${r.status}`);
  const j = await r.json();
  return (j.data ?? j ?? []) as ActualAccount[];
}

export async function getCategories(syncId: string) {
  const r = await actualFetch(`/v1/budgets/${syncId}/categories`);
  if (!r.ok) throw new Error(`Actual API ${r.status}`);
  const j = await r.json();
  return (j.data ?? j ?? []) as ActualCategory[];
}

export async function getCategoryGroups(syncId: string) {
  const r = await actualFetch(`/v1/budgets/${syncId}/categorygroups`);
  if (!r.ok) throw new Error(`Actual API ${r.status}`);
  const j = await r.json();
  return (j.data ?? j ?? []) as ActualCategoryGroup[];
}

export async function getTransactions(syncId: string, accountId: string, sinceDate: string, untilDate: string) {
  const r = await actualFetch(
    `/v1/budgets/${syncId}/accounts/${accountId}/transactions?since_date=${sinceDate}&until_date=${untilDate}`
  );
  if (!r.ok) throw new Error(`Actual API ${r.status}`);
  const j = await r.json();
  return (j.data ?? j ?? []) as ActualTransaction[];
}

export async function getBalance(syncId: string, accountId: string, cutoff?: string) {
  const qs = cutoff ? `?cutoff=${cutoff}` : "";
  const r = await actualFetch(`/v1/budgets/${syncId}/accounts/${accountId}/balance${qs}`);
  if (!r.ok) throw new Error(`Actual API ${r.status}`);
  const j = await r.json();
  return (j.data?.balance ?? j.balance ?? 0) as number;
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface ActualBudget {
  id?: string;
  groupId?: string;
  cloudFileId?: string;
  name: string;
  state?: string;
}

export interface ActualAccount {
  id: string;
  name: string;
  type?: string;
  offbudget?: boolean;
  closed?: boolean;
}

export interface ActualCategory {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  group_id?: string;
}

export interface ActualCategoryGroup {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  categories?: ActualCategory[];
}

export interface ActualTransaction {
  id: string;
  date: string;
  amount?: number;
  payee?: { name?: string } | string;
  payee_name?: string;
  imported_payee?: string;
  category?: string | { id?: string };
  account?: string;
  transfer_id?: string | null;
  is_parent?: boolean;
  is_child?: boolean;
  parent_id?: string;
  subtransactions?: ActualTransaction[];
}
