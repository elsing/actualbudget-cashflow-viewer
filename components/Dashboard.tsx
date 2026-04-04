"use client";
import { useState, useEffect } from "react";
import { C, FONT, SK } from "@/lib/constants";
import { sSet, sGet, resetStateCache } from "@/lib/helpers";
import { useLoadData } from "@/hooks/useLoadData";
import ConnectionPanel from "./connect/ConnectionPanel";
import MonthlyFlowTab  from "./tabs/MonthlyFlowTab";
import ScenariosTab    from "./tabs/ScenariosTab";
import { OverviewTab, CategoriesTab } from "./tabs/OverviewTab";
import CalibrationTab  from "./tabs/CalibrationTab";
import AITab           from "./tabs/AITab";
import type { UiState, AppState } from "@/types";

const DEFAULT_UI: UiState = {
  tab:               "flow",
  overviewRange:     6,
  overviewCats:      null,
  overviewIncomeCats:null,
  overviewVis:       { income:true, expenses:true, net:true },
  catsRange:         6,
  catsVis:           null,
  catsShowGroups:    true,
  aiRange:           12,
  aiCats:            null,
  aiMode:            "analyse",
  flowSelMonth:      null,
  flowSelAccounts:   null,
  flowBalRange:      6,
  flowShowProj:      true,
  scenActiveId:      null,
  scenView:          "edit",
  projScenId:        null,
  projStartBal:      null,
  projIncomeDay:     null,
  projDayOverrides:  {},
};

interface Config {
  demo?: boolean;
  budgetId?: string;
  accountIds?: string[];
  typeOverrides?: Record<string,string>;
}

