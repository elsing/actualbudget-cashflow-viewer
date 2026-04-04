"use client";
import type { UiState, AppData, Group } from "@/types";
import type { Scenario, ScenarioIncome, ScenarioRow } from "@/lib/finance";
import { useState } from "react";
import { C, FONT, CAT_PALETTE, PRESET_COLORS } from "@/lib/constants";
import { fmt, fmtR, pc, uid, completeMonths } from "@/lib/helpers";
import { resolveIncome, resolveRow, liveAvg, liveLastCompleteMonth, liveIncome } from "@/lib/finance";
import { Chip, ColorSwatch } from "@/components/ui";
import type { Transaction } from "@/types";

const ROW_TYPE_LABELS: Record<string, string> = {
  fixed: "Fixed £", percent: "% of income",
  live: "Live avg (complete months)", last: "Last complete month",
};

// ── Group manager ─────────────────────────────────────────────────────────────
function GroupManager({ groups, onChange }: { groups: Group[]; onChange: (g: Group[]) => void }) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft,  setDraft]  = useState("");
  const commit = (id: string) => {
    onChange(groups.map(g => g.id === id ? { ...g, name: draft.trim() || g.name } : g));
    setEditId(null);
  };
  const move = (id: string, dir: number) => {
    const i = groups.findIndex(g => g.id === id);
    if (i + dir < 0 || i + dir >= groups.length) return;
    const n = [...groups]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; onChange(n);
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {groups.map((g, i) => (
        <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: C.elevated, borderRadius: 7, border: `1px solid ${C.border}` }}>
          <ColorSwatch value={g.color} onChange={col => onChange(groups.map(x => x.id === g.id ? { ...x, color: col } : x))} />
          {editId === g.id
            ? <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={() => commit(g.id)} onKeyDown={e => e.key === "Enter" && commit(g.id)}
                style={{ flex: 1, background: C.bg, border: `1px solid ${C.amber}`, borderRadius: 5, padding: "4px 8px", color: C.text, fontSize: 12, fontFamily: FONT, outline: "none" }} />
            : <div onClick={() => { setEditId(g.id); setDraft(g.name); }} style={{ flex: 1, color: g.color, fontSize: 12, cursor: "text" }}>{g.name}</div>}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => move(g.id, -1)} disabled={i === 0} style={{ background: "none", border: "none", color: i === 0 ? C.muted : C.textDim, cursor: i === 0 ? "default" : "pointer", fontSize: 12, padding: "0 3px" }}>↑</button>
            <button onClick={() => move(g.id,  1)} disabled={i === groups.length - 1} style={{ background: "none", border: "none", color: i === groups.length - 1 ? C.muted : C.textDim, cursor: i === groups.length - 1 ? "default" : "pointer", fontSize: 12, padding: "0 3px" }}>↓</button>
            <button onClick={() => onChange(groups.filter(g2 => g2.id !== g.id))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 14, padding: "0 3px" }}>×</button>
          </div>
        </div>
      ))}
      <button onClick={() => { const g: Group = { id: uid(), name: "New Group", color: PRESET_COLORS[groups.length % PRESET_COLORS.length] }; onChange([...groups, g]); setEditId(g.id); setDraft(g.name); }}
        style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 7, padding: "7px 0", color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: FONT }}>+ add group</button>
    </div>
  );
}

