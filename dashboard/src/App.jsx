import { useState, useEffect } from "react";
import { C, FONT, SK } from "./constants.js";
import { sSet, sGet, resetStateCache } from "./helpers.js";
import { useLoadData } from "./hooks/useLoadData.js";
import ConnectionPanel from "./components/connect/ConnectionPanel.jsx";
import MonthlyFlowTab  from "./components/tabs/MonthlyFlowTab.jsx";
import ScenariosTab    from "./components/tabs/ScenariosTab.jsx";
import { OverviewTab } from "./components/tabs/OverviewTab.jsx";
import { CategoriesTab } from "./components/tabs/OverviewTab.jsx";
import CalibrationTab  from "./components/tabs/CalibrationTab.jsx";
import AITab           from "./components/tabs/AITab.jsx";

const DEFAULT_UI = {
  tab:             "flow",
  overviewRange:   6,
  overviewCats:    null,
  overviewVis:     {income:true,expenses:true,net:true},
  catsRange:       6,
  catsVis:         null,
  catsShowGroups:  true,
  aiRange:         12,
  aiCats:          null,
  aiMode:          "analyse",
  flowSelMonth:    null,
  flowSelAccounts: null,
  flowBalRange:    6,
};

function LoadingScreen({ loadLog, config }) {
  const icon = {ok:"✓",error:"✗",warn:"⚠",pending:"…"};
  const col  = {ok:C.teal,error:C.red,warn:C.amber,pending:C.textDim};
  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",fontFamily:FONT,padding:40}}>
      <div style={{width:"100%",maxWidth:540}}>
        <div style={{color:C.amber,fontSize:13,fontWeight:700,letterSpacing:3,marginBottom:4}}>◈ ACTUAL</div>
        <div style={{color:C.text,fontSize:18,fontWeight:700,marginBottom:24}}>{config?.demo?"Loading demo data":"Connecting…"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {loadLog.map((e,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:10,padding:"9px 14px",background:C.surface,borderRadius:8,border:`1px solid ${e.status==="error"?C.red:e.status==="warn"?C.amber:C.border}`}}>
              <span style={{color:col[e.status],fontSize:12,minWidth:14}}>{icon[e.status]}</span>
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

function Dashboard({ config, onDisconnect }) {
  const { loadLog, appState, setAppState, fatal } = useLoadData(config);
  const [serverOk, setServerOk] = useState(null);
  const [uiState,  setUiStateRaw] = useState(DEFAULT_UI);
  const [uiLoaded, setUiLoaded]   = useState(false);

  const setUi = patch => setUiStateRaw(s => {
    const next = {...s, ...patch};
    // Debounced persist to DB — write on every change
    sSet(SK.ui, next);
    return next;
  });

  // Load uiState from DB on mount
  useEffect(() => {
    sGet(SK.ui).then(saved => {
      if (saved) setUiStateRaw(s => ({...DEFAULT_UI, ...saved}));
      setUiLoaded(true);
    });
  }, []);

  useEffect(() => {
    fetch("/cf-api/health", { signal: AbortSignal.timeout(2000) })
      .then(r => setServerOk(r.ok))
      .catch(() => setServerOk(false));
  }, []);

  // Autosave appState to DB
  useEffect(() => {
    if (!appState) return;
    const t = setTimeout(() => {
      sSet(SK.sc,  {scenarios:appState.scenarios, groups:appState.groups});
      sSet(SK.flow, {markers:appState.markers});
    }, 800);
    return () => clearTimeout(t);
  }, [appState?.scenarios, appState?.groups, appState?.markers]);

  if (fatal) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:FONT,padding:40}}>
      <div style={{maxWidth:480,background:C.surface,border:`1px solid ${C.red}`,borderRadius:12,padding:32}}>
        <div style={{color:C.red,fontSize:12,fontWeight:700,marginBottom:10}}>Failed to load</div>
        <div style={{color:C.text,fontSize:13,marginBottom:20}}>{fatal}</div>
        <button onClick={onDisconnect} style={{background:C.red,color:"#fff",border:"none",borderRadius:6,padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:FONT}}>← Back</button>
      </div>
    </div>
  );

  if (!appState || !uiLoaded) return <LoadingScreen loadLog={loadLog} config={config}/>;

  const { data, scenarios, groups, markers, reconciliations } = appState;
  const update = patch => setAppState(s=>({...s,...patch}));
  const tab = uiState.tab || "flow";
  const setTab = t => setUi({tab:t});

  const TABS = [
    {id:"flow",     label:"Monthly Flow"},
    {id:"scenarios",label:"Scenarios"},
    {id:"overview", label:"Overview"},
    {id:"cats",     label:"Categories"},
    {id:"cal",      label:"Calibration"},
    {id:"ai",       label:"AI Analysis"},
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:FONT}}>
      <div style={{borderBottom:`1px solid ${C.border}`,padding:"14px 28px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <div style={{color:C.amber,fontSize:13,fontWeight:700,letterSpacing:3}}>◈ ACTUAL</div>
          <div style={{color:C.textDim,fontSize:11}}>CASH FLOW</div>
          {config.demo&&<div style={{background:C.amberLow,color:C.amber,fontSize:10,padding:"2px 8px",borderRadius:4}}>DEMO</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          {serverOk===true  && <div style={{background:`${C.teal}22`,border:`1px solid ${C.teal}55`,borderRadius:4,padding:"2px 8px",fontSize:9,color:C.teal,fontFamily:FONT}}>● SYNCED</div>}
          {serverOk===false && <div style={{background:`${C.amber}22`,border:`1px solid ${C.amber}55`,borderRadius:4,padding:"2px 8px",fontSize:9,color:C.amber,fontFamily:FONT}}>⚠ LOCAL ONLY</div>}
          <div style={{color:C.textDim,fontSize:11}}>{data.months[0]?.month} → {data.months[data.months.length-1]?.month}</div>
          <button onClick={onDisconnect} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 12px",color:C.textDim,fontSize:10,cursor:"pointer",fontFamily:FONT}}>disconnect</button>
        </div>
      </div>

      <div style={{borderBottom:`1px solid ${C.border}`,padding:"0 28px",display:"flex",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            background:"none",border:"none",
            borderBottom:`2px solid ${tab===t.id?C.amber:"transparent"}`,
            color:tab===t.id?C.amber:C.textDim,
            padding:"12px 18px",fontSize:11,letterSpacing:2,
            cursor:"pointer",fontFamily:FONT,textTransform:"uppercase",whiteSpace:"nowrap",
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{padding:"24px 28px"}}>
        {tab==="flow"      && <MonthlyFlowTab  data={data} scenarios={scenarios} markers={markers} reconciliations={reconciliations} onMarkersChange={m=>update({markers:m})} onReconciliationsChange={r=>update({reconciliations:r})} uiState={uiState} setUi={setUi}/>}
        {tab==="scenarios" && <ScenariosTab    scenarios={scenarios} groups={groups} data={data} onScenariosChange={s=>update({scenarios:s})} onGroupsChange={g=>update({groups:g})}/>}
        {tab==="overview"  && <OverviewTab     data={data} uiState={uiState} setUi={setUi}/>}
        {tab==="cats"      && <CategoriesTab   data={data} uiState={uiState} setUi={setUi}/>}
        {tab==="cal"       && <CalibrationTab  data={data} reconciliations={reconciliations} onReconciliationsChange={r=>update({reconciliations:r})}/>}
        {tab==="ai"        && <AITab           data={data} markers={markers} uiState={uiState} setUi={setUi}/>}
      </div>
    </div>
  );
}

export default function App() {
  const saved = JSON.parse(localStorage.getItem("cf-connection")||"{}");
  const hasFullSaved = saved.apiUrl&&saved.apiKey&&saved.budgetId&&saved.accountIds?.length>0;
  const [config, setConfig] = useState(hasFullSaved ? saved : null);

  useEffect(() => {
    const l = document.createElement("link");
    l.rel="stylesheet";
    l.href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap";
    document.head.appendChild(l);
  }, []);

  const handleConnect = async (cfg) => {
    if (!cfg.demo) {
      // Save typeOverrides to DB so they sync across devices
      localStorage.setItem("cf-connection", JSON.stringify(cfg));
      // Give sSet the budgetId context by setting localStorage first
      const { sSet: save } = await import("./helpers.js");
      await save(SK.conn, { typeOverrides: cfg.typeOverrides || {} });
    }
    setConfig(cfg);
  };

  if (!config) return <ConnectionPanel onConnect={handleConnect}/>;
  return (
    <Dashboard
      config={config}
      onDisconnect={() => { localStorage.removeItem("cf-connection"); setConfig(null); }}
    />
  );
}