// ── Loading screen ────────────────────────────────────────────────────────────
function LoadingScreen({ loadLog, demo }: { loadLog:{text:string;status:string;detail?:string}[]; demo?:boolean }) {
  const icon: Record<string,string> = {ok:"✓",error:"✗",warn:"⚠",pending:"…"};
  const col:  Record<string,string> = {ok:C.teal,error:C.red,warn:C.amber,pending:C.textDim};
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",
      alignItems:"center",justifyContent:"center",fontFamily:FONT,padding:40}}>
      <div style={{width:"100%",maxWidth:540}}>
        <div style={{color:C.amber,fontSize:13,fontWeight:700,letterSpacing:3,marginBottom:4}}>◈ ACTUAL</div>
        <div style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:24}}>
          {demo?"Loading demo…":"Connecting…"}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {loadLog.map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 14px",
              background:C.surface,borderRadius:8,
              border:`1px solid ${e.status==="error"?C.red:e.status==="warn"?C.amber:C.border}`}}>
              <span style={{color:col[e.status]??C.textDim,fontSize:12,minWidth:14}}>{icon[e.status]??""}</span>
              <div style={{flex:1}}>
                <div style={{color:e.status==="error"?C.red:e.status==="warn"?C.amber:C.text,fontSize:12}}>{e.text}</div>
                {e.detail&&<div style={{color:C.textDim,fontSize:10,marginTop:3}}>{e.detail}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Inner dashboard ───────────────────────────────────────────────────────────
function DashboardInner({ config, onDisconnect }: { config:Config; onDisconnect:()=>void }) {
  const { loadLog, appState, setAppState, fatal } = useLoadData(config);
  const [serverOk,  setServerOk]  = useState<boolean|null>(null);
  const [uiState,   setUiStateRaw] = useState<UiState>(DEFAULT_UI);
  const [uiLoaded,  setUiLoaded]  = useState(false);

  const setUi = (patch: Partial<UiState>) => setUiStateRaw(s => {
    const next = {...s, ...patch};
    sSet(SK.ui, next);
    return next;
  });

  useEffect(() => {
    fetch("/api/health", { signal: AbortSignal.timeout(2000) })
      .then(r => setServerOk(r.ok)).catch(() => setServerOk(false));

    sGet(SK.ui).then(saved => {
      if (saved && typeof saved === "object")
        setUiStateRaw(s => ({...DEFAULT_UI, ...s, ...(saved as Partial<UiState>)}));
      setUiLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!appState) return;
    const t = setTimeout(() => {
      sSet(SK.sc,   { scenarios: appState.scenarios, groups: appState.groups });
      sSet(SK.flow, { markers: appState.markers });
    }, 800);
    return () => clearTimeout(t);
  }, [appState?.scenarios, appState?.groups, appState?.markers]);

  if (fatal) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:FONT,padding:40}}>
      <div style={{maxWidth:480,background:C.surface,border:`1px solid ${C.red}`,borderRadius:12,padding:32}}>
        <div style={{color:C.red,fontSize:12,fontWeight:700,marginBottom:10}}>Failed to load</div>
        <div style={{color:C.text,fontSize:13,marginBottom:20}}>{fatal}</div>
        <button onClick={onDisconnect} style={{background:C.red,color:"#fff",border:"none",
          borderRadius:6,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>
          ← Back
        </button>
      </div>
    </div>
  );

  if (!appState || !uiLoaded) return <LoadingScreen loadLog={loadLog} demo={config.demo}/>;

  const { data, scenarios, groups, markers, reconciliations } = appState;
  const update = (patch: Partial<AppState>) => setAppState(s => s ? {...s,...patch} : s);
  const tab    = uiState.tab || "flow";

  const TABS = [
    {id:"flow",      label:"Monthly Flow"},
    {id:"scenarios", label:"Scenarios"},
    {id:"overview",  label:"Overview"},
    {id:"cats",      label:"Categories"},
    {id:"cal",       label:"Calibration"},
    {id:"ai",        label:"AI Analysis"},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:FONT}}>
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 28px",
        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{color:C.amber,fontSize:13,fontWeight:700,letterSpacing:3}}>◈ ACTUAL</div>
          <div style={{color:C.textDim,fontSize:11}}>CASH FLOW</div>
          {config.demo&&<div style={{background:C.amberLow,color:C.amber,fontSize:10,
            padding:"2px 8px",borderRadius:4}}>DEMO</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {serverOk===true&&(
            <div title="State is syncing to server — available on all devices"
              style={{background:`${C.teal}22`,border:`1px solid ${C.teal}55`,
                borderRadius:4,padding:"2px 8px",fontSize:9,color:C.teal,fontFamily:FONT}}>
              ● SYNCED
            </div>
          )}
          {serverOk===false&&(
            <div title="Server unreachable — settings saved locally only"
              style={{background:`${C.amber}22`,border:`1px solid ${C.amber}55`,
                borderRadius:4,padding:"2px 8px",fontSize:9,color:C.amber,fontFamily:FONT}}>
              ⚠ LOCAL ONLY
            </div>
          )}
          <div style={{color:C.textDim,fontSize:11}}>
            {data.months[0]?.month} → {data.months[data.months.length-1]?.month}
          </div>
          <button onClick={onDisconnect}
            style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,
              padding:"4px 12px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>
            disconnect
          </button>
        </div>
      </div>

      <div data-nav style={{borderBottom:`1px solid ${C.border}`,padding:"0 28px",display:"flex",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setUi({tab:t.id})} style={{
            background:"none",border:"none",
            borderBottom:`2px solid ${tab===t.id?C.amber:"transparent"}`,
            color:tab===t.id?C.amber:C.textDim,
            padding:"12px 18px",fontSize:11,letterSpacing:2,
            cursor:"pointer",fontFamily:FONT,textTransform:"uppercase",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      <div data-content style={{padding:"24px 28px"}}>
        {tab==="flow"      && <MonthlyFlowTab  data={data} scenarios={scenarios} markers={markers}
          reconciliations={reconciliations}
          onMarkersChange={(m: AppState['markers'])=>update({markers:m})}
          onReconciliationsChange={(r: AppState['reconciliations'])=>update({reconciliations:r})}
          uiState={uiState} setUi={setUi}/>}
        {tab==="scenarios" && <ScenariosTab    scenarios={scenarios} groups={groups} data={data}
          onScenariosChange={(s: AppState['scenarios'])=>update({scenarios:s})}
          onGroupsChange={(g: AppState['groups'])=>update({groups:g})}
          uiState={uiState} setUi={setUi}/>}
        {tab==="overview"  && <OverviewTab     data={data} uiState={uiState} setUi={setUi}/>}
        {tab==="cats"      && <CategoriesTab   data={data} uiState={uiState} setUi={setUi}/>}
        {tab==="cal"       && <CalibrationTab  data={data} reconciliations={reconciliations}
          onReconciliationsChange={(r: AppState['reconciliations'])=>update({reconciliations:r})}/>}
        {tab==="ai"        && <AITab           data={data} markers={markers} uiState={uiState} setUi={setUi}/>}
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
// CRITICAL: this component must render identically on server and client.
// localStorage is not available on the server, so we cannot read it during render.
// Solution: always render the blank shell on first render, then apply saved
// config in useEffect (client-only). This guarantees server === client on
// the initial render, eliminating the hydration mismatch entirely.
export default function Dashboard() {
  const [config,  setConfig]  = useState<Config|null>(null);
  const [ready,   setReady]   = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cf-connection")||"{}");
      if (saved.budgetId && saved.accountIds?.length > 0) setConfig(saved);
    } catch {}
    setReady(true);
  }, []);

  // Server render + first client render: blank background, no content.
  // React reconciles this as a no-op and then applies the effect.
  if (!ready) return <div style={{minHeight:"100vh",background:C.bg}}/>;

  if (!config) return (
    <ConnectionPanel onConnect={(cfg: Config) => {
      if (!cfg.demo) {
        try { localStorage.setItem("cf-connection", JSON.stringify(cfg)); } catch {}
      }
      setConfig(cfg);
    }}/>
  );

  return (
    <DashboardInner
      config={config}
      onDisconnect={() => {
        try { localStorage.removeItem("cf-connection"); } catch {}
        setConfig(null);
      }}
    />
  );
}
