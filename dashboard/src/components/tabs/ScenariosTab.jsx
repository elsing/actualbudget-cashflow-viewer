import { useState } from "react";
import { C, FONT, CAT_PALETTE, PRESET_COLORS } from "../../constants.js";
import { fmt, fmtR, fmtD, pc, uid, completeMonths } from "../../helpers.js";
import { resolveIncome, resolveRow, liveAvg, liveLastCompleteMonth, liveIncome } from "../../finance.js";
import { Chip, ColorSwatch } from "../ui/index.jsx";

// live_group removed — it was identical to live. Any saved rows with live_group
// are treated as live automatically via the resolveRow fallback in finance.js.
const ROW_TYPE_LABELS = {
  fixed:   "Fixed £",
  percent: "% of income",
  live:    "Live avg (complete months)",
  last:    "Last complete month",
};

// ── Group manager ─────────────────────────────────────────────────────────────
function GroupManager({ groups, onChange }) {
  const [editId, setEditId] = useState(null);
  const [draft,  setDraft]  = useState("");
  const commit = id => { onChange(groups.map(g=>g.id===id?{...g,name:draft.trim()||g.name}:g)); setEditId(null); };
  const move = (id,dir) => {
    const i = groups.findIndex(g=>g.id===id);
    if (i+dir<0||i+dir>=groups.length) return;
    const n=[...groups]; [n[i],n[i+dir]]=[n[i+dir],n[i]]; onChange(n);
  };
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {groups.map((g,i)=>(
        <div key={g.id} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:C.elevated,borderRadius:7,border:`1px solid ${C.border}`}}>
          <ColorSwatch value={g.color} onChange={col=>onChange(groups.map(x=>x.id===g.id?{...x,color:col}:x))}/>
          {editId===g.id
            ?<input autoFocus value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>commit(g.id)} onKeyDown={e=>e.key==="Enter"&&commit(g.id)}
                style={{flex:1,background:C.bg,border:`1px solid ${C.amber}`,borderRadius:5,padding:"4px 8px",color:C.text,fontSize:12,fontFamily:FONT,outline:"none"}}/>
            :<div onClick={()=>{setEditId(g.id);setDraft(g.name);}} style={{flex:1,color:g.color,fontSize:12,cursor:"text"}}>{g.name}</div>}
          <div style={{display:"flex",gap:4}}>
            <button onClick={()=>move(g.id,-1)} disabled={i===0} style={{background:"none",border:"none",color:i===0?C.muted:C.textDim,cursor:i===0?"default":"pointer",fontSize:12,padding:"0 3px"}}>↑</button>
            <button onClick={()=>move(g.id, 1)} disabled={i===groups.length-1} style={{background:"none",border:"none",color:i===groups.length-1?C.muted:C.textDim,cursor:i===groups.length-1?"default":"pointer",fontSize:12,padding:"0 3px"}}>↓</button>
            <button onClick={()=>onChange(groups.filter(g2=>g2.id!==g.id))} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:14,padding:"0 3px"}}>×</button>
          </div>
        </div>
      ))}
      <button onClick={()=>{const g={id:uid(),name:"New Group",color:PRESET_COLORS[groups.length%PRESET_COLORS.length]};onChange([...groups,g]);setEditId(g.id);setDraft(g.name);}}
        style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:7,padding:"7px 0",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:FONT}}>+ add group</button>
    </div>
  );
}

