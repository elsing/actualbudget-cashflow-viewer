"use client";
import { useState } from "react";
import { C, FONT, PRESET_COLORS, CAT_PALETTE } from "@/lib/constants";
import { fmtM, fmtD, fmt } from "@/lib/helpers";
import type { Month } from "@/types";

interface ChipProps {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
  small?: boolean;
}
export function Chip({ label, color, active, onClick, small }: ChipProps) {
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

interface ColorSwatchProps {
  value: string;
  onChange: (color: string) => void;
}
export function ColorSwatch({ value, onChange }: ColorSwatchProps) {
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

interface ChartTipProps {
  active?: boolean;
  payload?: { name: string; value: number; color?: string; fill?: string }[];
  label?: string | number;
}
export function ChartTip({ active, payload, label }: ChartTipProps) {
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

interface RangeButtonsProps {
  value: number;
  onChange: (v: number) => void;
  options: number[];
  data: { months: Month[] };
}
export function RangeButtons({ value, onChange, options, data }: RangeButtonsProps) {
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

// ── CategoryChips ─────────────────────────────────────────────────────────────
// Renders category chips grouped by their Actual Budget group, with a small
// group label between sections. Preserves the order from data.categories
// (which already comes sorted by group from useLoadData).
interface CategoryChipsProps {
  cats: string[];
  activeCats: string[];
  catGroupMap: Record<string, string>;
  onToggle: (cat: string) => void;
  small?: boolean;
}
export function CategoryChips({ cats, activeCats, catGroupMap, onToggle, small }: CategoryChipsProps) {
  // Build ordered groups, preserving the order cats appear in (group order from Actual)
  const groups: { name: string; cats: string[] }[] = [];
  const seen = new Set<string>();
  cats.forEach(cat => {
    const group = catGroupMap[cat] || "Other";
    if (!seen.has(group)) {
      seen.add(group);
      groups.push({ name: group, cats: [] });
    }
    groups[groups.length - 1].cats.push(cat);
  });

  // Assign palette colours by original index in cats array for consistency
  const colorOf = (cat: string) => CAT_PALETTE[cats.indexOf(cat) % CAT_PALETTE.length];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {groups.map(g => (
        <div key={g.name}>
          <div style={{ color: C.muted, fontSize: 9, letterSpacing: 1.5, marginBottom: 5 }}>
            {g.name.toUpperCase()}
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {g.cats.map(cat => (
              <Chip key={cat} label={cat} color={colorOf(cat)}
                active={activeCats.includes(cat)} onClick={() => onToggle(cat)} small={small} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