// ── Income editor ─────────────────────────────────────────────────────────────
function IncomeEditor({ income, onChange, data }: { income: ScenarioIncome; onChange: (inc: ScenarioIncome) => void; data: AppData }) {
  const live         = liveIncome(data);
  const resolved     = resolveIncome(income, data);
  const incomeCats   = data.incomeCategories || [];
  const selectedCats = income.cats || [];
  const toggleCat = (cat: string) => {
    const n = selectedCats.includes(cat) ? selectedCats.filter(c => c !== cat) : [...selectedCats, cat];
    onChange({ ...income, type: "cats", cats: n });
  };
  const desc = (): string => {
    switch (income?.type) {
      case "cats":     return selectedCats.length ? `${selectedCats.length} income categories · ${(income.avgOrLast || "avg") === "avg" ? "12mo avg" : "last month"}` : "no categories selected";
      case "fixed":    return "fixed monthly amount";
      case "live":     return "all income · 12mo avg (complete months)";
      case "pct_live": return `${(income.pct ?? 0) >= 0 ? "+" : ""}${income.pct ?? 0}% on all income avg`;
      default:         return "";
    }
  };
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: "10px 10px 0 0", padding: "20px 22px 18px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 3, marginBottom: 10 }}>MONEY IN</div>
          <div style={{ color: C.teal, fontSize: 32, fontWeight: 700 }}>{fmt(resolved)}</div>
          <div style={{ color: C.textDim, fontSize: 11, marginTop: 5 }}>{desc()}</div>
        </div>
        <div data-income-editor style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 280 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {([{ v: "cats", l: "By Category" }, { v: "live", l: "All Income" }, { v: "fixed", l: "Fixed £" }, { v: "pct_live", l: "± %" }] as { v: ScenarioIncome["type"]; l: string }[]).map(({ v, l }) => (
              <button key={v} onClick={() => onChange({ ...income, type: v })} style={{
                flex: 1, minWidth: 80, fontFamily: FONT, fontSize: 10, padding: "6px 0", borderRadius: 6, cursor: "pointer",
                border: `1px solid ${income.type === v ? C.teal : C.border}`,
                background: income.type === v ? `${C.teal}22` : "transparent",
                color: income.type === v ? C.teal : C.textDim,
              }}>{l}</button>
            ))}
          </div>
          {income.type === "cats" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {([{ v: "avg", l: "12mo avg" }, { v: "last", l: "Last month" }] as { v: "avg" | "last"; l: string }[]).map(({ v, l }) => (
                  <button key={v} onClick={() => onChange({ ...income, avgOrLast: v })} style={{
                    flex: 1, fontFamily: FONT, fontSize: 10, padding: "4px 0", borderRadius: 5, cursor: "pointer",
                    border: `1px solid ${(income.avgOrLast || "avg") === v ? C.teal : C.border}`,
                    background: (income.avgOrLast || "avg") === v ? `${C.teal}22` : "transparent",
                    color: (income.avgOrLast || "avg") === v ? C.teal : C.textDim,
                  }}>{l}</button>
                ))}
              </div>
              {incomeCats.length > 0
                ? <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {incomeCats.map(cat => {
                      const sel = selectedCats.includes(cat);
                      return <button key={cat} onClick={() => toggleCat(cat)} style={{ fontFamily: FONT, fontSize: 10, padding: "4px 10px", borderRadius: 5, cursor: "pointer", border: `1px solid ${sel ? C.teal : C.border}`, background: sel ? `${C.teal}22` : "transparent", color: sel ? C.teal : C.textDim }}>{cat}</button>;
                    })}
                  </div>
                : <div style={{ color: C.amber, fontSize: 11 }}>No income categories found — mark categories as income in Actual Budget first.</div>
              }
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                <span style={{ color: C.textDim, fontSize: 10 }}>+ fixed top-up:</span>
                <input type="number" value={fmtR(income.fixedExtra || 0)} onChange={e => onChange({ ...income, fixedExtra: pc(e.target.value) })} placeholder="0.00"
                  style={{ width: 90, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.teal, fontSize: 11, fontFamily: FONT, outline: "none" }} />
                <span style={{ color: C.textDim, fontSize: 10 }}>/mo</span>
              </div>
            </div>
          )}
          {income.type === "fixed" && (
            <input type="number" value={fmtR(income.amount ?? live)} onChange={e => onChange({ ...income, amount: pc(e.target.value) })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 12px", color: C.teal, fontSize: 13, fontFamily: FONT, outline: "none", fontWeight: 700 }} />
          )}
          {income.type === "pct_live" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={income.pct ?? 0} onChange={e => onChange({ ...income, pct: parseFloat(e.target.value) || 0 })} step={1}
                style={{ width: 70, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", color: (income.pct ?? 0) >= 0 ? C.teal : C.red, fontSize: 13, fontFamily: FONT, outline: "none", fontWeight: 700 }} />
              <span style={{ color: C.textDim, fontSize: 12 }}>% on {fmt(live)} = {fmt(resolved)}/mo</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transaction drill-down ─────────────────────────────────────────────────────
function TxDrillDown({ cats, data, type }: { cats: string[]; data: AppData; type: string }) {
  const [open, setOpen] = useState(false);
  const months = type === "last" ? completeMonths(data.months).slice(-1) : completeMonths(data.months).slice(-12);
  const txs = months.flatMap(m => m.transactions.filter(t => cats.includes(t.category)))
    .sort((a, b) => b.date.localeCompare(a.date));

  const byMonth: Record<string, Transaction[]> = {};
  txs.forEach(t => {
    const m = t.date?.slice(0, 7); if (!m) return;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  });

  return (
    <div style={{ marginTop: 8, borderTop: `1px solid ${C.border}`, paddingTop: 8 }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: "transparent", border: "none", color: C.textDim, cursor: "pointer", fontFamily: FONT, fontSize: 10, display: "flex", alignItems: "center", gap: 6, padding: 0 }}>
        <span style={{ color: C.amber }}>{open ? "▼" : "▶"}</span>
        {open ? "HIDE" : "SHOW"} TRANSACTIONS ({txs.length} across {Object.keys(byMonth).length} months)
      </button>
      {open && (
        <div style={{ marginTop: 8, maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0])).map(([month, mtxs]) => {
            const net = mtxs.reduce((s, t) => s + t.amount, 0);
            return (
              <div key={month}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 1 }}>{month}</div>
                  <div style={{ color: net >= 0 ? C.teal : C.red, fontSize: 10, fontWeight: 700 }}>net {fmt(net)}</div>
                </div>
                {mtxs.map(t => (
                  <div key={t.id} style={{ display: "flex", gap: 8, padding: "4px 8px", background: C.bg, borderRadius: 5, marginBottom: 3, borderLeft: `2px solid ${t.amount >= 0 ? C.teal : C.muted}` }}>
                    <div style={{ color: C.muted, fontSize: 9, minWidth: 24 }}>{t.date?.split("-")[2]}</div>
                    <div style={{ flex: 1, color: C.text, fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.payee || "—"}</div>
                    <div style={{ color: C.textDim, fontSize: 9, minWidth: 70 }}>{t.category}</div>
                    <div style={{ color: t.amount >= 0 ? C.teal : C.red, fontSize: 10, fontWeight: 700, minWidth: 60, textAlign: "right" }}>{fmt(t.amount)}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Number input helpers ───────────────────────────────────────────────────────
function FixedInput({ label, value, onChange, suffix }: { label?: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  const [draft, setDraft] = useState(fmtR(value));
  const commit = () => { const v = pc(draft); onChange(v); setDraft(fmtR(v)); };
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
      {label && <span style={{ color: C.textDim, fontSize: 11 }}>{label}:</span>}
      <input type="number" value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
        style={{ width: 110, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", color: C.amber, fontSize: 12, fontFamily: FONT, outline: "none" }} />
      <span style={{ color: C.textDim, fontSize: 11 }}>{fmt(pc(draft))}{suffix}</span>
    </div>
  );
}
function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => { const v = parseFloat(draft) || 0; onChange(v); setDraft(String(v)); };
  return (
    <input type="number" value={draft} step={0.5} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
      style={{ width: 80, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "6px 10px", color: C.amber, fontSize: 12, fontFamily: FONT, outline: "none" }} />
  );
}

// ── Row editor ────────────────────────────────────────────────────────────────
function RowEditor({ row, income, data, onChange, onDelete, allCats, groups }: {
  row: ScenarioRow; income: number; data: AppData;
  onChange: (r: ScenarioRow) => void; onDelete: () => void;
  allCats: string[]; groups: Group[];
}) {
  const [editing, setEditing] = useState(false);
  const group    = groups.find(g => g.id === row.group) || groups[0];
  const gc       = group?.color || C.amber;
  const resolved = resolveRow(row, income, data);
  const editType = row.type === "live_group" ? "live" : row.type;
  const displayType = ROW_TYPE_LABELS[editType] || editType;

  if (!editing) return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 14px", background: row.enabled ? C.elevated : C.surface, borderRadius: 8, border: `1px solid ${row.enabled ? C.border : "#111c2d"}`, opacity: row.enabled ? 1 : 0.42 }}>
      <div onClick={() => onChange({ ...row, enabled: !row.enabled })} style={{ width: 30, height: 17, borderRadius: 9, background: row.enabled ? gc : C.muted, cursor: "pointer", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", top: 1.5, left: row.enabled ? 14 : 2, width: 14, height: 14, borderRadius: 7, background: "#fff", transition: "left 0.2s" }} />
      </div>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: gc, flexShrink: 0 }} />
      <div style={{ flex: 1, color: row.enabled ? C.text : C.textDim, fontSize: 13 }}>{row.name}</div>
      {(row.liveCategories || []).length > 0 && <div style={{ color: C.textDim, fontSize: 9, maxWidth: 130, textAlign: "right", lineHeight: 1.3 }}>{row.liveCategories.join(", ")}</div>}
      <div style={{ color: C.textDim, fontSize: 9, background: C.bg, padding: "2px 6px", borderRadius: 4 }}>{displayType}</div>
      <div style={{ color: row.enabled ? gc : C.muted, fontSize: 14, fontWeight: 700, minWidth: 72, textAlign: "right" }}>{fmt(resolved)}</div>
      <div onClick={() => setEditing(true)} style={{ color: C.textDim, cursor: "pointer", fontSize: 13, padding: "0 3px", userSelect: "none" }}>✎</div>
      <div onClick={onDelete} style={{ color: C.muted, cursor: "pointer", fontSize: 15, padding: "0 3px", userSelect: "none" }}>×</div>
    </div>
  );

  return (
    <div style={{ padding: 14, background: C.elevated, borderRadius: 8, border: `1px solid ${gc}55` }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <input value={row.name} onChange={e => onChange({ ...row, name: e.target.value })} placeholder="Name"
          style={{ flex: 2, minWidth: 120, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, fontFamily: FONT, outline: "none" }} />
        <select value={row.group} onChange={e => onChange({ ...row, group: e.target.value })}
          style={{ flex: 1, minWidth: 100, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, fontFamily: FONT }}>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={editType} onChange={e => onChange({ ...row, type: e.target.value })}
          style={{ flex: 1, minWidth: 130, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "7px 10px", color: C.text, fontSize: 12, fontFamily: FONT }}>
          {Object.entries(ROW_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {editType === "fixed" && <FixedInput label="Amount" value={row.amount ?? 0} onChange={v => onChange({ ...row, amount: v })} suffix="/mo" />}
      {editType === "percent" && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <span style={{ color: C.textDim, fontSize: 11 }}>% of income:</span>
          <PctInput value={row.pct ?? 0} onChange={v => onChange({ ...row, pct: v })} />
          <span style={{ color: C.textDim, fontSize: 11 }}>= {fmt(Math.round(income * (row.pct ?? 0) / 100))}/mo</span>
        </div>
      )}
      {(editType === "live" || editType === "last") && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 1, marginBottom: 4 }}>
            {editType === "live" ? "12-month average of complete months" : "Last complete month only"}
            {" — "}Map to Actual categories (net spend: refunds cancel out purchases)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allCats.map((cat, i) => {
              const sel = (row.liveCategories || []).includes(cat);
              return <Chip key={cat} label={cat} color={CAT_PALETTE[i % CAT_PALETTE.length]} active={sel} small
                onClick={() => { const n = sel ? (row.liveCategories || []).filter(c => c !== cat) : [...(row.liveCategories || []), cat]; onChange({ ...row, liveCategories: n }); }} />;
            })}
          </div>
          {(row.liveCategories || []).length > 0 && (
            <div style={{ color: C.teal, fontSize: 11, marginTop: 8 }}>
              {editType === "live" ? `avg ${fmt(liveAvg(data, row.liveCategories))}/mo` : `last ${fmt(liveLastCompleteMonth(data, row.liveCategories))}`}
              {" (complete months only)"}
            </div>
          )}
        </div>
      )}
      {(editType === "live" || editType === "last") && (row.liveCategories || []).length > 0 && (
        <TxDrillDown cats={row.liveCategories} data={data} type={editType} />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
        <button onClick={() => setEditing(false)} style={{ background: C.amber, color: "#060e1a", border: "none", borderRadius: 5, padding: "5px 16px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>DONE</button>
      </div>
    </div>
  );
}

// ── Scenario editor ────────────────────────────────────────────────────────────
function ScenarioEditor({ scenario, data, onChange, groups, onGroupsChange }: {
  scenario: Scenario; data: AppData;
  onChange: (s: Scenario) => void;
  groups: Group[]; onGroupsChange: (g: Group[]) => void;
}) {
  const [showGroups, setShowGroups] = useState(false);
  const incomeAmt = resolveIncome(scenario.income, data);
  const groupRows: Record<string, ScenarioRow[]> = {};
  scenario.rows.forEach(r => { if (!groupRows[r.group]) groupRows[r.group] = []; groupRows[r.group].push(r); });
  const totalOut  = scenario.rows.filter(r => r.enabled).reduce((a, r) => a + resolveRow(r, incomeAmt, data), 0);
  const remaining = incomeAmt - totalOut;

  return (
    <div data-scenario-editor style={{ display: "flex", flexDirection: "column", maxWidth: 900 }}>
      <IncomeEditor income={scenario.income} data={data} onChange={inc => onChange({ ...scenario, income: inc })} />
      <div style={{ background: C.elevated, borderLeft: `1px solid ${C.border}`, borderRight: `1px solid ${C.border}`, padding: "6px 22px", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2 }}>▼ MONEY OUT</div>
        <div style={{ flex: 1, height: 1, background: C.border }} />
        <button onClick={() => setShowGroups(o => !o)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "3px 10px", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT, marginLeft: 8 }}>
          {showGroups ? "▲ groups" : "⚙ groups"}
        </button>
      </div>

      {showGroups && (
        <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderTop: "none", padding: "12px 22px" }}>
          <GroupManager groups={groups} onChange={onGroupsChange} />
        </div>
      )}

      <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderTop: "none", padding: "0 22px 16px" }}>
        {groups.map(g => {
          const rows = groupRows[g.id] || [];
          const tot  = rows.filter(r => r.enabled).reduce((a, r) => a + resolveRow(r, incomeAmt, data), 0);
          return (
            <div key={g.id} style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 3, background: g.color }} />
                  <div style={{ color: g.color, fontSize: 10, letterSpacing: 2, fontWeight: 700 }}>{g.name.toUpperCase()}</div>
                </div>
                <div style={{ color: g.color, fontSize: 13, fontWeight: 700 }}>{fmt(tot)}</div>
              </div>
              {rows.length === 0 && <div style={{ color: C.muted, fontSize: 11, padding: "4px 0" }}>No rows in this group.</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {rows.map(row => (
                  <RowEditor key={row.id} row={row} income={incomeAmt} data={data} allCats={data.categories} groups={groups}
                    onChange={u => onChange({ ...scenario, rows: scenario.rows.map(r => r.id === row.id ? u : r) })}
                    onDelete={() => onChange({ ...scenario, rows: scenario.rows.filter(r => r.id !== row.id) })} />
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ padding: "14px 0" }}>
          <button onClick={() => onChange({ ...scenario, rows: [...scenario.rows, { id: uid(), group: groups[0]?.id || "g1", name: "New item", type: "fixed", amount: 10000, pct: 5, liveCategories: [], enabled: true }] })}
            style={{ width: "100%", background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 7, padding: "9px 0", color: C.textDim, fontSize: 12, cursor: "pointer", fontFamily: FONT }}>+ ADD ROW</button>
        </div>
      </div>

      <div style={{ background: C.elevated, border: `1px solid ${C.border}`, borderTop: `1px solid ${C.amberMid}`, borderRadius: "0 0 10px 10px", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
          <div>
            <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 3, marginBottom: 6 }}>REMAINING / UNALLOCATED</div>
            <div style={{ color: remaining >= 0 ? C.amber : C.red, fontSize: 32, fontWeight: 700 }}>{fmt(remaining)}</div>
            <div style={{ color: C.textDim, fontSize: 11, marginTop: 4 }}>{Math.round((totalOut / Math.max(incomeAmt, 1)) * 100)}% allocated · {fmt(totalOut)}/mo out</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ color: C.textDim, fontSize: 11, marginBottom: 4 }}>annualised</div>
            <div style={{ color: remaining >= 0 ? C.teal : C.red, fontSize: 22, fontWeight: 700 }}>{fmt(remaining * 12)}/yr</div>
          </div>
        </div>
        <div style={{ marginTop: 16, background: C.bg, borderRadius: 4, height: 8, overflow: "hidden", display: "flex" }}>
          {groups.map(g => {
            const tot = (groupRows[g.id] || []).filter(r => r.enabled).reduce((a, r) => a + resolveRow(r, incomeAmt, data), 0);
            return <div key={g.id} style={{ width: `${(tot / Math.max(incomeAmt, 1)) * 100}%`, background: g.color, transition: "width 0.3s" }} />;
          })}
          <div style={{ flex: 1, background: `${C.muted}44` }} />
        </div>
      </div>
    </div>
  );
}

// ── Compare view ───────────────────────────────────────────────────────────────
function CompareView({ scenarios, data, groups }: { scenarios: Scenario[]; data: AppData; groups: Group[] }) {
  const [ids, setIds] = useState<string[]>([
    scenarios[0]?.id || "", scenarios[1]?.id || scenarios[0]?.id || "", scenarios[2]?.id || "",
  ]);
  const [numCols, setNumCols] = useState(Math.min(2, scenarios.length));
  const cols = ids.slice(0, numCols).map(id => scenarios.find(s => s.id === id) || scenarios[0]).filter(Boolean);
  const incs = cols.map(s => resolveIncome(s.income, data));
  const rems = cols.map((s, i) => incs[i] - s.rows.filter(r => r.enabled).reduce((a, r) => a + resolveRow(r, incs[i], data), 0));
  const allRows = [...new Set(cols.flatMap(s => s.rows.map(r => r.name)))];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${numCols}, 1fr)`, padding: "10px 14px", background: C.elevated, borderBottom: `1px solid ${C.border}`, gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {[2, 3].map(n => (
            <button key={n} onClick={() => setNumCols(n)} disabled={scenarios.length < n}
              style={{ background: "transparent", border: `1px solid ${numCols === n ? C.amber : C.border}`, borderRadius: 4, padding: "2px 8px", color: numCols === n ? C.amber : C.textDim, fontSize: 10, cursor: scenarios.length >= n ? "pointer" : "default", fontFamily: FONT }}>
              {n}-way
            </button>
          ))}
        </div>
        {ids.slice(0, numCols).map((id, ci) => (
          <select key={ci} value={id} onChange={e => { const n = [...ids]; n[ci] = e.target.value; setIds(n); }}
            style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.text, fontSize: 11, fontFamily: FONT }}>
            {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `180px repeat(${numCols}, 1fr)`, padding: "10px 14px", background: C.surface, borderBottom: `1px solid ${C.amberMid}` }}>
        <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2 }}>INCOME</div>
        {incs.map((v, i) => <div key={i} style={{ color: C.teal, fontSize: 15, fontWeight: 700, textAlign: "right" }}>{fmt(v)}</div>)}
      </div>
      {allRows.map(name => {
        const rowVals = cols.map((s, ci) => {
          const r = s.rows.find(r => r.name === name);
          return r ? resolveRow(r, incs[ci], data) : null;
        });
        return (
          <div key={name} style={{ display: "grid", gridTemplateColumns: `180px repeat(${numCols}, 1fr)`, padding: "8px 14px", borderBottom: `1px solid ${C.border}44`, background: C.elevated }}>
            <div style={{ color: C.text, fontSize: 12 }}>{name}</div>
            {rowVals.map((v, i) => <div key={i} style={{ color: v === null ? C.muted : C.red, fontSize: 12, textAlign: "right" }}>{v === null ? "—" : fmt(v)}</div>)}
          </div>
        );
      })}
      <div data-compare-grid style={{ display: "grid", gridTemplateColumns: `180px repeat(${numCols}, 1fr)`, padding: "12px 14px", background: C.elevated, borderTop: `1px solid ${C.amberMid}` }}>
        <div style={{ color: C.amber, fontSize: 11, fontWeight: 700 }}>Net remaining</div>
        {rems.map((v, i) => <div key={i} style={{ color: v >= 0 ? C.amber : C.red, fontSize: 14, fontWeight: 700, textAlign: "right" }}>{fmt(v)}</div>)}
      </div>
    </div>
  );
}

// ── Scenario projection ────────────────────────────────────────────────────────
interface ProjectionEvent {
  day: number; label: string; amount: number; type: string;
  rowId: string; rowType: string; liveCategories?: string[];
}
function ScenarioProjection({ scenarios, data, uiState, setUi }: {
  scenarios: Scenario[]; data: AppData;
  uiState: Partial<UiState>; setUi: (patch: Partial<UiState>) => void;
}) {
  const complete = completeMonths(data.months);
  const projScenId   = uiState.projScenId   ?? scenarios[0]?.id ?? "";
  const dayOverrides = (uiState.projDayOverrides ?? {}) as Record<string, number>;
  const incomeDayOvr = uiState.projIncomeDay   ?? null;
  const startBalOvr  = uiState.projStartBal    ?? null;
  const setField = (patch: Partial<UiState>) => setUi(patch);

  const scenario  = scenarios.find(s => s.id === projScenId) || scenarios[0];
  const incomeAmt = resolveIncome(scenario?.income, data);

  const incomeDays = complete.slice(-3).flatMap(m =>
    m.transactions.filter(t => t.isIncome || t.amount > 0).map(t => parseInt(t.date?.split("-")[2] || "0")).filter(Boolean)
  );
  const autoIncomeDay = incomeDays.length ? Math.round(incomeDays.reduce((a, b) => a + b, 0) / incomeDays.length) : 1;
  const incomeDay = incomeDayOvr ?? autoIncomeDay;

  const lastComplete  = complete[complete.length - 1];
  const autoStartBal  = lastComplete?.startBalance ?? 0;
  const startBal      = startBalOvr ?? autoStartBal;

  const [startDraft,  setStartDraft]  = useState(fmtR(startBal));
  const [incomeDraft, setIncomeDraft] = useState(String(incomeDay));

  const catDayAvg: Record<string, number[]> = {};
  complete.slice(-3).forEach(m => {
    m.transactions.forEach(tx => {
      if (tx.amount >= 0) return;
      const day = parseInt(tx.date?.split("-")[2] || "0"); if (!day) return;
      if (!catDayAvg[tx.category]) catDayAvg[tx.category] = [];
      catDayAvg[tx.category].push(day);
    });
  });
  const avgDay = (cats: string[]): number | null => {
    const days = cats.flatMap(c => catDayAvg[c] || []);
    return days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null;
  };

  const events: ProjectionEvent[] = [{
    day: incomeDay, label: "Income", amount: incomeAmt, type: "income", rowId: "__income__", rowType: "income",
  }];

  (scenario?.rows || []).filter(r => r.enabled).forEach(row => {
    const amt = resolveRow(row, incomeAmt, data);
    if (amt <= 0) return;
    let day: number;
    if (row.type === "fixed" || row.type === "percent") {
      day = dayOverrides[row.id] ?? 1;
    } else if (row.type === "last") {
      const lastTx = (lastComplete?.transactions || []).filter(t => (row.liveCategories || []).includes(t.category) && t.amount < 0);
      const lastDay = lastTx.length ? Math.max(...lastTx.map(t => parseInt(t.date?.split("-")[2] || "0"))) : null;
      day = dayOverrides[row.id] ?? lastDay ?? avgDay(row.liveCategories) ?? 1;
    } else {
      day = dayOverrides[row.id] ?? avgDay(row.liveCategories) ?? 1;
    }
    events.push({ day, label: row.name, amount: -amt, type: "expense", rowId: row.id, rowType: row.type, liveCategories: row.liveCategories });
  });
  events.sort((a, b) => a.day - b.day);

  const days: { day: number; events: ProjectionEvent[]; balBefore: number; balAfter: number }[] = [];
  let bal = startBal;
  for (let d = 1; d <= 31; d++) {
    const dayEvs = events.filter(e => e.day === d);
    if (!dayEvs.length) continue;
    const prev = bal;
    dayEvs.forEach(e => bal += e.amount);
    days.push({ day: d, events: dayEvs, balBefore: prev, balAfter: bal });
  }

  const allBals  = [startBal, ...days.map(d => d.balAfter)];
  const minBal   = Math.min(...allBals);
  const maxBal   = Math.max(...allBals);
  const balRange = maxBal - minBal || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Controls */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ color: C.amber, fontSize: 10, letterSpacing: 2, marginBottom: 14 }}>PROJECTION SETTINGS</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div>
            <div style={{ color: C.textDim, fontSize: 10, marginBottom: 5 }}>SCENARIO</div>
            <select value={projScenId} onChange={e => setField({ projScenId: e.target.value })}
              style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", color: C.text, fontSize: 12, fontFamily: FONT }}>
              {scenarios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <div style={{ color: C.textDim, fontSize: 10, marginBottom: 5 }}>
              STARTING BALANCE <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>(auto: start of {lastComplete?.month ?? ""} · {fmt(autoStartBal)})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" value={startDraft}
                onChange={e => setStartDraft(e.target.value)}
                onBlur={() => { const v = pc(startDraft); setField({ projStartBal: v }); setStartDraft(fmtR(v)); }}
                onKeyDown={e => { if (e.key === "Enter") { const v = pc(startDraft); setField({ projStartBal: v }); setStartDraft(fmtR(v)); } }}
                style={{ width: 120, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", color: C.amber, fontSize: 12, fontFamily: FONT, outline: "none" }} />
              <button onClick={() => { setField({ projStartBal: null }); setStartDraft(fmtR(autoStartBal)); }}
                style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT }}>reset</button>
            </div>
          </div>
          <div>
            <div style={{ color: C.textDim, fontSize: 10, marginBottom: 5 }}>
              INCOME DAY <span style={{ color: C.muted, fontWeight: 400, marginLeft: 6 }}>(auto-detected: {autoIncomeDay})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="number" min={1} max={31} value={incomeDraft}
                onChange={e => setIncomeDraft(e.target.value)}
                onBlur={() => { const v = Math.max(1, Math.min(31, parseInt(incomeDraft) || autoIncomeDay)); setField({ projIncomeDay: v }); setIncomeDraft(String(v)); }}
                style={{ width: 64, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px", color: C.amber, fontSize: 12, fontFamily: FONT, outline: "none", textAlign: "center" }} />
              <button onClick={() => { setField({ projIncomeDay: null }); setIncomeDraft(String(autoIncomeDay)); }}
                style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "6px 10px", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT }}>reset</button>
            </div>
          </div>
        </div>
      </div>

      {/* Day overrides */}
      {scenario?.rows.filter(r => r.enabled).length > 0 && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ color: C.textDim, fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>DAY OF MONTH PER ITEM</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {(scenario?.rows || []).filter(r => r.enabled).map(row => {
              const isFixed = row.type === "fixed" || row.type === "percent";
              const auto = isFixed ? null : row.type === "last"
                ? (() => { const tx = (lastComplete?.transactions || []).filter(t => (row.liveCategories || []).includes(t.category) && t.amount < 0); return tx.length ? Math.max(...tx.map(t => parseInt(t.date?.split("-")[2] || "0"))) : null; })()
                : avgDay(row.liveCategories);
              const current = dayOverrides[row.id] ?? auto ?? 1;
              return (
                <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 8, background: C.elevated, borderRadius: 7, padding: "8px 12px", border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.text, fontSize: 11 }}>{row.name}</span>
                  {auto !== null && !dayOverrides[row.id] && <span style={{ color: C.muted, fontSize: 9 }}>auto:{auto}</span>}
                  <input type="number" min={1} max={31} value={dayOverrides[row.id] ?? current}
                    onChange={e => { const v = Math.max(1, Math.min(31, parseInt(e.target.value) || 1)); setField({ projDayOverrides: { ...dayOverrides, [row.id]: v } }); }}
                    style={{ width: 48, background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4, padding: "4px 6px", color: C.amber, fontSize: 11, fontFamily: FONT, outline: "none", textAlign: "center" }} />
                  {dayOverrides[row.id] && (
                    <button onClick={() => { const n = { ...dayOverrides }; delete n[row.id]; setField({ projDayOverrides: n }); }}
                      style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 11, padding: 0 }}>×</button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Walk */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
        <div style={{ color: C.amber, fontSize: 10, letterSpacing: 2, marginBottom: 16 }}>BALANCE WALKTHROUGH · {scenario?.name}</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${C.border}44` }}>
            <div style={{ width: 32, color: C.textDim, fontSize: 10, textAlign: "right", flexShrink: 0 }}>—</div>
            <div style={{ flex: 1, color: C.textDim, fontSize: 11, fontStyle: "italic" }}>Start of month (before any transactions)</div>
            <div style={{ color: C.text, fontSize: 13, fontWeight: 700, minWidth: 90, textAlign: "right" }}>{fmt(startBal)}</div>
          </div>
          {days.length === 0 && <div style={{ color: C.muted, fontSize: 12, padding: "20px 0", textAlign: "center" }}>No enabled rows — add items to the scenario to see the projection.</div>}
          {days.map(({ day, events: evs, balBefore }, di) => (
            <div key={day} style={{ borderBottom: `1px solid ${C.border}44` }}>
              {evs.map((ev, ei) => {
                const isLastInDay = ei === evs.length - 1;
                let runBal = balBefore;
                for (let k = 0; k <= ei; k++) runBal += evs[k].amount;
                return (
                  <div key={ei} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", background: di % 2 === 0 && ei === 0 ? `${C.elevated}55` : "transparent" }}>
                    <div style={{ width: 32, color: C.textDim, fontSize: 10, textAlign: "right", flexShrink: 0 }}>{ei === 0 ? `${day}` : ""}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: ev.type === "income" ? C.teal : C.text, fontSize: 12 }}>{ev.label}</div>
                      {ev.liveCategories && ev.liveCategories.length > 0 && (
                        <div style={{ color: C.muted, fontSize: 9, marginTop: 1 }}>
                          {ev.liveCategories.join(", ")} · {ev.rowType === "live" ? "avg day" : "last occurrence"}: day {ev.day}
                        </div>
                      )}
                    </div>
                    <div style={{ color: ev.amount >= 0 ? C.teal : C.red, fontSize: 12, fontWeight: 700, minWidth: 76, textAlign: "right" }}>
                      {ev.amount >= 0 ? "+" : ""}{fmt(ev.amount)}
                    </div>
                    {isLastInDay ? (
                      <div style={{ minWidth: 100, textAlign: "right" }}>
                        <div style={{ color: runBal < 0 ? C.red : runBal >= startBal ? C.teal : C.text, fontSize: 13, fontWeight: 700 }}>{fmt(runBal)}</div>
                        <div style={{ height: 2, background: C.border, borderRadius: 1, marginTop: 4, width: 100 }}>
                          <div style={{ height: "100%", borderRadius: 1, background: runBal < 0 ? C.red : runBal >= startBal ? C.teal : C.amber, width: `${Math.max(2, Math.min(100, ((runBal - minBal) / balRange) * 100))}%`, transition: "width 0.3s" }} />
                        </div>
                      </div>
                    ) : <div style={{ minWidth: 100 }} />}
                  </div>
                );
              })}
            </div>
          ))}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderTop: `1px solid ${C.amberMid}` }}>
            <div style={{ width: 32, flexShrink: 0 }} />
            <div style={{ flex: 1, color: C.textDim, fontSize: 11, fontWeight: 700 }}>End of month</div>
            <div style={{ color: bal >= startBal ? C.teal : C.red, fontSize: 12, minWidth: 76, textAlign: "right", fontWeight: 700 }}>
              {bal >= startBal ? "+" : ""}{fmt(bal - startBal)}
            </div>
            <div style={{ minWidth: 100, textAlign: "right" }}>
              <div style={{ color: bal < 0 ? C.red : bal >= startBal ? C.teal : C.amber, fontSize: 18, fontWeight: 700 }}>{fmt(bal)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Scenario tab bar ───────────────────────────────────────────────────────────
function ScenarioTabBar({ scenarios, activeId, setActiveId, view, setView, onScenariosChange }: {
  scenarios: Scenario[]; activeId: string;
  setActiveId: (id: string) => void; view: string;
  setView: (v: string) => void; onScenariosChange: (s: Scenario[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");
  const [naming,    setNaming]    = useState(false);
  const [newName,   setNewName]   = useState("");

  const commitName = (id: string) => {
    onScenariosChange(scenarios.map(s => s.id === id ? { ...s, name: nameDraft.trim() || s.name } : s));
    setEditingId(null);
  };
  const move = (id: string, dir: number) => {
    const i = scenarios.findIndex(s => s.id === id);
    if (i + dir < 0 || i + dir >= scenarios.length) return;
    const n = [...scenarios]; [n[i], n[i + dir]] = [n[i + dir], n[i]]; onScenariosChange(n);
  };
  const del = (id: string) => {
    if (scenarios.length <= 1) return;
    const next = scenarios.filter(s => s.id !== id);
    onScenariosChange(next);
    if (activeId === id) setActiveId(next[0].id);
  };
  const dup = () => {
    const src = scenarios.find(s => s.id === activeId) || scenarios[0];
    const ns: Scenario = { ...src, id: uid(), name: src.name + " (copy)", rows: src.rows.map(r => ({ ...r, id: uid() })) };
    onScenariosChange([...scenarios, ns]); setActiveId(ns.id);
  };
  const add = () => {
    if (!newName.trim()) return;
    const src = scenarios.find(s => s.id === activeId) || scenarios[0];
    const ns: Scenario = { ...src, id: uid(), name: newName.trim(), color: PRESET_COLORS[scenarios.length % PRESET_COLORS.length], rows: src.rows.map(r => ({ ...r, id: uid() })) };
    onScenariosChange([...scenarios, ns]); setActiveId(ns.id); setNaming(false); setNewName("");
  };

  return (
    <div data-scenario-tab-bar style={{ display: "flex", alignItems: "stretch", borderBottom: `1px solid ${C.border}`, marginBottom: 20, flexWrap: "wrap", gap: 0 }}>
      {scenarios.map((s, si) => {
        const isActive = activeId === s.id && view === "edit";
        return (
          <div key={s.id} onClick={() => { setActiveId(s.id); setView("edit"); }}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", cursor: "pointer", borderBottom: `2px solid ${isActive ? s.color : "transparent"}`, background: isActive ? `${s.color}11` : "transparent", position: "relative" }}>
            <div onClick={e => e.stopPropagation()}><ColorSwatch value={s.color} onChange={col => onScenariosChange(scenarios.map(x => x.id === s.id ? { ...x, color: col } : x))} /></div>
            {editingId === s.id
              ? <input autoFocus value={nameDraft} onChange={e => setNameDraft(e.target.value)}
                  onBlur={() => commitName(s.id)} onKeyDown={e => { if (e.key === "Enter") commitName(s.id); if (e.key === "Escape") setEditingId(null); }}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 100, background: C.bg, border: `1px solid ${s.color}`, borderRadius: 4, padding: "2px 6px", color: C.text, fontSize: 11, fontFamily: FONT, outline: "none" }} />
              : <span onDoubleClick={e => { e.stopPropagation(); setEditingId(s.id); setNameDraft(s.name); }} title="Double-click to rename"
                  style={{ color: isActive ? s.color : C.textDim, fontSize: 11, fontFamily: FONT, userSelect: "none" }}>{s.name}</span>
            }
            <div onClick={e => e.stopPropagation()} style={{ display: "flex", gap: 2, marginLeft: 2 }}>
              {si > 0 && <span onClick={() => move(s.id, -1)} style={{ color: C.muted, cursor: "pointer", fontSize: 10, padding: "0 2px" }}>←</span>}
              {si < scenarios.length - 1 && <span onClick={() => move(s.id, 1)} style={{ color: C.muted, cursor: "pointer", fontSize: 10, padding: "0 2px" }}>→</span>}
              {scenarios.length > 1 && <span onClick={() => del(s.id)} style={{ color: C.muted, cursor: "pointer", fontSize: 13, padding: "0 2px" }}>×</span>}
            </div>
          </div>
        );
      })}
      <div onClick={() => setView("compare")} style={{ display: "flex", alignItems: "center", padding: "8px 14px", cursor: "pointer", borderBottom: `2px solid ${view === "compare" ? C.amber : "transparent"}`, background: view === "compare" ? `${C.amber}11` : "transparent" }}>
        <span style={{ color: view === "compare" ? C.amber : C.textDim, fontSize: 11, fontFamily: FONT }}>⇄ Compare</span>
      </div>
      <div onClick={() => setView("projection")} style={{ display: "flex", alignItems: "center", padding: "8px 14px", cursor: "pointer", borderBottom: `2px solid ${view === "projection" ? C.teal : "transparent"}`, background: view === "projection" ? `${C.teal}11` : "transparent" }}>
        <span style={{ color: view === "projection" ? C.teal : C.textDim, fontSize: 11, fontFamily: FONT }}>📅 Projection</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center", padding: "0 8px" }}>
        {view === "edit" && <button onClick={dup} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", color: C.textDim, fontSize: 10, cursor: "pointer", fontFamily: FONT }}>duplicate</button>}
        {naming
          ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Scenario name" onKeyDown={e => e.key === "Enter" && add()} autoFocus
                style={{ background: C.bg, border: `1px solid ${C.amber}`, borderRadius: 5, padding: "4px 10px", color: C.text, fontSize: 11, fontFamily: FONT, outline: "none", width: 130 }} />
              <button onClick={add} style={{ background: C.amber, color: "#060e1a", border: "none", borderRadius: 5, padding: "4px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>ADD</button>
              <button onClick={() => setNaming(false)} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 8px", color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: FONT }}>✕</button>
            </div>
          : <button onClick={() => setNaming(true)} style={{ background: "transparent", border: `1px dashed ${C.border}`, borderRadius: 5, padding: "4px 12px", color: C.textDim, fontSize: 11, cursor: "pointer", fontFamily: FONT }}>+ new</button>
        }
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
interface ScenariosTabProps {
  scenarios: Scenario[]; groups: Group[]; data: AppData;
  onScenariosChange: (s: Scenario[]) => void; onGroupsChange: (g: Group[]) => void;
  uiState?: Partial<UiState>; setUi?: (patch: Partial<UiState>) => void;
}
export default function ScenariosTab({ scenarios, groups, onScenariosChange, onGroupsChange, data, uiState = {}, setUi = (_p: Partial<UiState>) => {} }: ScenariosTabProps) {
  const activeId    = uiState.scenActiveId || scenarios[0].id;
  const setActiveId = (id: string) => setUi({ scenActiveId: id });
  const view        = uiState.scenView || "edit";
  const setView     = (v: string) => setUi({ scenView: v });
  const active      = scenarios.find(s => s.id === activeId) || scenarios[0];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <ScenarioTabBar scenarios={scenarios} activeId={activeId} setActiveId={setActiveId} view={view} setView={setView} onScenariosChange={onScenariosChange} />
      {view === "edit" && (
        <ScenarioEditor scenario={active} data={data} groups={groups} onGroupsChange={onGroupsChange}
          onChange={u => onScenariosChange(scenarios.map(s => s.id === u.id ? u : s))} />
      )}
      {view === "compare" && <CompareView scenarios={scenarios} data={data} groups={groups} />}
      {view === "projection" && <ScenarioProjection scenarios={scenarios} data={data} uiState={uiState} setUi={setUi} />}
    </div>
  );
}