// ── Income editor ─────────────────────────────────────────────────────────────
function IncomeEditor({ income, onChange, data }) {
  const live     = liveIncome(data);
  const resolved = resolveIncome(income, data);
  const incomeCats   = data.incomeCategories || [];
  const selectedCats = income.cats || [];
  const toggleCat = cat => {
    const n = selectedCats.includes(cat)?selectedCats.filter(c=>c!==cat):[...selectedCats,cat];
    onChange({...income, type:"cats", cats:n});
  };
  const desc = () => {
    switch(income?.type) {
      case "cats":     return selectedCats.length ? `${selectedCats.length} income categories · ${(income.avgOrLast||"avg")==="avg"?"12mo avg":"last month"}` : "no categories selected";
      case "fixed":    return "fixed monthly amount";
      case "live":     return "all income · 12mo avg (complete months)";
      case "pct_live": return `${income.pct>=0?"+":""}${income.pct}% on all income avg`;
      default:         return "";
    }
  };
  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"10px 10px 0 0",padding:"20px 22px 18px"}}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",flexWrap:"wrap",gap:14}}>
        <div>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:3,marginBottom:10}}>MONEY IN</div>
          <div style={{color:C.teal,fontSize:32,fontWeight:700}}>{fmt(resolved)}</div>
          <div style={{color:C.textDim,fontSize:11,marginTop:5}}>{desc()}</div>
        </div>
        <div data-income-editor style={{display:"flex",flexDirection:"column",gap:8,minWidth:280}}>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[{v:"cats",l:"By Category"},{v:"live",l:"All Income"},{v:"fixed",l:"Fixed £"},{v:"pct_live",l:"± %"}].map(({v,l})=>(
              <button key={v} onClick={()=>onChange({...income,type:v})} style={{
                flex:1,minWidth:80,fontFamily:FONT,fontSize:10,padding:"6px 0",borderRadius:6,cursor:"pointer",
                border:`1px solid ${income.type===v?C.teal:C.border}`,
                background:income.type===v?`${C.teal}22`:"transparent",
                color:income.type===v?C.teal:C.textDim,
              }}>{l}</button>
            ))}
          </div>
          {income.type==="cats"&&(
            <div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                {[{v:"avg",l:"12mo avg"},{v:"last",l:"Last month"}].map(({v,l})=>(
                  <button key={v} onClick={()=>onChange({...income,avgOrLast:v})} style={{
                    flex:1,fontFamily:FONT,fontSize:10,padding:"4px 0",borderRadius:5,cursor:"pointer",
                    border:`1px solid ${(income.avgOrLast||"avg")===v?C.teal:C.border}`,
                    background:(income.avgOrLast||"avg")===v?`${C.teal}22`:"transparent",
                    color:(income.avgOrLast||"avg")===v?C.teal:C.textDim,
                  }}>{l}</button>
                ))}
              </div>
              {incomeCats.length>0
                ?<div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                    {incomeCats.map(cat=>{
                      const sel=selectedCats.includes(cat);
                      return <button key={cat} onClick={()=>toggleCat(cat)} style={{fontFamily:FONT,fontSize:10,padding:"4px 10px",borderRadius:5,cursor:"pointer",border:`1px solid ${sel?C.teal:C.border}`,background:sel?`${C.teal}22`:"transparent",color:sel?C.teal:C.textDim}}>{cat}</button>;
                    })}
                  </div>
                :<div style={{color:C.amber,fontSize:11}}>No income categories found — mark categories as income in Actual Budget first.</div>
              }
              <div style={{display:"flex",alignItems:"center",gap:8,marginTop:8}}>
                <span style={{color:C.textDim,fontSize:10}}>+ fixed top-up:</span>
                <input type="number" value={fmtR(income.fixedExtra||0)} onChange={e=>onChange({...income,fixedExtra:pc(e.target.value)})} placeholder="0.00"
                  style={{width:90,background:C.bg,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.teal,fontSize:11,fontFamily:FONT,outline:"none"}}/>
                <span style={{color:C.textDim,fontSize:10}}>/mo</span>
              </div>
            </div>
          )}
          {income.type==="fixed"&&(
            <input type="number" value={fmtR(income.amount??live)} onChange={e=>onChange({...income,amount:pc(e.target.value)})}
              style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 12px",color:C.teal,fontSize:13,fontFamily:FONT,outline:"none",fontWeight:700}}/>
          )}
          {income.type==="pct_live"&&(
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <input type="number" value={income.pct??0} onChange={e=>onChange({...income,pct:parseFloat(e.target.value)||0})} step={1}
                style={{width:70,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:(income.pct??0)>=0?C.teal:C.red,fontSize:13,fontFamily:FONT,outline:"none",fontWeight:700}}/>
              <span style={{color:C.textDim,fontSize:12}}>% on {fmt(live)} = {fmt(resolved)}/mo</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Transaction drill-down ────────────────────────────────────────────────────
function TxDrillDown({ cats, data, type }) {
  const [open, setOpen] = useState(false);
  const months = type==="last"
    ? completeMonths(data.months).slice(-1)
    : completeMonths(data.months).slice(-12);
  const txs = months.flatMap(m =>
    (m.transactions||[]).filter(t => cats.includes(t.category))
  ).sort((a,b) => b.date.localeCompare(a.date));

  // Group by month for display
  const byMonth = {};
  txs.forEach(t => {
    const m = t.date?.slice(0,7); if (!m) return;
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(t);
  });

  return (
    <div style={{marginTop:8,borderTop:`1px solid ${C.border}`,paddingTop:8}}>
      <button onClick={()=>setOpen(o=>!o)} style={{background:"transparent",border:"none",color:C.textDim,cursor:"pointer",fontFamily:FONT,fontSize:10,display:"flex",alignItems:"center",gap:6,padding:0}}>
        <span style={{color:C.amber}}>{open?"▼":"▶"}</span>
        {open?"HIDE":"SHOW"} TRANSACTIONS ({txs.length} across {Object.keys(byMonth).length} months)
      </button>
      {open&&(
        <div style={{marginTop:8,maxHeight:280,overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
          {Object.entries(byMonth).sort((a,b)=>b[0].localeCompare(a[0])).map(([month,mtxs])=>{
            const net = mtxs.reduce((s,t)=>s+t.amount,0);
            return (
              <div key={month}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <div style={{color:C.textDim,fontSize:10,letterSpacing:1}}>{month}</div>
                  <div style={{color:net>=0?C.teal:C.red,fontSize:10,fontWeight:700}}>net {fmt(net)}</div>
                </div>
                {mtxs.map(t=>(
                  <div key={t.id} style={{display:"flex",gap:8,padding:"4px 8px",background:C.bg,borderRadius:5,marginBottom:3,borderLeft:`2px solid ${t.amount>=0?C.teal:C.muted}`}}>
                    <div style={{color:C.muted,fontSize:9,minWidth:24}}>{t.date?.split("-")[2]}</div>
                    <div style={{flex:1,color:C.text,fontSize:10,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.payee||"—"}</div>
                    <div style={{color:C.textDim,fontSize:9,minWidth:70}}>{t.category}</div>
                    <div style={{color:t.amount>=0?C.teal:C.red,fontSize:10,fontWeight:700,minWidth:60,textAlign:"right"}}>{fmt(t.amount)}</div>
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

// ── Number input helpers (local draft avoids cursor-jump on each keystroke) ──────
function FixedInput({ label, value, onChange, suffix }) {
  const [draft, setDraft] = useState(fmtR(value));
  // Sync if parent changes (e.g. reset)
  const commit = () => { const v=pc(draft); onChange(v); setDraft(fmtR(v)); };
  return (
    <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
      {label&&<span style={{color:C.textDim,fontSize:11}}>{label}:</span>}
      <input type="number" value={draft}
        onChange={e=>setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e=>e.key==="Enter"&&commit()}
        style={{width:110,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px",color:C.amber,fontSize:12,fontFamily:FONT,outline:"none"}}/>
      <span style={{color:C.textDim,fontSize:11}}>{fmt(pc(draft))}{suffix}</span>
    </div>
  );
}
function PctInput({ value, onChange }) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => { const v=parseFloat(draft)||0; onChange(v); setDraft(String(v)); };
  return (
    <input type="number" value={draft} step={0.5}
      onChange={e=>setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e=>e.key==="Enter"&&commit()}
      style={{width:80,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px",color:C.amber,fontSize:12,fontFamily:FONT,outline:"none"}}/>
  );
}

// ── Row editor ────────────────────────────────────────────────────────────────
function RowEditor({ row, income, data, onChange, onDelete, allCats, groups }) {
  const [editing, setEditing] = useState(false);
  const group    = groups.find(g=>g.id===row.group)||groups[0];
  const gc       = group?.color||C.amber;
  const resolved = resolveRow(row, income, data);
  // Normalise live_group → live for display
  const displayType = ROW_TYPE_LABELS[row.type==="live_group"?"live":row.type] || row.type;

  if (!editing) return (
    <div style={{display:"flex",alignItems:"center",gap:9,padding:"9px 14px",background:row.enabled?C.elevated:C.surface,borderRadius:8,border:`1px solid ${row.enabled?C.border:"#111c2d"}`,opacity:row.enabled?1:0.42}}>
      <div onClick={()=>onChange({...row,enabled:!row.enabled})} style={{width:30,height:17,borderRadius:9,background:row.enabled?gc:C.muted,cursor:"pointer",position:"relative",flexShrink:0}}>
        <div style={{position:"absolute",top:1.5,left:row.enabled?14:2,width:14,height:14,borderRadius:7,background:"#fff",transition:"left 0.2s"}}/>
      </div>
      <div style={{width:8,height:8,borderRadius:2,background:gc,flexShrink:0}}/>
      <div style={{flex:1,color:row.enabled?C.text:C.textDim,fontSize:13}}>{row.name}</div>
      {(row.liveCategories||[]).length>0&&<div style={{color:C.textDim,fontSize:9,maxWidth:130,textAlign:"right",lineHeight:1.3}}>{row.liveCategories.join(", ")}</div>}
      <div style={{color:C.textDim,fontSize:9,background:C.bg,padding:"2px 6px",borderRadius:4}}>{displayType}</div>
      <div style={{color:row.enabled?gc:C.muted,fontSize:14,fontWeight:700,minWidth:72,textAlign:"right"}}>{fmt(resolved)}</div>
      <div onClick={()=>setEditing(true)} style={{color:C.textDim,cursor:"pointer",fontSize:13,padding:"0 3px",userSelect:"none"}}>✎</div>
      <div onClick={onDelete} style={{color:C.muted,cursor:"pointer",fontSize:15,padding:"0 3px",userSelect:"none"}}>×</div>
    </div>
  );

  const editType = row.type==="live_group"?"live":row.type;

  return (
    <div style={{padding:14,background:C.elevated,borderRadius:8,border:`1px solid ${gc}55`}}>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
        <input value={row.name} onChange={e=>onChange({...row,name:e.target.value})} placeholder="Name"
          style={{flex:2,minWidth:120,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:FONT,outline:"none"}}/>
        <select value={row.group} onChange={e=>onChange({...row,group:e.target.value})}
          style={{flex:1,minWidth:100,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:FONT}}>
          {groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select value={editType} onChange={e=>onChange({...row,type:e.target.value})}
          style={{flex:1,minWidth:130,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 10px",color:C.text,fontSize:12,fontFamily:FONT}}>
          {Object.entries(ROW_TYPE_LABELS).map(([v,l])=><option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {editType==="fixed"&&(
        <FixedInput label="Amount" value={row.amount??0} onChange={v=>onChange({...row,amount:v})} suffix="/mo"/>
      )}
      {editType==="percent"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
          <span style={{color:C.textDim,fontSize:11}}>% of income:</span>
          <PctInput value={row.pct??0} onChange={v=>onChange({...row,pct:v})}/>
          <span style={{color:C.textDim,fontSize:11}}>= {fmt(Math.round(income*(row.pct??0)/100))}/mo</span>
        </div>
      )}
      {(editType==="live"||editType==="last")&&(
        <div style={{marginBottom:10}}>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:1,marginBottom:4}}>
            {editType==="live"?"12-month average of complete months":"Last complete month only"}
            {" — "}Map to Actual categories (net spend: refunds cancel out purchases)
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {allCats.map((cat,i)=>{
              const sel=(row.liveCategories||[]).includes(cat);
              return <Chip key={cat} label={cat} color={CAT_PALETTE[i%CAT_PALETTE.length]} active={sel} small
                onClick={()=>{const n=sel?(row.liveCategories||[]).filter(c=>c!==cat):[...(row.liveCategories||[]),cat];onChange({...row,liveCategories:n});}}/>;
            })}
          </div>
          {(row.liveCategories||[]).length>0&&(
            <div style={{color:C.teal,fontSize:11,marginTop:8}}>
              {editType==="live"?`avg ${fmt(liveAvg(data,row.liveCategories))}/mo`:`last ${fmt(liveLastCompleteMonth(data,row.liveCategories))}`}
              {" (complete months only)"}
            </div>
          )}
        </div>
      )}
      {/* Transaction drill-down for live/last types */}
      {(editType==="live"||editType==="last")&&(row.liveCategories||[]).length>0&&(
        <TxDrillDown cats={row.liveCategories} data={data} type={editType}/>
      )}
      <div style={{display:"flex",justifyContent:"flex-end",marginTop:10}}>
        <button onClick={()=>setEditing(false)} style={{background:C.amber,color:"#060e1a",border:"none",borderRadius:5,padding:"5px 16px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>DONE</button>
      </div>
    </div>
  );
}

// ── Scenario editor ───────────────────────────────────────────────────────────
function ScenarioEditor({ scenario, data, onChange, groups, onGroupsChange }) {
  const [showGroups, setShowGroups] = useState(false);
  const incomeAmt = resolveIncome(scenario.income, data);
  const groupRows = {};
  scenario.rows.forEach(r=>{ if(!groupRows[r.group])groupRows[r.group]=[]; groupRows[r.group].push(r); });
  const totalOut  = scenario.rows.filter(r=>r.enabled).reduce((a,r)=>a+resolveRow(r,incomeAmt,data),0);
  const remaining = incomeAmt - totalOut;

  return (
    <div data-scenario-editor style={{display:"flex",flexDirection:"column",maxWidth:900}}>
      <IncomeEditor income={scenario.income} data={data} onChange={inc=>onChange({...scenario,income:inc})}/>
      <div style={{background:C.elevated,borderLeft:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,padding:"6px 22px",display:"flex",alignItems:"center",gap:8}}>
        <div style={{flex:1,height:1,background:C.border}}/>
        <div style={{color:C.textDim,fontSize:10,letterSpacing:2}}>▼ MONEY OUT</div>
        <div style={{flex:1,height:1,background:C.border}}/>
        <button onClick={()=>setShowGroups(o=>!o)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT,marginLeft:8}}>
          {showGroups?"▲ groups":"⚙ groups"}
        </button>
      </div>
      {showGroups&&(
        <div style={{background:C.surface,borderLeft:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,padding:"16px 22px",borderBottom:`1px solid ${C.border}`}}>
          <GroupManager groups={groups} onChange={onGroupsChange}/>
        </div>
      )}
      <div style={{background:C.surface,borderLeft:`1px solid ${C.border}`,borderRight:`1px solid ${C.border}`,padding:"0 22px"}}>
        {groups.map(g=>{
          const rows = groupRows[g.id]||[];
          const tot  = rows.filter(r=>r.enabled).reduce((a,r)=>a+resolveRow(r,incomeAmt,data),0);
          return (
            <div key={g.id} style={{borderBottom:`1px solid ${C.border}`,padding:"14px 0"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:rows.length?10:4}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:10,height:10,borderRadius:3,background:g.color}}/>
                  <div style={{color:g.color,fontSize:10,letterSpacing:2,fontWeight:700}}>{g.name.toUpperCase()}</div>
                </div>
                <div style={{color:g.color,fontSize:13,fontWeight:700}}>{fmt(tot)}</div>
              </div>
              {rows.length===0&&<div style={{color:C.muted,fontSize:11,padding:"4px 0"}}>No rows in this group.</div>}
              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                {rows.map(row=>(
                  <RowEditor key={row.id} row={row} income={incomeAmt} data={data}
                    allCats={data.categories} groups={groups}
                    onChange={u=>onChange({...scenario,rows:scenario.rows.map(r=>r.id===row.id?u:r)})}
                    onDelete={()=>onChange({...scenario,rows:scenario.rows.filter(r=>r.id!==row.id)})}/>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{padding:"14px 0"}}>
          <button onClick={()=>onChange({...scenario,rows:[...scenario.rows,{id:uid(),group:groups[0]?.id||"g1",name:"New item",type:"fixed",amount:10000,pct:5,liveCategories:[],enabled:true}]})}
            style={{width:"100%",background:"transparent",border:`1px dashed ${C.border}`,borderRadius:7,padding:"9px 0",color:C.textDim,fontSize:12,cursor:"pointer",fontFamily:FONT}}>+ ADD ROW</button>
        </div>
      </div>
      <div style={{background:C.elevated,border:`1px solid ${C.border}`,borderTop:`1px solid ${C.amberMid}`,borderRadius:"0 0 10px 10px",padding:20}}>
        <div style={{display:"flex",justifyContent:"space-between",flexWrap:"wrap",gap:12,alignItems:"flex-start"}}>
          <div>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:3,marginBottom:6}}>REMAINING / UNALLOCATED</div>
            <div style={{color:remaining>=0?C.amber:C.red,fontSize:32,fontWeight:700}}>{fmt(remaining)}</div>
            <div style={{color:C.textDim,fontSize:11,marginTop:4}}>{Math.round((totalOut/Math.max(incomeAmt,1))*100)}% allocated · {fmt(totalOut)}/mo out</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{color:C.textDim,fontSize:11,marginBottom:4}}>annualised</div>
            <div style={{color:remaining>=0?C.teal:C.red,fontSize:22,fontWeight:700}}>{fmt(remaining*12)}/yr</div>
          </div>
        </div>
        <div style={{marginTop:16,background:C.bg,borderRadius:4,height:8,overflow:"hidden",display:"flex"}}>
          {groups.map(g=>{
            const tot=(groupRows[g.id]||[]).filter(r=>r.enabled).reduce((a,r)=>a+resolveRow(r,incomeAmt,data),0);
            return <div key={g.id} style={{width:`${(tot/Math.max(incomeAmt,1))*100}%`,background:g.color,transition:"width 0.3s"}}/>;
          })}
          <div style={{flex:1,background:`${C.muted}44`}}/>
        </div>
      </div>
    </div>
  );
}

// ── Compare view (up to 3 scenarios) ─────────────────────────────────────────
function CompareView({ scenarios, data, groups }) {
  const [ids, setIds] = useState([
    scenarios[0]?.id||"",
    scenarios[1]?.id||scenarios[0]?.id||"",
    scenarios[2]?.id||"",
  ]);
  const [numCols, setNumCols] = useState(Math.min(2, scenarios.length));

  const cols = ids.slice(0, numCols).map(id => scenarios.find(s=>s.id===id)||scenarios[0]).filter(Boolean);
  const incs = cols.map(s => resolveIncome(s.income, data));
  const outs = cols.map((s,i) => s.rows.filter(r=>r.enabled).reduce((a,r)=>a+resolveRow(r,incs[i],data),0));
  const rems = cols.map((s,i) => incs[i] - outs[i]);

  const setId = (col, val) => setIds(prev => prev.map((v,i)=>i===col?val:v));

  const allNames = [...new Set(cols.flatMap(s=>s.rows.map(r=>r.name)))];

  const colW = numCols===2 ? "1fr" : "1fr 1fr 1fr";

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:1000}}>
      {/* Column selectors + mode */}
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <div style={{color:C.textDim,fontSize:11}}>COMPARE:</div>
        {Array.from({length:numCols}).map((_,ci)=>(
          <div key={ci} style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:2,background:cols[ci]?.color??C.muted,flexShrink:0}}/>
            <select value={ids[ci]} onChange={e=>setId(ci,e.target.value)}
              style={{background:C.surface,border:`1px solid ${cols[ci]?.color??C.border}44`,borderRadius:6,padding:"6px 12px",color:C.text,fontSize:12,fontFamily:FONT}}>
              {scenarios.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:6}}>
          {[2,3].filter(n=>n<=scenarios.length).map(n=>(
            <button key={n} onClick={()=>setNumCols(n)} style={{fontFamily:FONT,fontSize:10,padding:"5px 12px",borderRadius:6,cursor:"pointer",
              border:`1px solid ${numCols===n?C.amber:C.border}`,background:numCols===n?`${C.amber}22`:"transparent",color:numCols===n?C.amber:C.textDim}}>
              {n} cols
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{display:"grid",gridTemplateColumns:colW,gap:10}}>
        {cols.map((s,i)=>(
          <div key={s.id} style={{background:C.surface,border:`1px solid ${s.color}44`,borderRadius:9,padding:"14px 18px"}}>
            <div style={{display:"flex",gap:8,marginBottom:8,alignItems:"center"}}>
              <div style={{width:8,height:8,borderRadius:2,background:s.color}}/>
              <div style={{color:s.color,fontSize:12,fontWeight:700}}>{s.name}</div>
            </div>
            {[{l:"Income",v:incs[i],c:C.teal},{l:"Out",v:outs[i],c:C.red},{l:"Net",v:rems[i],c:rems[i]>=0?C.amber:C.red},{l:"Annual",v:rems[i]*12,c:rems[i]>=0?C.teal:C.red}].map(({l,v,c})=>(
              <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                <div style={{color:C.textDim,fontSize:11}}>{l}</div>
                <div style={{color:c,fontSize:12,fontWeight:700}}>{fmt(v)}</div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Row breakdown */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden"}}>
        <div style={{display:"grid",gridTemplateColumns:`180px repeat(${numCols},1fr)`,padding:"9px 14px",borderBottom:`1px solid ${C.border}`,background:C.elevated}}>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:2}}>ROW</div>
          {cols.map(s=><div key={s.id} style={{color:s.color,fontSize:10,fontWeight:700,textAlign:"right"}}>{s.name}</div>)}
        </div>
        {allNames.map(name=>{
          const vals = cols.map((s,i)=>{ const r=s.rows.find(r=>r.name===name); return r?.enabled?resolveRow(r,incs[i],data):null; });
          const g = groups.find(g=>g.id===cols.flatMap(s=>s.rows).find(r=>r.name===name)?.group);
          return (
            <div key={name} style={{display:"grid",gridTemplateColumns:`180px repeat(${numCols},1fr)`,padding:"8px 14px",borderBottom:`1px solid ${C.border}44`}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:5,height:5,borderRadius:1,background:g?.color||C.muted}}/>
                <div style={{color:C.text,fontSize:12}}>{name}</div>
              </div>
              {vals.map((v,i)=><div key={i} style={{color:v!=null?C.text:C.muted,fontSize:12,textAlign:"right"}}>{v!=null?fmt(v):"—"}</div>)}
            </div>
          );
        })}
        <div style={{display:"grid",gridTemplateColumns:`180px repeat(${numCols},1fr)`,padding:"12px 14px",background:C.elevated,borderTop:`1px solid ${C.amberMid}`}}>
          <div style={{color:C.amber,fontSize:11,fontWeight:700}}>Net remaining</div>
          {rems.map((v,i)=><div key={i} style={{color:v>=0?C.amber:C.red,fontSize:14,fontWeight:700,textAlign:"right"}}>{fmt(v)}</div>)}
        </div>
      </div>
    </div>
  );
}

// ── Scenario tab bar ──────────────────────────────────────────────────────────
// Inline rename + colour picker + reorder on the tab bar itself
function ScenarioTabBar({ scenarios, activeId, setActiveId, view, setView, onScenariosChange }) {
  const [editingId, setEditingId]   = useState(null);
  const [nameDraft, setNameDraft]   = useState("");
  const [naming,    setNaming]      = useState(false);
  const [newName,   setNewName]     = useState("");

  const commitName = id => {
    onScenariosChange(scenarios.map(s=>s.id===id?{...s,name:nameDraft.trim()||s.name}:s));
    setEditingId(null);
  };
  const move = (id, dir) => {
    const i = scenarios.findIndex(s=>s.id===id);
    if (i+dir<0||i+dir>=scenarios.length) return;
    const n=[...scenarios]; [n[i],n[i+dir]]=[n[i+dir],n[i]];
    onScenariosChange(n);
  };
  const del = id => {
    if (scenarios.length<=1) return;
    const next = scenarios.filter(s=>s.id!==id);
    onScenariosChange(next);
    if (activeId===id) setActiveId(next[0].id);
  };
  const dup = () => {
    const src = scenarios.find(s=>s.id===activeId)||scenarios[0];
    const ns = {...src,id:uid(),name:src.name+" (copy)",rows:src.rows.map(r=>({...r,id:uid()}))};
    onScenariosChange([...scenarios,ns]); setActiveId(ns.id);
  };
  const add = () => {
    if (!newName.trim()) return;
    const src = scenarios.find(s=>s.id===activeId)||scenarios[0];
    const ns = {...src,id:uid(),name:newName.trim(),color:PRESET_COLORS[scenarios.length%PRESET_COLORS.length],rows:src.rows.map(r=>({...r,id:uid()}))};
    onScenariosChange([...scenarios,ns]); setActiveId(ns.id); setNaming(false); setNewName("");
  };

  return (
    <div data-scenario-tab-bar style={{display:"flex",alignItems:"stretch",borderBottom:`1px solid ${C.border}`,marginBottom:20,flexWrap:"wrap",gap:0}}>
      {scenarios.map((s,si)=>{
        const isActive = activeId===s.id&&view==="edit";
        return (
          <div key={s.id}
            onClick={()=>{setActiveId(s.id);setView("edit");}}
            style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",cursor:"pointer",
              borderBottom:`2px solid ${isActive?s.color:"transparent"}`,
              background:isActive?`${s.color}11`:"transparent",
              position:"relative"}}>
            {/* Colour swatch */}
            <div onClick={e=>e.stopPropagation()}>
              <ColorSwatch value={s.color} onChange={col=>onScenariosChange(scenarios.map(x=>x.id===s.id?{...x,color:col}:x))}/>
            </div>
            {/* Name — double-click to rename */}
            {editingId===s.id
              ?<input autoFocus value={nameDraft} onChange={e=>setNameDraft(e.target.value)}
                  onBlur={()=>commitName(s.id)} onKeyDown={e=>{if(e.key==="Enter")commitName(s.id);if(e.key==="Escape")setEditingId(null);}}
                  onClick={e=>e.stopPropagation()}
                  style={{width:100,background:C.bg,border:`1px solid ${s.color}`,borderRadius:4,padding:"2px 6px",color:C.text,fontSize:11,fontFamily:FONT,outline:"none"}}/>
              :<span onDoubleClick={e=>{e.stopPropagation();setEditingId(s.id);setNameDraft(s.name);}}
                  title="Double-click to rename"
                  style={{color:isActive?s.color:C.textDim,fontSize:11,fontFamily:FONT,userSelect:"none"}}>{s.name}</span>
            }
            {/* Reorder + delete */}
            <div onClick={e=>e.stopPropagation()} style={{display:"flex",gap:2,marginLeft:2}}>
              {si>0&&<span onClick={()=>move(s.id,-1)} style={{color:C.muted,cursor:"pointer",fontSize:10,padding:"0 2px"}}>←</span>}
              {si<scenarios.length-1&&<span onClick={()=>move(s.id,1)} style={{color:C.muted,cursor:"pointer",fontSize:10,padding:"0 2px"}}>→</span>}
              {scenarios.length>1&&<span onClick={()=>del(s.id)} style={{color:C.muted,cursor:"pointer",fontSize:13,padding:"0 2px"}}>×</span>}
            </div>
          </div>
        );
      })}

      {/* Compare tab */}
      <div onClick={()=>setView("compare")} style={{display:"flex",alignItems:"center",padding:"8px 14px",cursor:"pointer",
        borderBottom:`2px solid ${view==="compare"?C.amber:"transparent"}`,background:view==="compare"?`${C.amber}11`:"transparent"}}>
        <span style={{color:view==="compare"?C.amber:C.textDim,fontSize:11,fontFamily:FONT}}>⇄ Compare</span>
      </div>
      {/* Projection tab */}
      <div onClick={()=>setView("projection")} style={{display:"flex",alignItems:"center",padding:"8px 14px",cursor:"pointer",
        borderBottom:`2px solid ${view==="projection"?C.teal:"transparent"}`,background:view==="projection"?`${C.teal}11`:"transparent"}}>
        <span style={{color:view==="projection"?C.teal:C.textDim,fontSize:11,fontFamily:FONT}}>📅 Projection</span>
      </div>

      {/* Actions */}
      <div style={{marginLeft:"auto",display:"flex",gap:6,alignItems:"center",padding:"0 8px"}}>
        {view==="edit"&&<button onClick={dup} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>duplicate</button>}
        {naming
          ?<div style={{display:"flex",gap:6,alignItems:"center"}}>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Scenario name" onKeyDown={e=>e.key==="Enter"&&add()} autoFocus
                style={{background:C.bg,border:`1px solid ${C.amber}`,borderRadius:5,padding:"4px 10px",color:C.text,fontSize:11,fontFamily:FONT,outline:"none",width:130}}/>
              <button onClick={add} style={{background:C.amber,color:"#060e1a",border:"none",borderRadius:5,padding:"4px 12px",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>ADD</button>
              <button onClick={()=>setNaming(false)} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 8px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:FONT}}>✕</button>
            </div>
          :<button onClick={()=>setNaming(true)} style={{background:"transparent",border:`1px dashed ${C.border}`,borderRadius:5,padding:"4px 12px",color:C.textDim,fontSize:11,cursor:"pointer",fontFamily:FONT}}>+ new</button>
        }
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function ScenariosTab({ scenarios, groups, onScenariosChange, onGroupsChange, data }) {
  const [activeId, setActiveId] = useState(scenarios[0].id);
  const [view,     setView]     = useState("edit");
  const active = scenarios.find(s=>s.id===activeId)||scenarios[0];

  return (
    <div style={{display:"flex",flexDirection:"column"}}>
      <ScenarioTabBar
        scenarios={scenarios} activeId={activeId} setActiveId={setActiveId}
        view={view} setView={setView} onScenariosChange={onScenariosChange}/>
      {view==="edit"&&(
        <ScenarioEditor scenario={active} data={data} groups={groups} onGroupsChange={onGroupsChange}
          onChange={u=>onScenariosChange(scenarios.map(s=>s.id===u.id?u:s))}/>
      )}
      {view==="compare"&&<CompareView scenarios={scenarios} data={data} groups={groups}/>}
      {view==="projection"&&<ScenarioProjection scenario={active} data={data}/>}
    </div>
  );
}

// ── Scenario projection ───────────────────────────────────────────────────────
// Shows a day-by-day balance walkthrough based on scenario rows.
// Fixed rows: user picks which day of month they typically fall.
// Live/last rows: average day-of-month pulled from historical transactions.
// Income: average day it has historically arrived.
function ScenarioProjection({ scenario, data }) {
  const incomeAmt = resolveIncome(scenario.income, data);
  const complete  = completeMonths(data.months);

  // Build typical day-of-month for each category from last 3 complete months
  const catDayAvg = {};
  complete.slice(-3).forEach(m => {
    (m.transactions||[]).forEach(tx => {
      if (!tx.category) return;
      const day = parseInt(tx.date?.split("-")[2]||"0"); if (!day) return;
      if (!catDayAvg[tx.category]) catDayAvg[tx.category] = [];
      catDayAvg[tx.category].push(day);
    });
  });
  const avgDay = cats => {
    const days = (cats||[]).flatMap(c=>catDayAvg[c]||[]);
    return days.length ? Math.round(days.reduce((a,b)=>a+b,0)/days.length) : null;
  };
  // Typical income day
  const incomeDays = complete.slice(-3).flatMap(m=>
    (m.transactions||[]).filter(t=>t.isIncome||t.amount>0).map(t=>parseInt(t.date?.split("-")[2]||"0")).filter(Boolean)
  );
  const typicalIncomeDay = incomeDays.length ? Math.round(incomeDays.reduce((a,b)=>a+b,0)/incomeDays.length) : 1;

  // State: day overrides for fixed rows (day-of-month picker)
  const [dayOverrides, setDayOverrides] = useState({});
  const [startBal, setStartBal] = useState(
    // Default to last known end balance
    (data.months[data.months.length-1]?.endBalance ?? 0)
  );
  const [startDraft, setStartDraft] = useState(fmtR(data.months[data.months.length-1]?.endBalance??0));

  // Build events: one per enabled row
  const events = [];

  // Income event
  events.push({
    day: typicalIncomeDay,
    label: "Income",
    amount: incomeAmt,
    type: "income",
    color: C.teal,
  });

  scenario.rows.filter(r=>r.enabled).forEach(row => {
    const amt = resolveRow(row, incomeAmt, data);
    if (amt <= 0) return;
    let day;
    if (row.type === "fixed" || row.type === "percent") {
      day = dayOverrides[row.id] ?? 1;
    } else if (row.type === "last") {
      // Use the actual day from last complete month
      const lastM = complete[complete.length-1];
      const lastTx = (lastM?.transactions||[]).filter(t=>(row.liveCategories||[]).includes(t.category)&&t.amount<0);
      const lastDay = lastTx.length ? Math.max(...lastTx.map(t=>parseInt(t.date?.split("-")[2]||"0"))) : null;
      day = lastDay ?? avgDay(row.liveCategories) ?? 1;
    } else {
      // live — use average day
      day = avgDay(row.liveCategories) ?? 1;
    }
    const group = data.categoryGroups ? null : null; // for color
    events.push({
      day,
      label: row.name,
      amount: -amt,
      type: "expense",
      color: C.red,
      rowId: row.id,
      rowType: row.type,
      liveCategories: row.liveCategories,
    });
  });

  // Sort events by day
  events.sort((a,b) => a.day - b.day);

  // Walk through days 1-31
  const days = [];
  let bal = startBal;
  for (let d=1; d<=31; d++) {
    const dayEvents = events.filter(e=>e.day===d);
    const prev = bal;
    dayEvents.forEach(e => bal += e.amount);
    if (dayEvents.length > 0) {
      days.push({ day:d, events:dayEvents, balBefore:prev, balAfter:bal });
    }
  }

  const minBal = Math.min(startBal, ...days.map(d=>d.balAfter));
  const maxBal = Math.max(startBal, ...days.map(d=>d.balAfter));
  const balRange = maxBal - minBal || 1;

  return (
    <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:22}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:12}}>
        <div>
          <div style={{color:C.amber,fontSize:10,letterSpacing:2,marginBottom:4}}>MONTHLY PROJECTION</div>
          <div style={{color:C.textDim,fontSize:12}}>Step through expected balance changes across a typical month</div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{color:C.textDim,fontSize:11}}>Starting balance:</span>
          <input type="number" value={startDraft}
            onChange={e=>setStartDraft(e.target.value)}
            onBlur={e=>setStartBal(pc(e.target.value))}
            style={{width:110,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"6px 10px",color:C.amber,fontSize:12,fontFamily:FONT,outline:"none"}}/>
          <span style={{color:C.amber,fontSize:12,fontWeight:700}}>{fmt(startBal)}</span>
        </div>
      </div>

      {/* Day picker for fixed rows */}
      {scenario.rows.filter(r=>r.enabled&&(r.type==="fixed"||r.type==="percent")).length>0&&(
        <div style={{marginBottom:16,padding:"12px 14px",background:C.elevated,borderRadius:8,border:`1px solid ${C.border}`}}>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:10}}>SET DAY OF MONTH FOR FIXED ITEMS</div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
            {scenario.rows.filter(r=>r.enabled&&(r.type==="fixed"||r.type==="percent")).map(row=>(
              <div key={row.id} style={{display:"flex",alignItems:"center",gap:8,background:C.bg,borderRadius:6,padding:"6px 10px",border:`1px solid ${C.border}`}}>
                <span style={{color:C.text,fontSize:11}}>{row.name}</span>
                <span style={{color:C.textDim,fontSize:10}}>day</span>
                <input type="number" min={1} max={31} value={dayOverrides[row.id]??1}
                  onChange={e=>setDayOverrides(d=>({...d,[row.id]:Math.max(1,Math.min(31,parseInt(e.target.value)||1))}))}
                  style={{width:48,background:C.elevated,border:`1px solid ${C.border}`,borderRadius:4,padding:"3px 6px",color:C.amber,fontSize:11,fontFamily:FONT,outline:"none",textAlign:"center"}}/>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Balance walk */}
      <div style={{display:"flex",flexDirection:"column",gap:0}}>
        {/* Starting balance row */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${C.border}44`}}>
          <div style={{width:32,color:C.textDim,fontSize:10,textAlign:"right",flexShrink:0}}>—</div>
          <div style={{flex:1,color:C.textDim,fontSize:11,fontStyle:"italic"}}>Starting balance</div>
          <div style={{color:C.text,fontSize:13,fontWeight:700,minWidth:90,textAlign:"right"}}>{fmt(startBal)}</div>
        </div>

        {days.map(({day,events:evs,balBefore,balAfter},i)=>(
          <div key={day} style={{borderBottom:`1px solid ${C.border}44`}}>
            {evs.map((ev,ei)=>{
              const isLast = ei===evs.length-1;
              const runBal = evs.slice(0,ei+1).reduce((b,e)=>b+e.amount,balBefore);
              return (
                <div key={ei} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",
                  background:ei===0&&i%2===0?`${C.elevated}66`:"transparent"}}>
                  <div style={{width:32,color:C.textDim,fontSize:10,textAlign:"right",flexShrink:0}}>
                    {ei===0?`${day}`:""}</div>
                  <div style={{flex:1}}>
                    <div style={{color:ev.type==="income"?C.teal:C.text,fontSize:12}}>{ev.label}</div>
                    {ev.type!=="income"&&ev.liveCategories?.length>0&&(
                      <div style={{color:C.muted,fontSize:9,marginTop:1}}>{ev.liveCategories.join(", ")}</div>
                    )}
                    {(ev.rowType==="live"||ev.rowType==="last")&&(
                      <div style={{color:C.muted,fontSize:9}}>
                        {ev.rowType==="live"?"avg day":"last occurrence"}: day {ev.day}
                      </div>
                    )}
                  </div>
                  <div style={{color:ev.amount>=0?C.teal:C.red,fontSize:12,fontWeight:700,minWidth:72,textAlign:"right"}}>
                    {ev.amount>=0?"+":""}{fmt(ev.amount)}
                  </div>
                  {isLast&&(
                    <div style={{minWidth:90,textAlign:"right"}}>
                      <div style={{color:runBal>=startBal?C.teal:runBal<0?C.red:C.text,fontSize:13,fontWeight:700}}>{fmt(runBal)}</div>
                      {/* Mini progress bar */}
                      <div style={{height:2,background:C.border,borderRadius:1,marginTop:3,width:90}}>
                        <div style={{
                          height:"100%",borderRadius:1,
                          background:runBal<0?C.red:runBal>=startBal?C.teal:C.amber,
                          width:`${Math.max(0,Math.min(100,((runBal-minBal)/balRange)*100))}%`,
                          transition:"width 0.3s",
                        }}/>
                      </div>
                    </div>
                  )}
                  {!isLast&&<div style={{minWidth:90}}/>}
                </div>
              );
            })}
          </div>
        ))}

        {/* Final balance */}
        <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 0",marginTop:4}}>
          <div style={{width:32,flexShrink:0}}/>
          <div style={{flex:1,color:C.textDim,fontSize:11,fontWeight:700}}>End of month</div>
          <div style={{color:C.textDim,fontSize:11,minWidth:72,textAlign:"right"}}>
            {bal>=startBal?"+":""}{fmt(bal-startBal)}
          </div>
          <div style={{minWidth:90,textAlign:"right"}}>
            <div style={{color:bal>=startBal?C.teal:bal<0?C.red:C.amber,fontSize:16,fontWeight:700}}>{fmt(bal)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
