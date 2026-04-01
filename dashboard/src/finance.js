import { completeMonths, uid } from "./helpers.js";
import { DEFAULT_GROUPS } from "./constants.js";

// ── Category helpers ──────────────────────────────────────────────────────────
// Categories store signed net amounts (expenses negative, income positive).
// catSpend: net outgoing spend — positive number, refunds reduce it.
export function catSpend(m, cat) {
  const v = m.categories[cat] ?? 0;
  return v < 0 ? Math.abs(v) : 0;
}
// catNet: the raw signed net — negative means net spend, positive means net income.
// Use this for categories with mixed flow (e.g. flatmate income + household expenses).
export function catNet(m, cat) {
  return m.categories[cat] ?? 0;
}

// ── Live averages (complete months only) ──────────────────────────────────────
// Uses net (signed) per category so income within a category reduces the spend.
// e.g. if "Rent" has -£800 outgoing and +£300 flatmate income, result is £500 net cost.
export function liveAvg(data, cats, n=12) {
  const months = completeMonths(data.months).slice(-n);
  if (!months.length || !cats?.length) return 0;
  // Sum the NET of selected categories — negative = net spend, take abs for display
  const total = months.reduce((sum,m) =>
    sum + Math.abs((cats||[]).reduce((t,c) => t + catNet(m,c), 0)), 0);
  return Math.round(total / months.length);
}

export function liveLastCompleteMonth(data, cats) {
  const complete = completeMonths(data.months);
  const m = complete[complete.length - 1];
  if (!m) return 0;
  return Math.abs((cats||[]).reduce((s,c) => s + catNet(m,c), 0));
}

export function liveIncome(data) {
  const months = completeMonths(data.months).slice(-12);
  if (!months.length) return 0;
  return Math.round(months.reduce((a,m) => a + m.income, 0) / months.length);
}

export function liveIncomeFromCats(data, cats) {
  const months = completeMonths(data.months).slice(-12);
  if (!months.length || !cats?.length) return 0;
  // No fallback — only count what's actually in the selected categories
  return Math.round(months.reduce((a,m) => {
    const catSum = (cats||[]).reduce((t,c) => {
      const v = m.categories[c] ?? 0;
      return t + (v > 0 ? v : 0);
    }, 0);
    return a + catSum;
  }, 0) / months.length);
}

export function lastMonthIncome(data) {
  const complete = completeMonths(data.months);
  return complete[complete.length-1]?.income ?? 0;
}

export function lastMonthIncomeFromCats(data, cats) {
  const complete = completeMonths(data.months);
  const m = complete[complete.length-1];
  if (!m || !cats?.length) return 0;
  return (cats||[]).reduce((t,c) => {
    const v = m.categories[c] ?? 0;
    return t + (v > 0 ? v : 0);
  }, 0);
}

// ── Scenario resolution ───────────────────────────────────────────────────────
export function resolveIncome(inc, data) {
  if (!inc) return liveIncome(data);
  switch (inc.type) {
    case "live":      return liveIncome(data);
    case "last":      return lastMonthIncome(data);
    case "cats":      return (inc.avgOrLast==="last"
                        ? lastMonthIncomeFromCats(data, inc.cats||[])
                        : liveIncomeFromCats(data, inc.cats||[])) + (inc.fixedExtra||0);
    case "fixed":     return inc.amount ?? liveIncome(data);
    case "pct_live":  return Math.round(liveIncome(data) * (1 + (inc.pct||0) / 100));
    default:          return liveIncome(data);
  }
}

export function resolveRow(row, incAmt, data) {
  if (!row) return 0;
  switch (row.type) {
    case "fixed":      return row.amount ?? 0;
    case "percent":    return Math.round(incAmt * (row.pct ?? 0) / 100);
    case "live":       return liveAvg(data, row.liveCategories||[]);
    // "live_group" is identical to "live" — same fn, just labelled differently
    case "live_group": return liveAvg(data, row.liveCategories||[]);
    case "last":       return liveLastCompleteMonth(data, row.liveCategories||[]);
    default:           return 0;
  }
}

