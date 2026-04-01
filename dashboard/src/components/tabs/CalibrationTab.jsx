import { useState, useMemo } from "react";
import { C, FONT, TYPE_COLOR } from "../../constants.js";
import { fmt, fmtR, pc, fmtM } from "../../helpers.js";
import { sSet } from "../../helpers.js";
import { SK } from "../../constants.js";

export default function CalibrationTab({ data, reconciliations, onReconciliationsChange }) {
  const [editingCell, setEditingCell] = useState(null); // {acctId, month}
  const [draft, setDraft] = useState("");
  const [showAll, setShowAll] = useState(false);

  const accounts = data.accountObjects || [];
  const allMonths = data.months || [];
  // Show last 12 complete months by default
  const visibleMonths = showAll ? allMonths : allMonths.slice(-12);

  const acctMonthBals = data.accountMonthBals || {};

  const setRec = (acctId, month, valueStr) => {
    const cents = pc(valueStr);
    const next = {
      ...reconciliations,
      [acctId]: { ...(reconciliations[acctId]||{}), [month]: cents },
    };
    onReconciliationsChange(next);
    sSet(SK.cal, { reconciliations: next });
  };

  const clearRec = (acctId, month) => {
    const next = { ...reconciliations };
    if (next[acctId]) {
      const acctRecs = { ...next[acctId] };
      delete acctRecs[month];
      next[acctId] = acctRecs;
    }
    onReconciliationsChange(next);
    sSet(SK.cal, { reconciliations: next });
  };

  const clearAll = () => {
    onReconciliationsChange({});
    sSet(SK.cal, { reconciliations: {} });
  };

  // Recompute per-account forward balances incorporating current reconciliations
  const computedBals = useMemo(() => {
    const result = {};
    for (const acct of accounts) {
      result[acct.id] = {};
      const recs = reconciliations[acct.id] || {};
      const startBal = data.startBalances?.[acct.id] ?? 0;
      let run = startBal;
      for (const m of allMonths) {
        const mKey = m.month;
        const acctTxs = data.txsByAccount?.[acct.id]?.[mKey] || [];
        const net = acctTxs.reduce((s,tx)=>s+(tx.amount||0), 0);
        const calc = run + net;
        const end = recs[mKey] !== undefined ? recs[mKey] : calc;
        const isRec = recs[mKey] !== undefined;
        const drift = isRec ? end - calc : 0;
        result[acct.id][mKey] = { calc, end, net, isRec, drift };
        run = end;
      }
    }
    return result;
  }, [accounts, reconciliations, data, allMonths]);

  const cellStyle = (acctId, mKey) => {
    const b = computedBals[acctId]?.[mKey];
    if (!b) return {background:C.elevated,color:C.muted};
    if (b.isRec) return {background:`${C.amber}22`,color:C.amber,border:`1px solid ${C.amber}55`};
    if (b.end < 0) return {background:`${C.red}11`,color:C.red};
    return {background:C.elevated,color:C.text};
  };

  return (
    <div style={{display:"flex",flexDirection:"column",gap:20}}>
      {/* Header */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:12}}>
          <div>
            <div style={{color:C.amber,fontSize:10,letterSpacing:2,marginBottom:6}}>CALIBRATION</div>
            <div style={{color:C.text,fontSize:15,fontWeight:700,marginBottom:6}}>Account Balance Reconciliation</div>
            <div style={{color:C.textDim,fontSize:12,lineHeight:1.7,maxWidth:560}}>
              The dashboard walks forward from each account's starting balance, adding transactions month by month.
              If a month-end balance is wrong, enter the real balance here — the correction flows forward through all subsequent months automatically.
              Once set, that account is permanently anchored from that point.
            </div>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <button onClick={()=>setShowAll(o=>!o)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 14px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:FONT}}>
              {showAll?`Show last 12`:`Show all ${allMonths.length}`}
            </button>
            <button onClick={clearAll} style={{background:"transparent",border:`1px solid ${C.red}55`,borderRadius:6,padding:"6px 14px",color:C.red,fontSize:11,cursor:"pointer",fontFamily:FONT}}>
              Clear all
            </button>
          </div>
        </div>
      </div>

      {/* Starting balances */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:20}}>
        <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:12}}>STARTING BALANCES (before first month)</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          {accounts.map(acct=>{
            const col = TYPE_COLOR[acct.type]||C.textDim;
            return (
              <div key={acct.id} style={{background:C.elevated,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 16px",minWidth:150}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <div style={{background:`${col}22`,border:`1px solid ${col}55`,borderRadius:4,padding:"2px 6px",fontSize:9,color:col,fontFamily:FONT}}>{acct.type}</div>
                  <div style={{color:C.text,fontSize:12}}>{acct.name}</div>
                </div>
                <div style={{color:col,fontSize:16,fontWeight:700}}>{fmt(data.startBalances?.[acct.id]??0)}</div>
                <div style={{color:C.muted,fontSize:9,marginTop:2}}>from API before period start</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reconciliation table */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontFamily:FONT}}>
            <thead>
              <tr style={{borderBottom:`1px solid ${C.border}`}}>
                <th style={{padding:"10px 14px",textAlign:"left",color:C.textDim,fontSize:10,letterSpacing:2,background:C.elevated,position:"sticky",left:0,zIndex:10,minWidth:160}}>ACCOUNT</th>
                {visibleMonths.map(m=>(
                  <th key={m.month} style={{padding:"10px 12px",textAlign:"right",color:C.textDim,fontSize:10,background:C.elevated,minWidth:100,whiteSpace:"nowrap"}}>
                    {fmtM(m.month)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct,ai)=>{
                const col = TYPE_COLOR[acct.type]||C.textDim;
                return (
                  <tr key={acct.id} style={{borderBottom:`1px solid ${C.border}44`}}>
                    <td style={{padding:"10px 14px",background:C.elevated,position:"sticky",left:0,zIndex:5,borderRight:`1px solid ${C.border}`}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:8,height:8,borderRadius:2,background:col,flexShrink:0}}/>
                        <div>
                          <div style={{color:C.text,fontSize:12}}>{acct.name}</div>
                          <div style={{color:col,fontSize:9}}>{acct.type}</div>
                        </div>
                      </div>
                    </td>
                    {visibleMonths.map(m=>{
                      const b = computedBals[acct.id]?.[m.month];
                      const isEditing = editingCell?.acctId===acct.id&&editingCell?.month===m.month;
                      const cs = cellStyle(acct.id, m.month);
                      return (
                        <td key={m.month} style={{padding:"6px 8px",textAlign:"right",verticalAlign:"top"}}>
                          {isEditing ? (
                            <div style={{display:"flex",flexDirection:"column",gap:3,minWidth:90}}>
                              <input autoFocus type="number" value={draft}
                                onChange={e=>setDraft(e.target.value)}
                                onKeyDown={e=>{
                                  if(e.key==="Enter"){setRec(acct.id,m.month,draft);setEditingCell(null);}
                                  if(e.key==="Escape")setEditingCell(null);
                                }}
                                style={{background:C.bg,border:`1px solid ${C.amber}`,borderRadius:4,padding:"4px 6px",color:C.amber,fontSize:11,fontFamily:FONT,outline:"none",width:"100%",boxSizing:"border-box"}}/>
                              <div style={{display:"flex",gap:3}}>
                                <button onClick={()=>{setRec(acct.id,m.month,draft);setEditingCell(null);}}
                                  style={{flex:1,background:C.amber,color:"#060e1a",border:"none",borderRadius:3,padding:"3px 0",fontSize:9,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>SET</button>
                                {b?.isRec&&<button onClick={()=>{clearRec(acct.id,m.month);setEditingCell(null);}}
                                  style={{flex:1,background:"transparent",border:`1px solid ${C.red}`,borderRadius:3,padding:"3px 0",fontSize:9,color:C.red,cursor:"pointer",fontFamily:FONT}}>CLR</button>}
                                <button onClick={()=>setEditingCell(null)}
                                  style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:3,padding:"3px 5px",fontSize:9,color:C.textDim,cursor:"pointer",fontFamily:FONT}}>✕</button>
                              </div>
                            </div>
                          ) : (
                            <div onClick={()=>{setEditingCell({acctId:acct.id,month:m.month});setDraft(fmtR(b?.end??0));}}
                              title="Click to override"
                              style={{...cs,borderRadius:4,padding:"5px 8px",cursor:"pointer",minWidth:80,display:"inline-block",border:cs.border||"1px solid transparent"}}>
                              <div style={{fontSize:11,fontWeight:b?.isRec?700:400}}>
                                {b ? fmt(b.end) : "—"}
                              </div>
                              {b?.isRec&&b.drift!==0&&(
                                <div style={{fontSize:9,color:C.muted,marginTop:1}}>
                                  calc: {fmt(b.calc)}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{borderTop:`1px solid ${C.amberMid}`,background:C.elevated}}>
                <td style={{padding:"10px 14px",background:C.elevated,position:"sticky",left:0,zIndex:5,borderRight:`1px solid ${C.border}`}}>
                  <div style={{color:C.amber,fontSize:11,fontWeight:700}}>TOTAL</div>
                </td>
                {visibleMonths.map(m=>{
                  const total = accounts.reduce((s,a)=>s+(computedBals[a.id]?.[m.month]?.end??0),0);
                  return (
                    <td key={m.month} style={{padding:"10px 8px",textAlign:"right"}}>
                      <div style={{color:total>=0?C.amber:C.red,fontSize:12,fontWeight:700}}>{fmt(total)}</div>
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{padding:"12px 16px",background:C.elevated,borderTop:`1px solid ${C.border}`,display:"flex",gap:16,flexWrap:"wrap"}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:10,height:10,borderRadius:2,background:`${C.amber}22`,border:`1px solid ${C.amber}55`}}/>
            <div style={{color:C.textDim,fontSize:10}}>Reconciled (click to edit)</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:10,height:10,borderRadius:2,background:`${C.red}11`}}/>
            <div style={{color:C.textDim,fontSize:10}}>Negative balance</div>
          </div>
          <div style={{color:C.textDim,fontSize:10}}>Click any cell to enter the real end-of-month balance. Corrections flow forward permanently.</div>
        </div>
      </div>
    </div>
  );
}
