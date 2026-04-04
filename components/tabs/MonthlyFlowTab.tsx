"use client";
import type { UiState, AppData, AppState, Scenario, Month } from "@/types";
import { useState, useMemo } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { C, FONT, CAT_PALETTE, TYPE_COLOR } from "@/lib/constants";
import { fmt, fmtM, fmtD, fmtR, pc, todayStr, currentMonthKey } from "@/lib/helpers";
import { resolveIncome, resolveRow, liveAvg, liveLastCompleteMonth } from "@/lib/finance";
import { completeMonths } from "@/lib/helpers";
import { ChartTip } from "@/components/ui";

// ── Hover-expanding compact month card ────────────────────────────────────────
interface HoverCardProps {
  m: Month;
  bc: string;
  bg: string;
  isSelected: boolean;
  onSelect: (month: string) => void;
  onCycle: (month: string) => void;
  onRange: (month: string) => void;
  inRange: boolean;
  isAnchor: boolean;
  marker?: "good" | "bad";
}
function HoverCard({ m, bc, bg, isSelected, onSelect, onCycle, onRange, inRange, isAnchor, marker }: HoverCardProps) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{background:bg,border:`2px solid ${bc}`,borderRadius:8,padding:"8px 10px",
        cursor:"pointer",opacity:hov?1:0.78,
        width:hov?130:92,flexShrink:0,
        transition:"width 0.18s, opacity 0.15s",overflow:"hidden"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div onClick={()=>onSelect(m.month)} style={{color:isSelected?C.amber:C.text,fontSize:10,fontWeight:isSelected?700:400,fontFamily:FONT,whiteSpace:"nowrap"}}>{fmtM(m.month)}</div>
        <div style={{display:"flex",gap:4,flexShrink:0}}>
          <button onClick={()=>onCycle(m.month)} style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:marker==="good"?C.green:marker==="bad"?C.red:C.muted,padding:"0 1px"}}>
            {marker==="good"?"✓":marker==="bad"?"✗":"○"}
          </button>
          {hov&&<button onClick={()=>onRange(m.month)} style={{background:"none",border:"none",cursor:"pointer",fontSize:10,color:inRange||isAnchor?C.teal:C.muted,padding:"0 1px"}}>⇔</button>}
        </div>
      </div>
      <div onClick={()=>onSelect(m.month)}>
        {hov&&<><div style={{color:C.textDim,fontSize:9,marginBottom:2}}>START</div>
        <div style={{color:C.textDim,fontSize:11,marginBottom:3}}>{fmt(m.startBalance)}</div>
        <div style={{color:C.textDim,fontSize:9,marginBottom:2}}>END</div></>}
        <div style={{color:m.endBalance>=m.startBalance?C.teal:C.red,fontSize:hov?13:12,fontWeight:700}}>{fmt(m.endBalance)}</div>
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
interface MonthlyFlowTabProps {
  data: AppData;
  scenarios: Scenario[];
  markers: AppState["markers"];
  reconciliations: AppState["reconciliations"];
  onMarkersChange: (m: AppState["markers"]) => void;
  onReconciliationsChange: (r: AppState["reconciliations"]) => void;
  uiState?: Partial<UiState>;
  setUi?: (patch: Partial<UiState>) => void;
}
export default function MonthlyFlowTab({ data, scenarios, markers, reconciliations, onMarkersChange, onReconciliationsChange, uiState={}, setUi=(_p)=>{} }: MonthlyFlowTabProps) {
  const rawAccountObjects = data.accountObjects || [];
  const allAccountNames   = data.accounts || [];

  const [selAccounts, setSelAccounts] = useState<string[]|null>(null);
  const [selMonth,    setSelMonth]    = useState(data.months[data.months.length-1]?.month||"");
  const [rangeStart,  setRangeStart]  = useState<string|null>(null);
  const [rangeEnd,    setRangeEnd]    = useState<string|null>(null);
  const [balRange,    setBalRange]    = useState(6);
  const [projScenId,  setProjScenId]  = useState<string|null>(scenarios?.[0]?.id||null);
  const [txOpen,      setTxOpen]      = useState(false);
  const showProj    = uiState.flowShowProj ?? true;
  const setShowProj = (v: boolean | ((p: boolean) => boolean)) => setUi({flowShowProj: typeof v==="function" ? v(showProj) : v});

  const activeAccountNames = selAccounts ?? allAccountNames;
  const activeAccountObjs  = rawAccountObjects.filter(a => activeAccountNames.includes(a.name));

  const filterTx = (txs: any[]) => (txs||[]).filter(t =>
    !allAccountNames.length || activeAccountNames.length===0 ||
    activeAccountNames.includes(t.account) || !t.account
  );

  // Build month totals by summing per-account balances from the hook,
  // then applying any reconciliation overrides on top.
  // This mirrors CalibrationTab exactly — same source of truth.
  const allMonths = useMemo(() => {
    const perBals  = data.accountMonthBals || {};
    const starts   = data.startBalances    || {};
    const recs     = reconciliations       || {};
    const activeIds = activeAccountObjs.map(a=>a.id);
    // When no filter active, use all accounts
    const ids = activeIds.length > 0 ? activeIds : rawAccountObjects.map(a=>a.id);

    return data.months.map(m => {
      let startBalance = 0;
      let endBalance   = 0;

      for (const id of ids) {
        // Recompute this account's balance at this month walking forward,
        // incorporating reconciliations — same logic as CalibrationTab.computedBals
        const accountRecs = recs[id] || {};
        const start0 = starts[id] ?? 0;
        const txsByAcc = data.txsByAccount?.[id] || {};
        const allMKeys = Object.keys(data.accountMonthBals?.[id] || {}).sort();

        let run = start0;
        let acctStart = 0, acctEnd = 0;
        for (const mKey of allMKeys) {
          const acctTxs = txsByAcc[mKey] || [];
          const net = acctTxs.reduce((s,tx)=>s+(tx.amount||0), 0);
          const calc = run + net;
          const end  = accountRecs[mKey] !== undefined ? accountRecs[mKey] : calc;
          if (mKey === m.month) { acctStart = run; acctEnd = end; }
          run = end;
        }
        startBalance += acctStart;
        endBalance   += acctEnd;
      }

      return {
        ...m,
        startBalance,
        endBalance,
        // Net derived from calibrated balances, not raw income/expenses sums
        // (income/expenses are across all accounts regardless of filter)
        net: endBalance - startBalance,
      };
    });
  }, [data, activeAccountObjs, rawAccountObjects, reconciliations]);

  // For display: "start balance" on a month card = end of day 1
  // (after transfers on the 1st have settled — what you actually have available)
  // "end balance" = end of last day of month (already correct from calibration)
  const allMonthsDisplay = useMemo(() => {
    return allMonths.map(m => {
      // Find transactions on day 1 of this month (filtered by selected accounts)
      const day1Txs = (m.transactions||[]).filter(tx => {
        const txDay = tx.date?.split("-")[2];
        if (txDay !== "01") return false;
        // Apply account filter
        return !activeAccountNames.length || activeAccountNames.includes(tx.account) || !tx.account;
      });
      const day1Net = day1Txs.reduce((s,tx)=>s+(tx.amount||0), 0);
      const startBalanceDisplay = m.startBalance + day1Net;
      return { ...m, startBalance: startBalanceDisplay };
    });
  }, [allMonths, activeAccountNames]);

  const handleRange = (month: string) => {
    if (!rangeStart) { setRangeStart(month); setRangeEnd(null); }
    else if (rangeStart===month&&!rangeEnd) { setRangeStart(null); }
    else if (!rangeEnd) {
      const [a,b] = month>rangeStart?[rangeStart,month]:[month,rangeStart];
      setRangeStart(a); setRangeEnd(b);
    } else { setRangeStart(month); setRangeEnd(null); }
  };

  const curMon = currentMonthKey();
  // Exclude the current (partial) month from the balance chart — its data is incomplete
  const completeDisplayMonths = allMonthsDisplay.filter(m=>m.month<curMon);
  const balMonths = rangeStart&&rangeEnd
    ? allMonthsDisplay.filter(m=>m.month>=rangeStart&&m.month<=rangeEnd&&m.month<curMon)
    : completeDisplayMonths.slice(-balRange);

  const projScen   = scenarios?.find(s=>s.id===projScenId)||scenarios?.[0];
  const lastActual = completeDisplayMonths[completeDisplayMonths.length-1];
  // Only project when the chart is showing up to the present (not a historical range)
  const chartEndsNow = !rangeEnd || rangeEnd >= (completeDisplayMonths[completeDisplayMonths.length-1]?.month||"");

  // Monthly projection (3 months ahead from last complete month)
  const projPoints = useMemo(() => {
    if (!projScen||!lastActual) return [];
    const pInc = resolveIncome(projScen.income, data);
    const pOut = projScen.rows.filter(r=>r.enabled).reduce((a,r)=>a+resolveRow(r,pInc,data),0);
    const pNet = pInc - pOut;
    let bal = lastActual.endBalance;
    // Bridge point: give the last actual month BOTH a balance AND a projBalance
    // so the projected line starts exactly where the actual line ends — no gap.
    const points = [{month:lastActual.month, projBalance:bal}];
    [1,2,3].forEach(i=>{
      const d = new Date(lastActual.month+"-01"); d.setMonth(d.getMonth()+i);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
      bal += pNet;
      points.push({month:key, projBalance:bal});
    });
    return points;
  }, [projScen, lastActual, data]);

  const balChartData = [
    ...balMonths.map(m=>({month:m.month,balance:m.endBalance})),
    ...(showProj&&chartEndsNow ? projPoints.map(p=>({month:p.month,projBalance:p.projBalance})) : []),
  ];

  // Day-by-day
  const today  = todayStr();
  const isCurrentMonth = selMonth === curMon;
  // selMData for display (start = end of day 1) — used for the header summary
  const selMData = allMonthsDisplay.find(m=>m.month===selMonth);
  // selMDataRaw uses the pre-day-1 start balance — used as the daily chart anchor
  const selMDataRaw = allMonths.find(m=>m.month===selMonth);

  const dailyData = useMemo(() => {
    if (!selMDataRaw) return [];
    const [y,mo] = selMonth.split("-");
    const dIM = new Date(+y,+mo,0).getDate();
    const txsByDay: Record<string, typeof selMDataRaw.transactions> = {};
    // Filter by account AND exclude transfers — transfers cancel across accounts
    // but mid-month they cause large swings that obscure the real running balance
    filterTx(selMDataRaw.transactions)
      .filter(tx => !tx.transfer_id)
      .forEach(tx => {
        const day = tx.date?.split("-")[2]; if (!day) return;
        if (!txsByDay[day]) txsByDay[day]=[];
        txsByDay[day].push(tx);
      });
    // Start from end-of-previous-month (raw start, before day 1 transactions)
    let bal = selMDataRaw.startBalance;
    const days = [];
    for (let d=1; d<=dIM; d++) {
      const ds   = String(d).padStart(2,"0");
      const date = `${selMonth}-${ds}`;
      const dayTxs = txsByDay[ds]||[];
      dayTxs.forEach(tx => bal += tx.amount);
      const isPast  = date <= today;
      const isToday = date === today;
      days.push({
        date, day:d,
        balance:    isPast  ? bal : null,
        projBalance:(!isPast||isToday) ? bal : null,
        income: dayTxs.filter(t=>t.amount>0).reduce((a,t)=>a+t.amount,0)||null,
        spend:  dayTxs.filter(t=>t.amount<0).reduce((a,t)=>a+Math.abs(t.amount),0)||null,
        txs: dayTxs, isPast,
      });
    }
    return days;
  }, [selMDataRaw, selMonth, today, selAccounts]);

  // Stepped projection from last transaction day — works on current month AND any past month
  // (useful for seeing what the scenario would have predicted vs what actually happened)
  const steppedProj = useMemo(() => {
    if (!projScen||!showProj||!selMData||!dailyData.length) return [];
    const pInc = resolveIncome(projScen.income, data);
    // Historical day-of-month per category
    const catDayMap: Record<string, number[]> = {};
    completeMonths(data.months).slice(-3).forEach(m => {
      (m.transactions||[]).forEach(tx => {
        if (tx.amount>=0) return;
        const day = parseInt(tx.date?.split("-")[2]||"0"); if (!day) return;
        if (!catDayMap[tx.category]) catDayMap[tx.category]=[];
        catDayMap[tx.category].push(day);
      });
    });
    const [y,mo] = selMonth.split("-");
    const dIM = new Date(+y,+mo,0).getDate();
    // For past months: last day with transactions. For current month: today.
    const lastTxDay = isCurrentMonth
      ? dailyData.reduce((last,d)=>d.txs?.length?parseInt(d.date.split("-")[2]):last, 0) || parseInt(today.split("-")[2])
      : dailyData.reduce((last,d)=>d.txs?.length?parseInt(d.date.split("-")[2]):last, 0) || dIM;
    if (!isCurrentMonth && lastTxDay >= dIM) return []; // full month, nothing to project

    interface ProjEvent { day: number; label: string; amount: number; type: string; }
    const events: ProjEvent[] = [];
    projScen.rows.filter(r=>r.enabled).forEach(row => {
      const amt = resolveRow(row, pInc, data); if (amt<=0) return;
      let typDay = null;
      if (row.liveCategories?.length>0) {
        const days = row.liveCategories.flatMap(c=>catDayMap[c]||[]);
        if (days.length) typDay = Math.round(days.reduce((a,b)=>a+b,0)/days.length);
      }
      if (!typDay) typDay = row.type==="percent" ? 15 : 1;
      if (typDay>lastTxDay && typDay<=dIM)
        events.push({day:typDay, label:row.name, amount:-amt, type:"expense"});
    });
    const incomeIn = (selMDataRaw?.transactions??[]).some((t: { isIncome?: boolean; amount: number }) => t.isIncome || t.amount > 0);
    if (!incomeIn) {
      const iDays = completeMonths(data.months).slice(-3).flatMap(m=>
        (m.transactions||[]).filter(t=>t.isIncome||t.amount>0).map(t=>parseInt(t.date?.split("-")[2]||"0")).filter(Boolean)
      );
      const typInc = iDays.length ? Math.round(iDays.reduce((a,b)=>a+b,0)/iDays.length) : 15;
      if (typInc>lastTxDay && typInc<=dIM)
        events.push({day:typInc, label:"Expected income", amount:pInc, type:"income"});
    }
    const anchorDate = `${selMonth}-${String(lastTxDay).padStart(2,"0")}`;
    let runBal = dailyData.find(d=>d.date===anchorDate)?.balance ?? selMData.startBalance;
    return Array.from({length:dIM-lastTxDay},(_,i)=>{
      const d   = lastTxDay+i+1;
      const ds  = String(d).padStart(2,"0");
      const dayEvents = events.filter(e=>e.day===d);
      dayEvents.forEach(e=>runBal+=e.amount);
      return {date:`${selMonth}-${ds}`, projBalance:runBal, events:dayEvents};
    });
  }, [projScen, isCurrentMonth, selMData, today, data, dailyData, selMonth]);

  const dailyChartData = useMemo(() => {
    if (!dailyData.length) return [];
    const projMap: Record<string, typeof steppedProj[0]> = Object.fromEntries(steppedProj.map(p=>[p.date,p]));
    return dailyData.map(d=>({
      ...d,
      projBalance: d.projBalance ?? projMap[d.date]?.projBalance ?? null,
      projEvents:  projMap[d.date]?.events || [],
    }));
  }, [dailyData, steppedProj]);

  // Good/bad stats
  const goodMs   = allMonthsDisplay.filter(m=>markers[m.month]==="good");
  const badMs    = allMonthsDisplay.filter(m=>markers[m.month]==="bad");
  const goodAvgEnd  = goodMs.length?Math.round(goodMs.reduce((a,m)=>a+m.endBalance,0)/goodMs.length):null;
  const goodAvgStart= goodMs.length?Math.round(goodMs.reduce((a,m)=>a+m.startBalance,0)/goodMs.length):null;
  const badAvgEnd   = badMs.length ?Math.round(badMs.reduce((a,m)=>a+m.endBalance,0)/badMs.length) :null;
  const badAvgStart = badMs.length ?Math.round(badMs.reduce((a,m)=>a+m.startBalance,0)/badMs.length):null;
  const goodAvg = goodAvgEnd; // kept for compat
  const badAvg  = badAvgEnd;

  const cycle = (month: string) => {
    const cur = markers[month];
    const next = {...markers};
    if (cur === "good") next[month] = "bad";
    else if (cur === "bad") delete next[month];
    else next[month] = "good";
    onMarkersChange(next as AppState["markers"]);
  };

  const yFmt = (v: number) => `£${Math.abs(v/100).toLocaleString("en-GB",{maximumFractionDigits:0})}`;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>

      {/* Account filter */}
      {allAccountNames.length>0&&(
        <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:2}}>ACCOUNTS:</div>
          <button onClick={()=>setSelAccounts(null)}
            style={{fontFamily:FONT,fontSize:10,padding:"4px 12px",borderRadius:6,cursor:"pointer",
              border:`1px solid ${selAccounts===null?C.amber:C.border}`,
              background:selAccounts===null?`${C.amber}22`:"transparent",
              color:selAccounts===null?C.amber:C.textDim}}>All</button>
          {allAccountNames.map(a=>{
            const active = (selAccounts??allAccountNames).includes(a);
            const obj    = rawAccountObjects.find(o=>o.name===a);
            const col    = TYPE_COLOR[obj?.type ?? "other"] || C.textDim;
            return (
              <button key={a} onClick={()=>{
                const cur  = selAccounts??allAccountNames;
                const next = cur.includes(a)?cur.filter(x=>x!==a):[...cur,a];
                setSelAccounts(next.length===allAccountNames.length?null:next);
              }} style={{fontFamily:FONT,fontSize:10,padding:"4px 12px",borderRadius:6,cursor:"pointer",
                border:`1px solid ${active?col:C.border}`,
                background:active?`${col}22`:"transparent",
                color:active?col:C.textDim}}>
                {a}
              </button>
            );
          })}
        </div>
      )}

      {/* Warning when no accounts would show data */}
      {selAccounts!==null&&selAccounts.length===0&&(
        <div style={{color:C.amber,fontSize:12,padding:"8px 14px",background:`${C.amber}11`,borderRadius:6,border:`1px solid ${C.amber}44`}}>
          No accounts selected — showing all accounts. Click "All" to reset.
        </div>
      )}

      {/* Balance chart */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14,flexWrap:"wrap",gap:8}}>
          <div>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:3}}>TOTAL BALANCE</div>
            <div style={{color:C.textDim,fontSize:11}}>
              {rangeStart&&rangeEnd?`${fmtM(rangeStart)} → ${fmtM(rangeEnd)}`:`Last ${balRange} months`}
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {!rangeStart&&!rangeEnd&&[3,6,12,24].filter(r=>r<=allMonthsDisplay.length).map(r=>(
              <button key={r} onClick={()=>setBalRange(r)} style={{fontFamily:FONT,fontSize:11,padding:"5px 12px",borderRadius:6,cursor:"pointer",
                fontWeight:balRange===r?700:400,border:`1px solid ${balRange===r?C.amber:C.border}`,
                background:balRange===r?C.amber:"transparent",color:balRange===r?"#060e1a":C.textDim}}>{r}mo</button>
            ))}
            <button onClick={()=>setShowProj(o=>!o)} style={{fontFamily:FONT,fontSize:11,padding:"5px 12px",borderRadius:6,cursor:"pointer",
              border:`1px solid ${showProj?C.amber:C.border}`,background:showProj?`${C.amber}22`:"transparent",color:showProj?C.amber:C.textDim}}>
              {showProj?"projection on":"projection off"}
            </button>
            {rangeStart&&rangeEnd&&<button onClick={()=>{setRangeStart(null);setRangeEnd(null);}}
              style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>clear</button>}
            {projScen&&scenarios?.length>0&&(
              <select value={projScenId||""} onChange={e=>setProjScenId(e.target.value)}
                style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 10px",color:C.text,fontSize:11,fontFamily:FONT}}>
                {scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={balChartData}>
            <defs>
              <linearGradient id="bG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal} stopOpacity={.25}/><stop offset="100%" stopColor={C.teal} stopOpacity={0}/></linearGradient>
            </defs>
            <CartesianGrid stroke={C.border} strokeDasharray="3 3"/>
            <XAxis dataKey="month" tickFormatter={fmtM} tick={{fill:C.textDim,fontSize:11}}/>
            <YAxis tickFormatter={yFmt} tick={{fill:C.textDim,fontSize:10}} width={68}/>
            <ReferenceLine y={0} stroke={C.red} strokeOpacity={0.5} strokeDasharray="3 2"/>
            {goodMs.map(m=><ReferenceLine key={m.month+"g"} x={m.month} stroke={C.green} strokeOpacity={0.3} strokeWidth={2}/>)}
            {badMs.map(m=><ReferenceLine key={m.month+"b"} x={m.month} stroke={C.red}   strokeOpacity={0.3} strokeWidth={2}/>)}
            {lastActual&&<ReferenceLine x={lastActual.month} stroke={C.amberMid} strokeDasharray="4 2"/>}
            <Tooltip content={<ChartTip/>}/>
            <Area type="monotone" dataKey="balance"     name="Balance"    stroke={C.teal}  fill="url(#bG)" strokeWidth={2.5} dot={false} connectNulls/>
            <Line  type="monotone" dataKey="projBalance" name="Projected"  stroke={C.amber} strokeWidth={2} strokeDasharray="5 3" dot={false} connectNulls/>
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Good/bad benchmarks */}
      {(goodAvg!==null||badAvg!==null)&&(
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {goodAvg!==null&&<div style={{flex:"1 1 180px",background:C.surface,border:`2px solid ${C.green}`,borderRadius:12,padding:"20px 24px"}}>
            <div style={{color:C.green,fontSize:11,letterSpacing:2,marginBottom:10}}>✓ GOOD ({goodMs.length})</div>
            <div style={{color:C.green,fontSize:28,fontWeight:700}}>{fmt(goodAvgEnd)}</div>
            <div style={{color:C.textDim,fontSize:12,marginTop:4}}>avg end balance</div>
            <div style={{color:C.textDim,fontSize:11,marginTop:6}}>avg start <span style={{color:C.green}}>{fmt(goodAvgStart)}</span></div>
          </div>}
          {badAvg!==null&&<div style={{flex:"1 1 180px",background:C.surface,border:`2px solid ${C.red}`,borderRadius:12,padding:"20px 24px"}}>
            <div style={{color:C.red,fontSize:11,letterSpacing:2,marginBottom:10}}>✗ BAD ({badMs.length})</div>
            <div style={{color:C.red,fontSize:28,fontWeight:700}}>{fmt(badAvgEnd)}</div>
            <div style={{color:C.textDim,fontSize:12,marginTop:4}}>avg end balance</div>
            <div style={{color:C.textDim,fontSize:11,marginTop:6}}>avg start <span style={{color:C.red}}>{fmt(badAvgStart)}</span></div>
          </div>}
          {goodAvg!==null&&badAvg!==null&&<div style={{flex:"1 1 180px",background:C.surface,border:`2px solid ${C.amber}`,borderRadius:12,padding:"20px 24px"}}>
            <div style={{color:C.amber,fontSize:11,letterSpacing:2,marginBottom:10}}>GAP</div>
            <div style={{color:C.amber,fontSize:28,fontWeight:700}}>{fmt((goodAvgEnd??0)-(badAvgEnd??0))}</div>
            <div style={{color:C.textDim,fontSize:12,marginTop:4}}>end balance gap</div>
            <div style={{color:C.textDim,fontSize:11,marginTop:6}}>start gap <span style={{color:C.amber}}>{fmt((goodAvgStart??0)-(badAvgStart??0))}</span></div>
          </div>}
        </div>
      )}

      {/* Month cards */}
      <div>
        <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:10}}>MONTHS — click to view · ⇔ range · ○ mark</div>
        <div data-month-cards style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-start"}}>
          {allMonthsDisplay.map(m => {
            const marker    = markers[m.month];
            const isSelected= m.month===selMonth;
            const inRange   = rangeStart&&rangeEnd?m.month>=rangeStart&&m.month<=rangeEnd:false;
            const isAnchor  = m.month===rangeStart&&!rangeEnd;
            const bc = isSelected?C.amber:marker==="good"?C.green:marker==="bad"?C.red:inRange?C.teal:isAnchor?C.amberMid:C.border;
            const bg = isSelected?`${C.amber}15`:marker==="good"?`${C.green}0d`:marker==="bad"?`${C.red}0d`:inRange?`${C.teal}0a`:C.surface;
            const idx     = allMonthsDisplay.findIndex(mo=>mo.month===m.month);
            const fromEnd = allMonthsDisplay.length-1-idx;

            // All months older than 6 use the hover card — same UI, just smaller when not hovered
            if (fromEnd>=6) return (
              <HoverCard key={m.month} m={m} bc={bc} bg={bg} marker={marker} isSelected={isSelected}
                onSelect={setSelMonth} onCycle={cycle} onRange={handleRange} inRange={inRange} isAnchor={isAnchor}/>
            );

            return (
              <div data-month-card-full key={m.month} style={{background:bg,border:`2px solid ${bc}`,borderRadius:9,padding:"11px 13px",flex:"1 1 130px",minWidth:120}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:7}}>
                  <div onClick={()=>setSelMonth(m.month)} style={{color:isSelected?C.amber:C.text,fontSize:12,fontWeight:isSelected?700:500,cursor:"pointer",fontFamily:FONT}}>{fmtM(m.month)}</div>
                  <div style={{display:"flex",gap:5}}>
                    <button onClick={()=>cycle(m.month)} style={{background:"none",border:"none",cursor:"pointer",fontSize:16,color:marker==="good"?C.green:marker==="bad"?C.red:C.muted,padding:"0 1px"}}>
                      {marker==="good"?"✓":marker==="bad"?"✗":"○"}
                    </button>
                    <button onClick={()=>handleRange(m.month)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:inRange||isAnchor?C.teal:C.muted,padding:"0 1px"}}>⇔</button>
                  </div>
                </div>
                <div onClick={()=>setSelMonth(m.month)} style={{cursor:"pointer"}}>
                  <div style={{color:C.textDim,fontSize:9,marginBottom:2}}>START</div>
                  <div style={{color:C.textDim,fontSize:12}}>{fmt(m.startBalance)}</div>
                  <div style={{color:C.textDim,fontSize:9,marginTop:5,marginBottom:2}}>END</div>
                  <div style={{color:m.endBalance>=m.startBalance?C.teal:C.red,fontSize:15,fontWeight:700}}>{fmt(m.endBalance)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day-by-day */}
      {selMData&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:24}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16,flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{color:C.amber,fontSize:10,letterSpacing:2,marginBottom:4}}>{fmtM(selMonth).toUpperCase()} — DAY BY DAY</div>
              <div style={{display:"flex",gap:16,flexWrap:"wrap"}}>
                <span style={{color:C.blue,fontSize:12}}>start {fmt(selMData.startBalance)}</span>
                <span style={{color:selMData.endBalance>=(selMDataRaw?.startBalance??0)?C.teal:C.red,fontSize:13,fontWeight:700}}>end {fmt(selMData.endBalance)}</span>
                <span style={{color:selMData.endBalance>=(selMDataRaw?.startBalance??0)?C.green:C.red,fontSize:12}}>net {fmt(selMData.endBalance-(selMDataRaw?.startBalance??0))}</span>
                {isCurrentMonth&&<span style={{color:C.textDim,fontSize:11}}>· today {fmtD(today)}</span>}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={dailyChartData}>
              <defs>
                <linearGradient id="dG"  x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.teal}  stopOpacity={.3}/><stop offset="100%" stopColor={C.teal}  stopOpacity={0}/></linearGradient>
                <linearGradient id="dpG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={C.amber} stopOpacity={.2}/><stop offset="100%" stopColor={C.amber} stopOpacity={0}/></linearGradient>
              </defs>
              <CartesianGrid stroke={C.border} strokeDasharray="2 4"/>
              <XAxis dataKey="date" tickFormatter={iso=>iso.split("-")[2]} tick={{fill:C.textDim,fontSize:10}} interval={4}/>
              <YAxis tickFormatter={yFmt} tick={{fill:C.textDim,fontSize:10}} width={68}/>
              <ReferenceLine y={0} stroke={C.red} strokeOpacity={0.6} strokeDasharray="3 2"/>
              {isCurrentMonth&&<ReferenceLine x={today} stroke={C.amber} strokeDasharray="4 2" label={{value:"today",fill:C.amber,fontSize:9,position:"insideTopRight"}}/>}
              <Tooltip content={({active,payload,label})=>{
                if (!active||!payload?.length) return null;
                const p = payload[0]?.payload;
                return (
                  <div style={{background:"#0a182b",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",maxWidth:240}}>
                    <div style={{color:C.textDim,fontSize:11,marginBottom:5}}>{fmtD(label)}{!p?.isPast?" · projected":""}</div>
                    <div style={{color:C.teal,fontSize:13,fontWeight:700,marginBottom:4}}>{fmt(p?.balance??p?.projBalance)}</div>
                    {(p?.txs||[]).map((tx: {id:string;payee:string;amount:number})=><div key={tx.id} style={{fontSize:11,color:tx.amount>=0?C.teal:C.text,marginBottom:1}}>{tx.payee} · {fmt(tx.amount)}</div>)}
                    {(p?.projEvents||[]).map((e: {label:string;amount:number;type:string},i: number)=><div key={i} style={{fontSize:11,color:e.type==="income"?C.green:C.red,marginBottom:1,fontStyle:"italic"}}>~{e.label} · {fmt(e.amount)}</div>)}
                    {!(p?.txs?.length)&&!(p?.projEvents?.length)&&<div style={{color:C.muted,fontSize:11}}>No transactions</div>}
                  </div>
                );
              }}/>
              <Area type="stepAfter" dataKey="balance"     name="Balance"   stroke={C.teal}  fill="url(#dG)"  strokeWidth={2}   dot={false} connectNulls/>
              {isCurrentMonth&&<Area type="stepAfter" dataKey="projBalance" name="Projected" stroke={C.amber} fill="url(#dpG)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls/>}
            </ComposedChart>
          </ResponsiveContainer>

          {/* Transactions */}
          <div style={{marginTop:16,borderTop:`1px solid ${C.border}`,paddingTop:14}}>
            <button onClick={()=>setTxOpen(o=>!o)} style={{background:"transparent",border:"none",color:C.textDim,cursor:"pointer",fontFamily:FONT,fontSize:11,display:"flex",alignItems:"center",gap:8,padding:0,marginBottom:txOpen?12:0}}>
              <span style={{color:C.amber}}>{txOpen?"▼":"▶"}</span>
              TRANSACTIONS ({filterTx(selMData.transactions).length})
            </button>
            {txOpen&&(
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:280,overflowY:"auto"}}>
                {filterTx(selMData.transactions).sort((a: {date:string}, b: {date:string})=>a.date.localeCompare(b.date)).map(tx=>(
                  <div key={tx.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 10px",background:C.elevated,borderRadius:6,borderLeft:`3px solid ${tx.amount>=0?C.teal:C.muted}`}}>
                    <div style={{color:C.textDim,fontSize:10,minWidth:28}}>{tx.date.split("-")[2]}</div>
                    <div style={{flex:1,color:C.text,fontSize:12}}>{tx.payee||"—"}</div>
                    <div style={{color:C.textDim,fontSize:10,minWidth:80}}>{tx.category}</div>
                    {tx.account&&<div style={{color:C.muted,fontSize:9,minWidth:60}}>{tx.account}</div>}
                    <div style={{color:tx.amount>=0?C.teal:C.red,fontSize:13,fontWeight:700,minWidth:64,textAlign:"right"}}>{fmt(tx.amount)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
