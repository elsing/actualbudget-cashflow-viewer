import { useState, useEffect } from "react";
import { C, FONT, ACCT_TYPES, TYPE_COLOR, SK } from "../../constants.js";
import { sGet, sSet } from "../../helpers.js";

export default function ConnectionPanel({ onConnect }) {
  const saved = JSON.parse(localStorage.getItem("cf-connection")||"{}");
  const [apiUrl,   setApiUrl]   = useState(saved.apiUrl||"http://localhost:5007");
  const [apiKey,   setApiKey]   = useState(saved.apiKey||"");
  const [budgets,  setBudgets]  = useState([]);
  const [budgetId, setBudgetId] = useState(saved.budgetId||"");
  const [accounts, setAccounts] = useState([]);
  const [selAccIds,setSelAccIds]= useState(null);
  const [typeOverrides, setTypeOverrides] = useState(saved.typeOverrides||{});
  const [step, setStep] = useState("creds");
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState("");

  // On mount: load typeOverrides from DB (synced across devices)
  useEffect(() => {
    sGet(SK.conn).then(conn => {
      if (conn?.typeOverrides && Object.keys(conn.typeOverrides).length > 0) {
        setTypeOverrides(conn.typeOverrides);
        // Also update localStorage so next visit has them
        const cur = JSON.parse(localStorage.getItem("cf-connection")||"{}");
        localStorage.setItem("cf-connection", JSON.stringify({...cur, typeOverrides:conn.typeOverrides}));
      }
    });
  }, []);

  const f = {
    width:"100%", boxSizing:"border-box",
    background:C.bg, border:`1px solid ${C.border}`,
    borderRadius:7, padding:"10px 14px",
    color:C.text, fontSize:13, fontFamily:FONT, outline:"none",
  };

  const saveTypeOverrides = (ovs) => {
    setTypeOverrides(ovs);
    // Write to localStorage immediately
    const cur = JSON.parse(localStorage.getItem("cf-connection")||"{}");
    localStorage.setItem("cf-connection", JSON.stringify({...cur, typeOverrides:ovs}));
    // Write to DB (async, fire and forget)
    sSet(SK.conn, { typeOverrides: ovs });
  };

  const fetchBudgets = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${apiUrl}/v1/budgets`,{headers:{"x-api-key":apiKey}});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      const all = d.data??d??[];
      const seen = new Set();
      const unique = all.filter(b => { if(seen.has(b.name))return false; seen.add(b.name); return true; });
      setBudgets(unique);
      setStep("budget");
    } catch(e) { setErr(`Could not connect: ${e.message}`); }
    setBusy(false);
  };

  const fetchAccounts = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${apiUrl}/v1/budgets/${budgetId}/accounts`,{headers:{"x-api-key":apiKey}});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const all = j.data??j??[];
      const seen = new Set();
      const unique = all.filter(a=>{if(!a.id||seen.has(a.id))return false;seen.add(a.id);return true;});
      setAccounts(unique);
      const savedIds = saved.budgetId===budgetId ? saved.accountIds : null;
      setSelAccIds(savedIds || unique.filter(a=>!a.offbudget&&!a.closed).map(a=>a.id));
      setStep("accounts");
    } catch(e) { setErr(`Could not fetch accounts: ${e.message}`); }
    setBusy(false);
  };

  const toggleAcc = id => setSelAccIds(p => p?.includes(id)?p.filter(x=>x!==id):[...(p||[]),id]);

  const connect = () => {
    const cfg = {apiUrl, apiKey, budgetId, accountIds:selAccIds||[], typeOverrides};
    localStorage.setItem("cf-connection", JSON.stringify(cfg));
    onConnect(cfg);
  };

  const onBudget  = accounts.filter(a=>!a.offbudget&&!a.closed);
  const offBudget = accounts.filter(a=> a.offbudget&&!a.closed);
  const closed    = accounts.filter(a=>a.closed);
  const selCount  = selAccIds?.length??0;

  const AccRow = ({acct}) => {
    const sel = (selAccIds||[]).includes(acct.id);
    const eff = typeOverrides[acct.id] || acct.type || "other";
    const col = TYPE_COLOR[eff] || C.textDim;
    return (
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
        background:sel?`${C.teal}11`:C.elevated,
        border:`1px solid ${sel?C.teal:C.border}`,
        borderRadius:7,marginBottom:5}}>
        <div onClick={()=>toggleAcc(acct.id)} style={{width:16,height:16,borderRadius:4,border:`2px solid ${sel?C.teal:C.muted}`,background:sel?C.teal:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          {sel&&<span style={{color:"#060e1a",fontSize:10,fontWeight:700}}>✓</span>}
        </div>
        <div onClick={()=>toggleAcc(acct.id)} style={{flex:1,cursor:"pointer"}}>
          <div style={{color:C.text,fontSize:13}}>{acct.name}</div>
          {acct.type&&acct.type!==eff&&<div style={{color:C.muted,fontSize:9}}>Actual: {acct.type}</div>}
        </div>
        <select value={eff}
          onChange={e=>{e.stopPropagation();saveTypeOverrides({...typeOverrides,[acct.id]:e.target.value});}}
          style={{background:`${col}22`,border:`1px solid ${col}55`,borderRadius:4,padding:"3px 7px",fontSize:10,color:col,fontFamily:FONT,cursor:"pointer",outline:"none"}}>
          {ACCT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    );
  };

  const AccGroup = ({label,items,color}) => items.length===0?null:(
    <div style={{marginBottom:12}}>
      <div style={{color:color||C.textDim,fontSize:9,letterSpacing:2,marginBottom:8}}>{label}</div>
      {items.map(a=><AccRow key={a.id} acct={a}/>)}
    </div>
  );

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT,padding:20}}>
      <div style={{width:520,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:36}}>
        <div style={{color:C.amber,fontSize:11,letterSpacing:3,marginBottom:6}}>◈ ACTUAL BUDGET</div>
        <div style={{color:C.text,fontSize:22,fontWeight:700,marginBottom:4}}>Cash Flow Dashboard</div>
        <div style={{display:"flex",gap:16,marginBottom:24,marginTop:8}}>
          {[{id:"creds",l:"1. Connect"},{id:"budget",l:"2. Budget"},{id:"accounts",l:"3. Accounts"}].map(s=>(
            <div key={s.id} style={{fontSize:10,color:step===s.id?C.amber:C.muted,fontFamily:FONT,letterSpacing:1,borderBottom:step===s.id?`1px solid ${C.amber}`:"none",paddingBottom:2}}>{s.l}</div>
          ))}
        </div>

        {step==="creds"&&<>
          <div style={{marginBottom:14}}>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:5}}>API URL</div>
            <input value={apiUrl} onChange={e=>setApiUrl(e.target.value)} placeholder="http://localhost:5007" style={f}/>
          </div>
          <div style={{marginBottom:18}}>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:5}}>API KEY</div>
            <input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} onKeyDown={e=>e.key==="Enter"&&fetchBudgets()} placeholder="your-api-key" style={f}/>
          </div>
          {err&&<div style={{color:C.red,fontSize:11,marginBottom:14,padding:"9px 12px",background:"#1a0a0a",borderRadius:6}}>{err}</div>}
          <button onClick={fetchBudgets} disabled={!apiUrl||!apiKey||busy}
            style={{width:"100%",background:C.amber,color:"#060e1a",border:"none",borderRadius:7,padding:"12px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT,marginBottom:10}}>
            {busy?"CONNECTING…":"CONNECT →"}
          </button>
          <button onClick={()=>onConnect({demo:true})}
            style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"10px 0",color:C.textDim,fontSize:12,cursor:"pointer",fontFamily:FONT}}>
            USE DEMO DATA
          </button>
        </>}

        {step==="budget"&&<>
          <div style={{color:C.textDim,fontSize:11,marginBottom:16}}>Select your budget:</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {budgets.map(b=>{
              const id=b.groupId||b.cloudFileId||b.id;
              const sel=budgetId===id;
              return (
                <div key={id} onClick={()=>setBudgetId(id)} style={{padding:"12px 16px",background:sel?`${C.teal}15`:C.elevated,border:`1px solid ${sel?C.teal:C.border}`,borderRadius:8,cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${sel?C.teal:C.muted}`,background:sel?C.teal:"transparent",flexShrink:0}}/>
                  <div style={{color:C.text,fontSize:13}}>{b.name}</div>
                </div>
              );
            })}
          </div>
          {err&&<div style={{color:C.red,fontSize:11,marginBottom:14,padding:"9px 12px",background:"#1a0a0a",borderRadius:6}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep("creds")} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"11px 0",fontSize:12,color:C.textDim,cursor:"pointer",fontFamily:FONT}}>← back</button>
            <button onClick={fetchAccounts} disabled={!budgetId||busy} style={{flex:2,background:C.amber,color:"#060e1a",border:"none",borderRadius:7,padding:"11px 0",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>
              {busy?"LOADING…":"SELECT ACCOUNTS →"}
            </button>
          </div>
        </>}

        {step==="accounts"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{color:C.textDim,fontSize:11}}>{selCount} account{selCount!==1?"s":""} selected</div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={()=>setSelAccIds(onBudget.map(a=>a.id))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>on-budget</button>
              <button onClick={()=>setSelAccIds(accounts.filter(a=>!a.closed).map(a=>a.id))} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>all open</button>
              <button onClick={()=>setSelAccIds([])} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:5,padding:"3px 10px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>none</button>
            </div>
          </div>
          <div style={{color:C.textDim,fontSize:9,letterSpacing:1,marginBottom:10}}>Types are saved and synced. Double-check credit cards are marked red.</div>
          <div style={{maxHeight:360,overflowY:"auto",marginBottom:16}}>
            <AccGroup label="ON BUDGET"  items={onBudget}  color={C.teal}/>
            <AccGroup label="OFF BUDGET" items={offBudget} color={C.textDim}/>
            <AccGroup label="CLOSED"     items={closed}    color={C.muted}/>
          </div>
          {selCount===0&&<div style={{color:C.amber,fontSize:11,marginBottom:12}}>Select at least one account.</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep("budget")} style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,padding:"11px 0",fontSize:12,color:C.textDim,cursor:"pointer",fontFamily:FONT}}>← back</button>
            <button onClick={connect} disabled={selCount===0} style={{flex:2,background:selCount>0?C.amber:"transparent",color:selCount>0?"#060e1a":C.muted,border:`1px solid ${selCount>0?C.amber:C.border}`,borderRadius:7,padding:"11px 0",fontSize:13,fontWeight:700,cursor:selCount>0?"pointer":"default",fontFamily:FONT}}>
              OPEN DASHBOARD →
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}
