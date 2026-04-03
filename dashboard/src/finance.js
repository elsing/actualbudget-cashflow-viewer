import { completeMonths, uid } from "./helpers.js";
import { DEFAULT_GROUPS } from "./constants.js";

// ── Category helpers ──────────────────────────────────────────────────────────
// Categories store signed net amounts (expenses negative, income positive).
// catSpend: net outgoing — positive, refunds reduce it.
export function catSpend(m, cat) {
  const v = m.categories[cat] ?? 0;
  return v < 0 ? Math.abs(v) : 0;
}

// ── Live averages (complete months only) ──────────────────────────────────────
// Uses absolute net so a category with mixed income/expense (e.g. flatmate rent)
// reflects the real net cost rather than just the gross spend.
export function liveAvg(data, cats, n=12) {
  const months = completeMonths(data.months).slice(-n);
  if (!months.length || !cats?.length) return 0;
  const total = months.reduce((sum,m) =>
    sum + Math.abs((cats||[]).reduce((t,c) => t + (m.categories[c]??0), 0)), 0);
  return Math.round(total / months.length);
}

export function liveLastCompleteMonth(data, cats) {
  const complete = completeMonths(data.months);
  const m = complete[complete.length - 1];
  if (!m) return 0;
  return Math.abs((cats||[]).reduce((s,c) => s + (m.categories[c]??0), 0));
}

export function liveIncome(data) {
  const months = completeMonths(data.months).slice(-12);
  if (!months.length) return 0;
  return Math.round(months.reduce((a,m) => a + m.income, 0) / months.length);
}

// ── Scenario resolution ───────────────────────────────────────────────────────
export function resolveIncome(inc, data) {
  if (!inc) return liveIncome(data);
  const live = liveIncome(data);
  switch (inc.type) {
    case "live":     return live;
    case "last": {
      const complete = completeMonths(data.months);
      return complete[complete.length-1]?.income ?? live;
    }
    case "cats": {
      const months = completeMonths(data.months).slice(-12);
      if (!months.length || !inc.cats?.length) return live;
      const fn = inc.avgOrLast === "last"
        ? () => {
            const m = months[months.length-1];
            return (inc.cats||[]).reduce((t,c)=>{ const v=m.categories[c]??0; return t+(v>0?v:0); },0);
          }
        : () => Math.round(months.reduce((a,m)=>{
            return a + (inc.cats||[]).reduce((t,c)=>{ const v=m.categories[c]??0; return t+(v>0?v:0); },0);
          },0) / months.length);
      return fn() + (inc.fixedExtra||0);
    }
    case "fixed":    return inc.amount ?? live;
    case "pct_live": return Math.round(live * (1 + (inc.pct||0) / 100));
    default:         return live;
  }
}

export function resolveRow(row, incAmt, data) {
  if (!row) return 0;
  const type = row.type === "live_group" ? "live" : row.type; // backwards compat
  switch (type) {
    case "fixed":   return row.amount ?? 0;
    case "percent": return Math.round(incAmt * (row.pct ?? 0) / 100);
    case "live":    return liveAvg(data, row.liveCategories||[]);
    case "last":    return liveLastCompleteMonth(data, row.liveCategories||[]);
    default:        return 0;
  }
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