// ── Balance algorithm ─────────────────────────────────────────────────────────
//
// Correct approach: for each account, fetch the real balance at the START
// of the earliest month (day before first transaction), then walk forward
// month by month adding that account's transaction net.
//
// reconciliations[accountId][monthKey] = user-entered real end balance
// Once a reconciliation is set, it replaces the calculated end balance for
// that account at that month, and all subsequent months flow from it.
// Money cannot leak — the system is always internally consistent.
//
export function computeAccountMonthBalances(accountObjects, txsByAccount, startBalances, reconciliations) {
  // txsByAccount[accountId][monthKey] = array of transactions
  // startBalances[accountId] = real balance at day before first month
  // reconciliations[accountId][monthKey] = override end balance

  const result = {}; // result[accountId][monthKey] = { start, end, net }

  for (const acct of accountObjects) {
    const id = acct.id;
    const txMonths = txsByAccount[id] || {};
    const allMonthKeys = Object.keys(txMonths).sort();
    const recs = reconciliations?.[id] || {};

    result[id] = {};
    let runBal = startBalances[id] ?? 0;

    for (const mKey of allMonthKeys) {
      const start = runBal;
      // Net from this account's transactions this month (excl transfers)
      const net = (txMonths[mKey] || []).reduce((s,tx) => s + (tx.amount||0), 0);
      let end = start + net;

      // Apply reconciliation if set — corrects the anchor from this point forward
      if (recs[mKey] !== undefined) {
        end = recs[mKey];
      }

      result[id][mKey] = { start, end, net };
      runBal = end;
    }
  }

  return result;
}

// Sum account balances across selected accounts for a given month
export function totalForMonth(accountBalances, selectedAccountIds, monthKey, field) {
  return (selectedAccountIds || Object.keys(accountBalances)).reduce((sum, id) => {
    return sum + (accountBalances[id]?.[monthKey]?.[field] ?? 0);
  }, 0);
}

// ── Default scenarios ─────────────────────────────────────────────────────────
export function mkScenarios(data) {
  const incomeCats = data.incomeCategories || [];
  const defaultIncome = incomeCats.length > 0
    ? { type:"cats", cats:incomeCats, fixedExtra:0 }
    : { type:"live" };

  const mk = (id,g,n,t,o) => ({
    id, group:g, name:n, enabled:true,
    type:t, pct:0, amount:0, liveCategories:[], ...o,
  });

  const base = [
    mk("r1","g1","Rent / Mortgage",  "live",{liveCategories:["Housing"]}),
    mk("r2","g1","Utilities",        "live",{liveCategories:["Utilities"]}),
    mk("r3","g1","Subscriptions",    "live",{liveCategories:["Subscriptions"]}),
    mk("r4","g2","Groceries & Dining","live",{liveCategories:["Food & Dining"]}),
    mk("r5","g3","Transport",        "live",{liveCategories:["Transport"]}),
    mk("r6","g4","Emergency Fund",   "percent",{pct:10}),
    mk("r7","g4","Holiday",          "percent",{pct:5}),
    mk("r8","g5","ISA / Pension",    "percent",{pct:8}),
    mk("r9","g6","Charity",          "fixed",{amount:5000}),
    mk("r10","g7","Entertainment",   "live",{liveCategories:["Entertainment"]}),
    mk("r11","g7","Shopping",        "live",{liveCategories:["Shopping"]}),
    mk("r12","g7","Healthcare",      "live",{liveCategories:["Healthcare"]}),
  ];

  return [
    { id:"s1", name:"Current Reality", color:"#2dd4bf",
      income:{...defaultIncome}, rows:base.map(r=>({...r,id:uid()})) },
    { id:"s2", name:"Best Case", color:"#4ade80",
      income:{...defaultIncome}, rows:base.map(r=>({...r,id:uid(),
        pct:r.type==="percent"?(r.pct||0)*0.8:r.pct,
        amount:r.type==="fixed"?Math.round((r.amount||0)*0.9):r.amount})) },
    { id:"s3", name:"Worst Case", color:"#f87171",
      income:{...defaultIncome,type:"pct_live",pct:-20},
      rows:base.map(r=>({...r,id:uid(),
        enabled:["g4","g5","g6"].includes(r.group)?false:r.enabled})) },
  ];
}
