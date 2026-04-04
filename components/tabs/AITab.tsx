"use client";
import { useState, useRef, useEffect } from "react";
import { C, FONT, CAT_PALETTE, SK } from "@/lib/constants";
import { fmt, sGet, sSet, completeMonths } from "@/lib/helpers";
import { catSpend } from "@/lib/finance";
import { Chip, RangeButtons } from "@/components/ui";

const AI_KEY = "cf-ai-history-v1";
const loadHistory = () => { try { return JSON.parse(localStorage.getItem(AI_KEY)||"[]"); } catch { return []; } };
const saveHistory = s => { try { localStorage.setItem(AI_KEY,JSON.stringify(s.slice(-10))); } catch {} };

export default function AITab({ data, markers, uiState={}, setUi=()=>{} }) {
  const [oUrl,      setOUrl]      = useState("http://localhost:11434");
  const [model,     setModel]     = useState("llama3.1:8b");
  const [models,    setModels]    = useState([]);
  const [connected, setConnected] = useState(false);
  const [connErr,   setConnErr]   = useState("");
  const aiRange  = uiState.aiRange ?? 12;
  const setAiRange = v => setUi({aiRange:v});
  const selCats  = uiState.aiCats ?? null;
  const setSelCats = v => setUi({aiCats: typeof v==="function" ? v(uiState.aiCats??null) : v});
  const mode     = uiState.aiMode ?? "analyse";
  const setMode  = v => setUi({aiMode:v});
  // Analysis mode state
  const [insight,   setInsight]   = useState("");
  const [loading,   setLoading]   = useState(false);
  const [aErr,      setAErr]      = useState("");
  const [history,   setHistory]   = useState(()=>loadHistory());
  const [showHist,  setShowHist]  = useState(false);
  // Chat mode state
  const [messages,  setMessages]  = useState([]); // [{role:"user"|"assistant", content}]
  const [input,     setInput]     = useState("");
  const [chatLoading,setChatLoading] = useState(false);
  const chatEndRef = useRef(null);
  const abortRef   = useRef(false);
  const readerRef  = useRef(null);

  useEffect(()=>{
    sGet(SK.ol).then(cfg=>{
      if (!cfg) return;
      if (cfg.url)     setOUrl(cfg.url);
      if (cfg.model)   setModel(cfg.model);
      if (cfg.aiRange) setAiRange(cfg.aiRange);
      if (cfg.cats)    setSelCats(cfg.cats);
    });
  },[]);

  useEffect(()=>{ chatEndRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const allCats    = data.categories;
  const activeCats = selCats ?? allCats;
  const toggleCat  = cat => {
    const n = activeCats.includes(cat)?activeCats.filter(c=>c!==cat):[...activeCats,cat];
    setSelCats(n.length===allCats.length?null:n);
  };

  const doConnect = async () => {
    setConnErr("");
    try {
      const r = await fetch(`${oUrl}/api/tags`);
      const j = await r.json();
      const ms = (j.models??[]).map(m=>m.name);
      setModels(ms);
      if (ms.length) {
        setConnected(true);
        const pref = ["llama3.1:8b","llama3.1","llama3.2","phi4","mistral"];
        const best = pref.reduce((f,p)=>f||(ms.find(m=>m.startsWith(p.split(":")[0]))||null),null)??ms[0];
        setModel(best);
        sSet(SK.ol,{url:oUrl,model:best,aiRange,cats:selCats});
      }
    } catch { setConnErr("Cannot reach Ollama. Start with: OLLAMA_ORIGINS=* ollama serve"); }
  };

  const doStop = () => {
    abortRef.current=true;
    try{readerRef.current?.cancel();}catch{}
    setLoading(false); setChatLoading(false);
  };

  // Build the financial context block (shared by both modes)
  const buildContext = () => {
    const slice = completeMonths(data.months).slice(-aiRange);
    const allTx = slice.flatMap(m=>(m.transactions||[]).filter(t=>activeCats.includes(t.category)||t.isIncome));
    const monthlyBlock = slice.map(m =>
      `${m.month}: in ${fmt(m.income)}, out ${fmt(m.expenses)}, net ${fmt(m.net)}, end ${fmt(m.endBalance)}\n` +
      activeCats.map(c=>`  ${c}: ${fmt(catSpend(m,c))}`).join("\n")
    ).join("\n\n");
    const payeeMap = {};
    allTx.forEach(t=>{ if(t.payee&&t.amount<0){if(!payeeMap[t.payee])payeeMap[t.payee]={n:0,tot:0};payeeMap[t.payee].n++;payeeMap[t.payee].tot+=Math.abs(t.amount);}});
    const payeeBlock = Object.entries(payeeMap).sort((a,b)=>b[1].tot-a[1].tot).slice(0,20)
      .map(([p,{n,tot}])=>`${p}: ${fmt(tot)} (${n}x)`).join("\n");
    const goodMs = slice.filter(m=>markers[m.month]==="good");
    const badMs  = slice.filter(m=>markers[m.month]==="bad");
    const markerBlock = (goodMs.length||badMs.length)
      ? `\nGood months: ${goodMs.map(m=>`${m.month} end ${fmt(m.endBalance)}`).join(", ")||"none"}\nBad months: ${badMs.map(m=>`${m.month} end ${fmt(m.endBalance)}`).join(", ")||"none"}`
      : "";
    const txBlock = allTx.map(t=>`${t.date}|${t.payee||"—"}|${t.category}|${fmt(t.amount)}`).join("\n");
    return { slice, monthlyBlock, payeeBlock, markerBlock, txBlock, txCount: allTx.filter(t=>t.amount<0).length };
  };

  // Stream from Ollama
  const streamOllama = async (prompt, onToken, onDone) => {
    abortRef.current=false;
    let full="";
    try {
      const resp = await fetch(`${oUrl}/api/generate`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model,prompt,stream:true}),
      });
      const reader = resp.body.getReader(); readerRef.current=reader;
      const dec = new TextDecoder();
      while (!abortRef.current) {
        const {done,value} = await reader.read(); if(done)break;
        dec.decode(value).split("\n").filter(Boolean).forEach(line=>{
          try{const j=JSON.parse(line);if(j.response){full+=j.response;onToken(full);}}catch{}
        });
      }
    } catch(e) { onDone(full, e.message); return; }
    onDone(full, null);
  };

  // ── Analysis mode ──────────────────────────────────────────────────────────
  const doAnalyse = async () => {
    setLoading(true); setInsight(""); setAErr("");
    sSet(SK.ol,{url:oUrl,model,aiRange,cats:selCats});
    const {slice,monthlyBlock,payeeBlock,markerBlock,txBlock} = buildContext();
    const recentHist = history.slice(-3);
    const histBlock = recentHist.length
      ? `\nPREVIOUS ANALYSES:\n${recentHist.map((s,i)=>`[${i+1}] ${s.date} ${s.months}\n${s.summary}`).join("\n\n")}\n`
      : "";
    const prompt = `Personal finance analyst. ${slice.length} complete months. GBP. Be specific — use real numbers, payees, months.${markerBlock}${histBlock}\n\n══ MONTHLY DETAIL ══\n${monthlyBlock}\n\n══ TOP PAYEES ══\n${payeeBlock}\n\n══ ALL TRANSACTIONS ══\n${txBlock}\n\n## Trends\n## Anomalies\n## Payee Patterns\n## 3-Month Forecast\n## Two Actions (specific, with £ savings)\n\nUnder 500 words.`;
    await streamOllama(prompt, setInsight, (full, err) => {
      if (err) setAErr("Ollama failed. Ensure OLLAMA_ORIGINS=* is set.");
      if (full.length>50) {
        const session={date:new Date().toLocaleDateString("en-GB"),months:`${slice[0]?.month}→${slice[slice.length-1]?.month}`,cats:activeCats.join(", "),summary:full.slice(0,600)+"…",full};
        const n=[...history,session]; setHistory(n); saveHistory(n);
      }
      setLoading(false);
    });
  };

  // ── Chat mode ──────────────────────────────────────────────────────────────
  const doChat = async () => {
    const q = input.trim(); if (!q) return;
    const userMsg = {role:"user",content:q};
    setMessages(prev=>[...prev,userMsg,{role:"assistant",content:""}]);
    setInput(""); setChatLoading(true);

    const {monthlyBlock,payeeBlock,markerBlock,txBlock} = buildContext();
    const systemCtx = `You are a personal finance assistant. The user has ${aiRange} months of transaction data. Answer questions directly using the data below. Be specific with amounts (GBP) and dates.${markerBlock}\n\nMONTHLY SUMMARY:\n${monthlyBlock}\n\nTOP PAYEES:\n${payeeBlock}\n\nTRANSACTIONS:\n${txBlock}\n\n---\nUser question: ${q}`;

    await streamOllama(systemCtx,
      (full) => setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:full}]),
      (full, err) => {
        if (err) setMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"⚠ Error: "+err}]);
        setChatLoading(false);
      }
    );
  };

  const slice    = completeMonths(data.months).slice(-aiRange);
  const txCount  = slice.flatMap(m=>(m.transactions||[]).filter(t=>activeCats.includes(t.category)&&t.amount<0)).length;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      {/* Ollama connection */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:22}}>
        <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:14}}>OLLAMA — LOCAL AI</div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
          <div style={{flex:2,minWidth:200}}>
            <div style={{color:C.textDim,fontSize:10,marginBottom:5}}>URL</div>
            <input value={oUrl} onChange={e=>setOUrl(e.target.value)}
              style={{width:"100%",boxSizing:"border-box",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.text,fontSize:12,fontFamily:FONT,outline:"none"}}/>
          </div>
          {connected&&models.length>0&&(
            <div style={{flex:2,minWidth:160}}>
              <div style={{color:C.textDim,fontSize:10,marginBottom:5}}>MODEL</div>
              <select value={model} onChange={e=>setModel(e.target.value)}
                style={{width:"100%",background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.text,fontSize:12,fontFamily:FONT}}>
                {models.map(m=><option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
          <button onClick={doConnect} style={{background:connected?"transparent":C.amber,color:connected?C.teal:"#060e1a",border:`1px solid ${connected?C.teal:C.amber}`,borderRadius:6,padding:"9px 20px",fontSize:12,cursor:"pointer",fontFamily:FONT,fontWeight:700}}>
            {connected?"✓ CONNECTED":"CONNECT"}
          </button>
          {(loading||chatLoading)&&<button onClick={doStop} style={{background:"transparent",border:`1px solid ${C.red}`,borderRadius:6,padding:"9px 16px",color:C.red,fontSize:11,cursor:"pointer",fontFamily:FONT}}>STOP</button>}
        </div>
        {connErr&&<div style={{color:C.red,fontSize:11,marginTop:10,padding:"8px 12px",background:"#1a0a0a",borderRadius:6}}>{connErr}</div>}
        {!connected&&<div style={{color:C.muted,fontSize:11,marginTop:10}}>Start: <span style={{color:C.textDim}}>OLLAMA_ORIGINS=* ollama serve</span></div>}
      </div>

      {/* Mode + range + categories */}
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:22}}>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {[{v:"analyse",l:"📊 Analyse"},{v:"chat",l:"💬 Ask a question"}].map(({v,l})=>(
            <button key={v} onClick={()=>setMode(v)} style={{
              flex:1,fontFamily:FONT,fontSize:11,padding:"8px 0",borderRadius:7,cursor:"pointer",
              border:`1px solid ${mode===v?C.amber:C.border}`,
              background:mode===v?`${C.amber}22`:"transparent",
              color:mode===v?C.amber:C.textDim,fontWeight:mode===v?700:400,
            }}>{l}</button>
          ))}
        </div>

        <div style={{marginBottom:14}}>
          <div style={{color:C.textDim,fontSize:10,letterSpacing:2,marginBottom:8}}>RANGE (complete months only)</div>
          <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
            <RangeButtons value={aiRange} onChange={setAiRange} options={[3,6,12,24]} data={{months:completeMonths(data.months)}}/>
            <div style={{color:C.muted,fontSize:11}}>{slice[0]?.month} → {slice[slice.length-1]?.month} · {txCount} tx</div>
          </div>
        </div>

        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
            <div style={{color:C.textDim,fontSize:10,letterSpacing:2}}>CATEGORIES</div>
            <button onClick={()=>setSelCats(selCats===null?[]:null)} style={{background:"transparent",border:"none",color:C.amberMid,fontSize:11,cursor:"pointer",fontFamily:FONT}}>
              {selCats===null?"deselect all":"select all"}
            </button>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {allCats.map((cat,i)=><Chip key={cat} label={cat} color={CAT_PALETTE[i%CAT_PALETTE.length]} active={activeCats.includes(cat)} onClick={()=>toggleCat(cat)}/>)}
          </div>
        </div>
      </div>

      {/* Analysis mode */}
      {mode==="analyse"&&(
        <div style={{background:C.surface,border:`1px solid ${C.amberLow}`,borderRadius:10,padding:22}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{color:C.amber,fontSize:11,fontWeight:700}}>FINANCIAL ANALYSIS</div>
            <button onClick={doAnalyse} disabled={!connected||loading||activeCats.length===0}
              style={{background:connected&&!loading?C.amber:"transparent",color:connected&&!loading?"#060e1a":C.muted,
                border:`1px solid ${connected&&!loading?C.amber:C.border}`,borderRadius:6,padding:"9px 20px",
                fontSize:12,fontWeight:700,cursor:connected&&!loading?"pointer":"default",fontFamily:FONT}}>
              {loading?"ANALYSING…":insight?"RE-ANALYSE":"ANALYSE"}
            </button>
          </div>
          {aErr&&<div style={{color:C.red,fontSize:12,marginBottom:12,padding:"10px 14px",background:"#1a0a0a",borderRadius:6}}>{aErr}</div>}
          {loading&&!insight&&<div style={{color:C.textDim,fontSize:12,textAlign:"center",padding:"28px 0"}}>
            <span style={{color:C.amber}}>◈</span> {model} analysing…
          </div>}
          {insight&&<div style={{color:C.text,fontSize:13,lineHeight:1.9,whiteSpace:"pre-wrap"}}>
            {insight}{loading&&<span style={{color:C.amber}}> ▋</span>}
          </div>}
          {!insight&&!loading&&<div style={{color:C.textDim,fontSize:12}}>
            Runs a full analysis of the selected months. Good/bad markers and previous analyses are included automatically.
          </div>}

          {/* Session history */}
          {history.length>0&&(
            <div style={{marginTop:16,paddingTop:16,borderTop:`1px solid ${C.border}`}}>
              <button onClick={()=>setShowHist(o=>!o)} style={{background:"transparent",border:"none",color:C.textDim,cursor:"pointer",fontFamily:FONT,fontSize:11,display:"flex",alignItems:"center",gap:8,padding:0,marginBottom:showHist?12:0}}>
                <span style={{color:C.amber}}>{showHist?"▼":"▶"}</span>
                HISTORY ({history.length})
                <button onClick={e=>{e.stopPropagation();setHistory([]);saveHistory([]);}} style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:10,fontFamily:FONT,marginLeft:8}}>clear</button>
              </button>
              {showHist&&[...history].reverse().map((s,i)=>(
                <div key={i} style={{background:C.elevated,border:`1px solid ${C.border}`,borderRadius:8,padding:"12px 14px",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                    <div style={{color:C.amber,fontSize:11,fontWeight:700}}>{s.date}</div>
                    <div style={{color:C.textDim,fontSize:10}}>{s.months}</div>
                  </div>
                  <div style={{color:C.text,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{s.full||s.summary}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Chat mode */}
      {mode==="chat"&&(
        <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,display:"flex",flexDirection:"column",minHeight:400}}>
          <div style={{padding:"14px 18px",borderBottom:`1px solid ${C.border}`,color:C.textDim,fontSize:11}}>
            Ask anything about your transactions — e.g. "How much did I spend on groceries in Jan?" or "Which month had the biggest electricity bill?"
          </div>
          {/* Messages */}
          <div style={{flex:1,overflowY:"auto",padding:"16px 18px",display:"flex",flexDirection:"column",gap:12,minHeight:280,maxHeight:500}}>
            {messages.length===0&&(
              <div style={{color:C.muted,fontSize:12,textAlign:"center",padding:"40px 0"}}>
                {connected?"Type a question below…":"Connect to Ollama above first."}
              </div>
            )}
            {messages.map((msg,i)=>(
              <div key={i} style={{
                alignSelf:msg.role==="user"?"flex-end":"flex-start",
                maxWidth:"85%",
                background:msg.role==="user"?`${C.amber}22`:C.elevated,
                border:`1px solid ${msg.role==="user"?C.amber:C.border}`,
                borderRadius:10,padding:"10px 14px",
              }}>
                <div style={{color:msg.role==="user"?C.amber:C.text,fontSize:12,lineHeight:1.7,whiteSpace:"pre-wrap"}}>
                  {msg.content||<span style={{color:C.textDim}}>▋</span>}
                </div>
              </div>
            ))}
            <div ref={chatEndRef}/>
          </div>
          {/* Input */}
          <div style={{padding:"12px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10}}>
            <input
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&!chatLoading&&doChat()}
              placeholder={connected?"Ask about your finances…":"Connect to Ollama first"}
              disabled={!connected||chatLoading}
              style={{flex:1,background:C.bg,border:`1px solid ${C.border}`,borderRadius:6,
                padding:"9px 12px",color:C.text,fontSize:12,fontFamily:FONT,outline:"none"}}/>
            <button onClick={doChat} disabled={!connected||chatLoading||!input.trim()}
              style={{background:connected&&input.trim()?C.amber:"transparent",
                color:connected&&input.trim()?"#060e1a":C.muted,
                border:`1px solid ${connected&&input.trim()?C.amber:C.border}`,
                borderRadius:6,padding:"9px 16px",fontSize:12,fontWeight:700,
                cursor:connected&&input.trim()?"pointer":"default",fontFamily:FONT}}>
              {chatLoading?"…":"SEND"}
            </button>
            {messages.length>0&&<button onClick={()=>setMessages([])} style={{background:"transparent",border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 12px",color:C.muted,fontSize:11,cursor:"pointer",fontFamily:FONT}}>clear</button>}
          </div>
        </div>
      )}
    </div>
  );
}
