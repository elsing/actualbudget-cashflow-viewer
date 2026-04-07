"use client";
import { useState, useEffect } from "react";
import { C, FONT, ACCT_TYPES, TYPE_COLOR, SK } from "@/lib/constants";
import { sGet, sSet } from "@/lib/helpers";

interface Props { onConnect: (cfg: any) => void; }

export default function ConnectionPanel({ onConnect }: Props) {
  const [saved, setSaved] = useState<Record<string,any>>({});
  const [password,      setPassword]      = useState<string>("");
  const [budgets,       setBudgets]       = useState<any[]>([]);
  const [budgetId,      setBudgetId]      = useState<string>("");
  const [accounts,      setAccounts]      = useState<any[]>([]);
  const [selAccIds,     setSelAccIds]     = useState<string[]|null>(null);
  const [typeOverrides, setTypeOverrides] = useState<Record<string,string>>({});
  const [step,  setStep]  = useState<"password"|"budget"|"accounts">("password");
  const [busy,  setBusy]  = useState(false);
  const [err,   setErr]   = useState("");

  // Load saved config and type overrides on mount (client-only)
  useEffect(() => {
    // Restore password from sessionStorage (survives reload, cleared on tab close)
    const savedPw = sessionStorage.getItem("cf-pw") ?? "";
    if (savedPw) setPassword(savedPw);

    let s: Record<string,any> = {};
    try {
      s = JSON.parse(localStorage.getItem("cf-connection")||"{}");
      setSaved(s);
      if (s.budgetId)       setBudgetId(s.budgetId);
      if (s.typeOverrides)  setTypeOverrides(s.typeOverrides);
    } catch {}

    // Load type overrides from DB (synced across devices)
    sGet(SK.conn).then((conn: any) => {
      if (conn?.typeOverrides && Object.keys(conn.typeOverrides).length > 0) {
        setTypeOverrides(conn.typeOverrides);
        try {
          const cur = JSON.parse(localStorage.getItem("cf-connection")||"{}");
          localStorage.setItem("cf-connection", JSON.stringify({...cur, typeOverrides:conn.typeOverrides}));
        } catch {}
      }
    });

    // If we have a saved connection, try fetching budgets without a password.
    // If it succeeds (no CF_DASHBOARD_PASSWORD set), skip straight to budget/accounts.
    // If it 401s, stay on the password step.
    if (s.budgetId) {
      const probePw = sessionStorage.getItem("cf-pw") ?? "";
      const probeHeaders: Record<string, string> = {};
      if (probePw) probeHeaders["x-dashboard-password"] = probePw;
      fetch("/api/actual/v1/budgets", { headers: probeHeaders }).then(async r => {
        if (r.ok) {
          // Fetch accounts with the same password header
          fetch(`/api/actual/v1/budgets/${s.budgetId}/accounts`, { headers: probeHeaders }).then(async ar => {
            if (!ar.ok) return;
            const aj = await ar.json();
            const all2 = aj.data??aj??[];
            const seen2 = new Set<string>();
            const unique2 = all2.filter((a:any)=>{ if(!a.id||seen2.has(a.id))return false; seen2.add(a.id); return true; });
            setAccounts(unique2);
            const restoredIds = s.accountIds?.length ? s.accountIds : unique2.filter((a:any)=>!a.offbudget&&!a.closed).map((a:any)=>a.id);
            setSelAccIds(restoredIds);
            // Auto-connect — everything is restored, no need for user interaction
            onConnect({
              budgetId: s.budgetId,
              accountIds: restoredIds,
              typeOverrides: s.typeOverrides || {},
              password: probePw || undefined,
            });
          });
        }
        // If 401 or error, stay on password step — user needs to authenticate
      }).catch(() => {});
    }
  }, []);

  const saveTypeOverrides = (ovs: Record<string,string>) => {
    setTypeOverrides(ovs);
    try {
      const cur = JSON.parse(localStorage.getItem("cf-connection")||"{}");
      localStorage.setItem("cf-connection", JSON.stringify({...cur, typeOverrides:ovs}));
    } catch {}
    sSet(SK.conn, { typeOverrides: ovs });
  };

  // Step 1: check password, then fetch budgets
  const checkPassword = async () => {
    setBusy(true); setErr("");
    try {
      // Verify password against the server, then fetch budgets in same call
      const r = await fetch("/api/actual/v1/budgets", {
        headers: { "x-dashboard-password": password },
      });
      if (r.status === 401) throw new Error("Incorrect password.");
      if (!r.ok) throw new Error(`Could not connect (HTTP ${r.status}). Check server is running.`);
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const all = d.data??d??[];
      const seen = new Set<string>();
      const unique = all.filter((b:any) => { if(seen.has(b.name))return false; seen.add(b.name); return true; });
      setBudgets(unique);
      // Save password in session for subsequent API calls
      sessionStorage.setItem("cf-pw", password);
      setStep("budget");
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const fetchAccounts = async () => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`/api/actual/v1/budgets/${budgetId}/accounts`, {
        headers: password ? { "x-dashboard-password": password } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      const all = j.data??j??[];
      const seen = new Set<string>();
      const unique = all.filter((a:any)=>{ if(!a.id||seen.has(a.id))return false; seen.add(a.id); return true; });
      setAccounts(unique);
      // Restore saved account selection for this budget
      const savedIds = saved.budgetId===budgetId ? saved.accountIds : null;
      setSelAccIds(savedIds || unique.filter((a:any)=>!a.offbudget&&!a.closed).map((a:any)=>a.id));
      setStep("accounts");
    } catch(e:any) { setErr(e.message); }
    setBusy(false);
  };

  const toggleAcc = (id: string) =>
    setSelAccIds(p => p?.includes(id) ? p.filter(x=>x!==id) : [...(p||[]), id]);

  const connect = () => {
    const cfg = { budgetId, accountIds: selAccIds||[], typeOverrides, password };
    try { localStorage.setItem("cf-connection", JSON.stringify({ budgetId, accountIds: selAccIds||[], typeOverrides })); } catch {}
    onConnect(cfg);
  };

  const onBudget  = accounts.filter(a=>!a.offbudget&&!a.closed);
  const offBudget = accounts.filter(a=> a.offbudget&&!a.closed);
  const closed    = accounts.filter(a=>a.closed);
  const selCount  = selAccIds?.length??0;

  const AccRow = ({ acct }: { acct: any }) => {
    const sel = (selAccIds||[]).includes(acct.id);
    const eff = typeOverrides[acct.id] || acct.type || "other";
    const col = TYPE_COLOR[eff] || C.textDim;
    return (
      <div style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",
        background:sel?`${C.teal}11`:C.elevated, border:`1px solid ${sel?C.teal:C.border}`,
        borderRadius:7, marginBottom:5}}>
        <div onClick={()=>toggleAcc(acct.id)} style={{width:16,height:16,borderRadius:4,
          border:`2px solid ${sel?C.teal:C.muted}`,background:sel?C.teal:"transparent",
          flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
          {sel&&<span style={{color:"#060e1a",fontSize:10,fontWeight:700}}>✓</span>}
        </div>
        <div onClick={()=>toggleAcc(acct.id)} style={{flex:1,cursor:"pointer"}}>
          <div style={{color:C.text,fontSize:13}}>{acct.name}</div>
          {acct.type&&acct.type!==eff&&<div style={{color:C.muted,fontSize:9}}>Actual: {acct.type}</div>}
        </div>
        <select value={eff}
          onChange={e=>{ e.stopPropagation(); saveTypeOverrides({...typeOverrides,[acct.id]:e.target.value}); }}
          style={{background:`${col}22`,border:`1px solid ${col}55`,borderRadius:4,
            padding:"3px 7px",fontSize:10,color:col,fontFamily:FONT,cursor:"pointer",outline:"none"}}>
          {ACCT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>
    );
  };

  const AccGroup = ({ label, items, color }: { label:string; items:any[]; color:string }) =>
    items.length===0 ? null : (
      <div style={{marginBottom:12}}>
        <div style={{color:color,fontSize:9,letterSpacing:2,marginBottom:8}}>{label}</div>
        {items.map(a=><AccRow key={a.id} acct={a}/>)}
      </div>
    );

  const steps = [
    {id:"password", l:"1. Sign in"},
    {id:"budget",   l:"2. Budget"},
    {id:"accounts", l:"3. Accounts"},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:FONT,padding:20}}>
      <div style={{width:520,background:C.surface,border:`1px solid ${C.border}`,borderRadius:14,padding:36}}>
        <div style={{color:C.amber,fontSize:11,letterSpacing:3,marginBottom:6}}>◈ ACTUAL BUDGET</div>
        <div style={{color:C.text,fontSize:22,fontWeight:700,marginBottom:4}}>Cash Flow Dashboard</div>

        {/* Step indicator */}
        <div style={{display:"flex",gap:16,marginBottom:24,marginTop:8}}>
          {steps.map(s=>(
            <div key={s.id} style={{fontSize:10,color:step===s.id?C.amber:C.muted,fontFamily:FONT,
              letterSpacing:1,borderBottom:step===s.id?`1px solid ${C.amber}`:"none",paddingBottom:2}}>
              {s.l}
            </div>
          ))}
        </div>

        {/* Step 1 — password */}
        {step==="password"&&<>
          {/* Wrap in a form so password managers detect it correctly */}
          <form onSubmit={e=>{e.preventDefault();if(password)checkPassword();}} style={{marginBottom:18}}>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:6}}>PASSWORD</div>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Enter dashboard password"
              autoFocus
              style={{width:"100%",boxSizing:"border-box",background:C.bg,
                border:`1px solid ${C.border}`,borderRadius:7,padding:"11px 14px",
                color:C.text,fontSize:13,fontFamily:FONT,outline:"none"}}
            />
          </form>
          {err&&<div style={{color:C.red,fontSize:11,marginBottom:14,padding:"10px 14px",
            background:`${C.red}11`,borderRadius:6}}>{err}</div>}
          <button onClick={checkPassword} disabled={!password||busy}
            style={{width:"100%",background:password?C.amber:"transparent",
              color:password?"#060e1a":C.muted,
              border:`1px solid ${password?C.amber:C.border}`,
              borderRadius:7,padding:"13px 0",fontSize:13,fontWeight:700,
              cursor:password&&!busy?"pointer":"default",fontFamily:FONT,marginBottom:10,
              opacity:busy?0.7:1}}>
            {busy?"CONNECTING…":"SIGN IN →"}
          </button>
          <button onClick={()=>onConnect({demo:true})}
            style={{width:"100%",background:"transparent",border:`1px solid ${C.border}`,
              borderRadius:7,padding:"10px 0",color:C.textDim,fontSize:12,cursor:"pointer",fontFamily:FONT}}>
            USE DEMO DATA
          </button>
        </>}

        {/* Step 2 — budget */}
        {step==="budget"&&<>
          <div style={{color:C.textDim,fontSize:11,marginBottom:16}}>Select your budget:</div>
          <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:20}}>
            {budgets.map(b=>{
              const id = b.groupId||b.cloudFileId||b.id;
              const sel = budgetId===id;
              return (
                <div key={id} onClick={()=>setBudgetId(id)}
                  style={{padding:"12px 16px",background:sel?`${C.teal}15`:C.elevated,
                    border:`1px solid ${sel?C.teal:C.border}`,borderRadius:8,
                    cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <div style={{width:16,height:16,borderRadius:4,
                    border:`2px solid ${sel?C.teal:C.muted}`,
                    background:sel?C.teal:"transparent",flexShrink:0}}/>
                  <div style={{color:C.text,fontSize:13}}>{b.name}</div>
                </div>
              );
            })}
          </div>
          {err&&<div style={{color:C.red,fontSize:11,marginBottom:14,padding:"9px 12px",
            background:`${C.red}11`,borderRadius:6}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep("password")}
              style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,
                padding:"11px 0",fontSize:12,color:C.textDim,cursor:"pointer",fontFamily:FONT}}>← back</button>
            <button onClick={fetchAccounts} disabled={!budgetId||busy}
              style={{flex:2,background:budgetId?C.amber:"transparent",
                color:budgetId?"#060e1a":C.muted,
                border:`1px solid ${budgetId?C.amber:C.border}`,
                borderRadius:7,padding:"11px 0",fontSize:13,fontWeight:700,
                cursor:budgetId&&!busy?"pointer":"default",fontFamily:FONT}}>
              {busy?"LOADING…":"SELECT ACCOUNTS →"}
            </button>
          </div>
        </>}

        {/* Step 3 — accounts */}
        {step==="accounts"&&<>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <div style={{color:C.textDim,fontSize:11}}>{selCount} account{selCount!==1?"s":""} selected</div>
            <div style={{display:"flex",gap:6}}>
              {["on-budget","all open","none"].map(l=>(
                <button key={l} onClick={()=>setSelAccIds(
                  l==="on-budget" ? onBudget.map(a=>a.id) :
                  l==="all open"  ? accounts.filter(a=>!a.closed).map(a=>a.id) : []
                )} style={{background:"transparent",border:`1px solid ${C.border}`,
                  borderRadius:5,padding:"3px 10px",color:C.textDim,fontSize:10,
                  cursor:"pointer",fontFamily:FONT}}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{color:C.muted,fontSize:9,marginBottom:10,letterSpacing:0.5}}>
            Set account types — red = credit/debt, teal = checking/savings. Types sync across devices.
          </div>
          <div style={{maxHeight:360,overflowY:"auto",marginBottom:16}}>
            <AccGroup label="ON BUDGET"  items={onBudget}  color={C.teal}/>
            <AccGroup label="OFF BUDGET" items={offBudget} color={C.textDim}/>
            <AccGroup label="CLOSED"     items={closed}    color={C.muted}/>
          </div>
          {selCount===0&&<div style={{color:C.amber,fontSize:11,marginBottom:12}}>
            Select at least one account.
          </div>}
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStep("budget")}
              style={{flex:1,background:"transparent",border:`1px solid ${C.border}`,borderRadius:7,
                padding:"11px 0",fontSize:12,color:C.textDim,cursor:"pointer",fontFamily:FONT}}>← back</button>
            <button onClick={connect} disabled={selCount===0}
              style={{flex:2,background:selCount>0?C.amber:"transparent",
                color:selCount>0?"#060e1a":C.muted,
                border:`1px solid ${selCount>0?C.amber:C.border}`,
                borderRadius:7,padding:"11px 0",fontSize:13,fontWeight:700,
                cursor:selCount>0?"pointer":"default",fontFamily:FONT}}>
              OPEN DASHBOARD →
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}
