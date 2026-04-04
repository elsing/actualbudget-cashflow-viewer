"use client";
import { useState } from "react";
import { C, FONT, PRESET_COLORS } from "@/lib/constants";
import { fmtM, fmtD, fmt } from "@/lib/helpers";

export function Chip({ label, color, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      display:"flex", alignItems:"center", gap:5,
      padding: small ? "3px 9px" : "4px 11px",
      background: active ? `${color}22` : "transparent",
      border: `1px solid ${active ? color : C.border}`,
      borderRadius:20, cursor:"pointer", fontFamily:FONT,
      fontSize: small ? 9 : 10,
      color: active ? color : C.textDim,
      whiteSpace:"nowrap",
    }}>
      <span style={{width:6,height:6,borderRadius:2,background:active?color:C.muted,flexShrink:0}}/>
      {label}
    </button>
  );
}

export function ColorSwatch({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{position:"relative",flexShrink:0}}>
      <div onClick={()=>setOpen(o=>!o)} style={{
        width:22, height:22, borderRadius:5, background:value,
        cursor:"pointer", border:`2px solid ${C.border}`,
      }}/>
      {open && (
        <div style={{
          position:"absolute", top:28, left:0, zIndex:300,
          background:C.elevated, border:`1px solid ${C.border}`,
          borderRadius:8, padding:10, display:"flex", flexWrap:"wrap",
          gap:6, width:160, boxShadow:"0 4px 24px #000a",
        }}>
          {PRESET_COLORS.map(col => (
            <div key={col} onClick={()=>{onChange(col);setOpen(false);}} style={{
              width:20, height:20, borderRadius:4, background:col,
              cursor:"pointer", border:col===value?"2px solid #fff":"1px solid transparent",
            }}/>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const iso = String(label||"");
  const lbl = iso.length===10 ? fmtD(iso) : fmtM(iso);
  return (
    <div style={{background:"#0a182b",border:`1px solid ${C.border}`,borderRadius:8,padding:"10px 14px",maxWidth:220}}>
      <div style={{color:C.textDim,fontSize:11,marginBottom:6}}>{lbl}</div>
      {payload.filter(p=>p.value!=null&&p.value!==0).map(p=>(
        <div key={p.name} style={{color:p.color||p.fill||C.text,fontSize:12,marginBottom:2}}>
          {p.name}: {fmt(p.value)}
        </div>
      ))}
    </div>
  );
}

export function RangeButtons({ value, onChange, options, data }) {
  // options = array of numbers e.g. [3,6,12,24], filtered by data.months.length
  const available = options.filter(r => r <= (data?.months?.length ?? 99));
  return (
    <div style={{display:"flex",gap:6}}>
      {available.map(r => (
        <button key={r} onClick={()=>onChange(r)} style={{
          fontFamily:FONT, fontSize:11, padding:"5px 12px", borderRadius:6,
          cursor:"pointer", fontWeight:value===r?700:400,
          border:`1px solid ${value===r?C.amber:C.border}`,
          background:value===r?C.amber:"transparent",
          color:value===r?"#060e1a":C.textDim,
        }}>{r}mo</button>
      ))}
    </div>
  );
}
