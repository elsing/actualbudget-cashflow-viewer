"use client";
import { useState, useMemo } from "react";
import { ComposedChart, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { UiState, AppData, Month } from "@/types";
import { C, FONT, CAT_PALETTE } from "@/lib/constants";
import { fmt, fmtM, completeMonths } from "@/lib/helpers";
import { catSpend } from "@/lib/finance";
import { Chip, ChartTip, RangeButtons } from "@/components/ui";

const yFmt = (v: number) => `£${Math.abs(v/100).toLocaleString("en-GB",{maximumFractionDigits:0})}`;

type VisState = { income: boolean; expenses: boolean; net: boolean };
type SetUi = (patch: Partial<UiState>) => void;

interface TabProps {
  data: AppData;
  uiState?: Partial<UiState>;
  setUi?: SetUi;
}

// ── Overview tab ──────────────────────────────────────────────────────────────
export function OverviewTab({ data, uiState = {}, setUi = () => {} }: TabProps) {
  const range    = uiState.overviewRange ?? 6;
  const vis      = uiState.overviewVis ?? { income: true, expenses: true, net: true };
  const selCats  = uiState.overviewCats ?? null;
  const incomeCats = uiState.overviewIncomeCats ?? null;
  const [showFilter, setShowFilter] = useState(false);

  const setRange      = (v: number)       => setUi({ overviewRange: v });
  const setVis        = (fn: (v: VisState) => VisState) => setUi({ overviewVis: fn(vis) });
  const setSelCats    = (v: string[] | null) => setUi({ overviewCats: v });
  const setIncomeCats = (v: string[] | null) => setUi({ overviewIncomeCats: v });

  const allCats       = data.categories;
  const allIncomeCats = data.incomeCategories || [];
  const activeCats    = selCats ?? allCats;
  const activeIncCats = incomeCats; // null = use m.income

  const toggleCat = (cat: string) => {
    const n = activeCats.includes(cat) ? activeCats.filter(c => c !== cat) : [...activeCats, cat];
    setSelCats(n.length === allCats.length ? null : n);
  };
  const toggleIncomeCat = (cat: string) => {
    const cur = activeIncCats ?? allIncomeCats;
    const n = cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat];
    setIncomeCats(n.length === allIncomeCats.length ? null : n);
  };

  const months   = data.months.slice(-range);
  const complete = completeMonths(data.months).slice(-range);

  const filteredIncome   = (m: Month) =>
    !activeIncCats ? m.income
    : activeIncCats.reduce((s, c) => s + Math.max(0, m.categories[c] ?? 0), 0);

  const filteredExpenses = (m: Month) =>
    activeCats.reduce((s, c) => s + catSpend(m, c), 0);

  const filteredNet = (m: Month) =>
    selCats === null && !activeIncCats
      ? m.endBalance - m.startBalance
      : filteredIncome(m) - filteredExpenses(m);

  const last = months[months.length - 1];
  const prev = months[months.length - 2];
  const pct  = (a: number, b: number) => b ? ((a - b) / Math.abs(b) * 100) : 0;

  const chartData = months.map(m => ({
    month:    m.month,
    income:   filteredIncome(m),
    expenses: filteredExpenses(m),
    net:      filteredNet(m),
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Stat cards */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {([
          { l: "INCOME",      v: fmt(last ? filteredIncome(last) : 0),   d: pct(filteredIncome(last), filteredIncome(prev)),     c: C.teal,  sub: activeIncCats ? `${activeIncCats.length} categories` : "income-flagged" },
          { l: "EXPENSES",    v: fmt(last ? filteredExpenses(last) : 0), d: pct(filteredExpenses(last), filteredExpenses(prev)), c: C.red,   sub: selCats ? `${activeCats.length} categories` : "all categories" },
          { l: "NET",         v: fmt(last ? filteredNet(last) : 0),      d: pct(filteredNet(last), filteredNet(prev)),           c: (last ? filteredNet(last) : 0) >= 0 ? C.amber : C.red, sub: selCats || activeIncCats ? "income − expenses" : "end − start balance" },
          { l: `${range}MO`,  v: fmt(complete.reduce((a, m) => a + filteredNet(m), 0)), c: C.blue, sub: "cumulative net" },
        ] as { l: string; v: string; d?: number; c: string; sub: string }[]).map(({ l, v, d, c, sub }) => (
          <div key={l} style={{ flex: "1 1 140px", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "16px 20px" }}>
            <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>{l}</div>
            <div style={{ color: c, fontSize: 22, fontWeight: 700 }}>{v}</div>
            {d != null && <div style={{ color: d >= 0 ? C.teal : C.red, fontSize: 11, marginTop: 4 }}>{d >= 0 ? "▲" : "▼"} {Math.abs(d).toFixed(1)}%</div>}
            <div style={{ color: C.muted, fontSize: 9, marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <RangeButtons value={range} onChange={setRange} options={[3, 6, 12, 24]} data={data} />
        <div style={{ flex: 1 }} />
        {(["income", "expenses", "net"] as const).map(k => (
          <Chip key={k} label={k.charAt(0).toUpperCase() + k.slice(1)} color={k === "income" ? C.teal : k === "expenses" ? C.red : C.amber}
            active={vis[k]} onClick={() => setVis(v => ({ ...v, [k]: !v[k] }))} />
        ))}
        <button onClick={() => setShowFilter(o => !o)}
          style={{ fontFamily: FONT, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
            border: `1px solid ${(showFilter || selCats || activeIncCats) ? C.amber : C.border}`,
            background: (showFilter || selCats || activeIncCats) ? `${C.amber}22` : "transparent",
            color: (showFilter || selCats || activeIncCats) ? C.amber : C.textDim }}>
          filter ▾
        </button>
      </div>

      {/* Filter panel */}
      {showFilter && (
        <div style={{ background: C.surface, border: `1px solid ${C.amber}44`, borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
          {allIncomeCats.length > 0 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ color: C.teal, fontSize: 10, letterSpacing: 2 }}>INCOME CATEGORIES</div>
                <button onClick={() => setIncomeCats(null)} style={{ background: "transparent", border: "none", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT }}>reset</button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {allIncomeCats.map(cat => (
                  <Chip key={cat} label={cat} color={C.teal} active={(activeIncCats ?? allIncomeCats).includes(cat)} small onClick={() => toggleIncomeCat(cat)} />
                ))}
              </div>
            </div>
          )}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ color: C.red, fontSize: 10, letterSpacing: 2 }}>EXPENSE CATEGORIES</div>
              <button onClick={() => setSelCats(null)} style={{ background: "transparent", border: "none", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT }}>reset</button>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {allCats.map((cat, i) => (
                <Chip key={cat} label={cat} color={CAT_PALETTE[i % CAT_PALETTE.length]}
                  active={activeCats.includes(cat)} onClick={() => toggleCat(cat)} small />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData}>
            <defs>
              <linearGradient id="iG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.28} /><stop offset="100%" stopColor={C.teal} stopOpacity={0} /></linearGradient>
              <linearGradient id="eG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.red} stopOpacity={.22} /><stop offset="100%" stopColor={C.red} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={fmtM} tick={{ fill: C.textDim, fontSize: 11 }} />
            <YAxis tickFormatter={yFmt} tick={{ fill: C.textDim, fontSize: 11 }} width={68} />
            <Tooltip content={<ChartTip />} />
            {vis.income   && <Area type="monotone" dataKey="income"   name="Income"   stroke={C.teal} fill="url(#iG)" strokeWidth={2} dot={false} />}
            {vis.expenses && <Area type="monotone" dataKey="expenses" name="Expenses" stroke={C.red}  fill="url(#eG)" strokeWidth={2} dot={false} />}
            {vis.net      && <Bar  dataKey="net" name="Net" fill={C.amber} opacity={.75} radius={[3, 3, 0, 0]} />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Categories tab ────────────────────────────────────────────────────────────
interface CatTotal { name: string; color: string; group: string; avg: number; }

export function CategoriesTab({ data, uiState = {}, setUi = () => {} }: TabProps) {
  const range      = uiState.catsRange ?? 6;
  const showGroups = uiState.catsShowGroups ?? true;
  const rawVis     = uiState.catsVis;
  const vis        = rawVis ?? Object.fromEntries(data.categories.map(c => [c, true])) as Record<string, boolean>;

  const setRange      = (v: number)  => setUi({ catsRange: v });
  const setShowGroups = (v: boolean) => setUi({ catsShowGroups: v });
  const setVis        = (fn: (v: Record<string, boolean>) => Record<string, boolean>) => setUi({ catsVis: fn(vis) });

  const allMonths    = data.months.slice(-range);
  const complete     = completeMonths(data.months).slice(-range);
  const catGroups    = data.categoryGroups || [];
  const catGroupMap  = data.catGroupMap || {};
  const hasGroups    = catGroups.filter(g => !g.is_income).length > 0;

  const catTotals: CatTotal[] = data.categories.map((cat, i) => ({
    name:  cat,
    color: CAT_PALETTE[i % CAT_PALETTE.length],
    group: catGroupMap[cat] || "Other",
    avg:   complete.length ? Math.round(complete.reduce((a, m) => a + catSpend(m, cat), 0) / complete.length) : 0,
  })).sort((a, b) => b.avg - a.avg);

  const totalAvg = catTotals.filter(c => vis[c.name]).reduce((a, c) => a + c.avg, 0);

  const chartData = allMonths.map(m => {
    const r: Record<string, number | string> = { month: m.month };
    data.categories.forEach(c => { if (vis[c]) r[c] = catSpend(m, c); });
    return r;
  });

  const groupedCats = useMemo(() => {
    if (!hasGroups || !showGroups) return [{ name: null as string | null, cats: catTotals }];
    const groups: Record<string, CatTotal[]> = {};
    catTotals.forEach(c => {
      const g = c.group || "Other";
      if (!groups[g]) groups[g] = [];
      groups[g].push(c);
    });
    return Object.entries(groups)
      .map(([name, cats]) => ({ name, cats: [...cats].sort((a, b) => b.avg - a.avg) }))
      .sort((a, b) => {
        const sa = a.cats.reduce((s, c) => s + c.avg, 0);
        const sb = b.cats.reduce((s, c) => s + c.avg, 0);
        return sb - sa;
      });
  }, [catTotals, hasGroups, showGroups]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <RangeButtons value={range} onChange={setRange} options={[3, 6, 12, 24]} data={data} />
        <div style={{ flex: 1 }} />
        {hasGroups && (
          <button onClick={() => setShowGroups(!showGroups)}
            style={{ fontFamily: FONT, fontSize: 10, padding: "4px 12px", borderRadius: 6, cursor: "pointer",
              border: `1px solid ${showGroups ? C.amber : C.border}`, background: showGroups ? `${C.amber}22` : "transparent", color: showGroups ? C.amber : C.textDim }}>
            {showGroups ? "grouped" : "flat"}
          </button>
        )}
        {catTotals.map(cat => (
          <Chip key={cat.name} label={cat.name} color={cat.color} active={vis[cat.name]}
            onClick={() => setVis(v => ({ ...v, [cat.name]: !v[cat.name] }))} small />
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 24 }}>
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={chartData}>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3" />
            <XAxis dataKey="month" tickFormatter={fmtM} tick={{ fill: C.textDim, fontSize: 11 }} />
            <YAxis tickFormatter={yFmt} tick={{ fill: C.textDim, fontSize: 11 }} width={68} />
            <Tooltip content={<ChartTip />} />
            {catTotals.map(cat => vis[cat.name] && (
              <Bar key={cat.name} dataKey={cat.name} name={cat.name} stackId="a" fill={cat.color} fillOpacity={.85} />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {groupedCats.map(({ name: gName, cats }) => (
        <div key={gName || "all"}>
          {gName && <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 8, marginTop: 4 }}>{gName.toUpperCase()}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {cats.filter(cat => vis[cat.name]).map(cat => {
              const p = totalAvg > 0 ? Math.round((cat.avg / totalAvg) * 100) : 0;
              return (
                <div key={cat.name} onClick={() => setVis(v => ({ ...v, [cat.name]: !v[cat.name] }))}
                  style={{ flex: "1 1 150px", background: C.surface, border: `1px solid ${cat.color}55`, borderRadius: 9, padding: "14px 16px", cursor: "pointer", minWidth: 140 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <div style={{ color: C.text, fontSize: 12 }}>{cat.name}</div>
                    <div style={{ color: cat.color, fontSize: 11 }}>{p}%</div>
                  </div>
                  <div style={{ color: cat.color, fontSize: 18, fontWeight: 700 }}>{fmt(cat.avg)}</div>
                  <div style={{ background: C.bg, borderRadius: 3, height: 3, marginTop: 8 }}>
                    <div style={{ width: `${p}%`, height: "100%", background: cat.color, borderRadius: 3 }} />
                  </div>
                  <div style={{ color: C.muted, fontSize: 9, marginTop: 4 }}>avg/mo · complete months</div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default OverviewTab;
