export const C = {
  bg:"#07101f", surface:"#0c1929", elevated:"#101f33", border:"#172538",
  amber:"#f5a623", amberLow:"#3d2a0a", amberMid:"#7a5112",
  teal:"#2dd4bf", red:"#f87171", blue:"#60a5fa", purple:"#a78bfa",
  green:"#4ade80", orange:"#fb923c", pink:"#f472b6", yellow:"#facc15",
  muted:"#3d5570", text:"#c5d8ef", textDim:"#5a7490",
};

export const FONT = "'IBM Plex Mono', monospace";

export const CAT_PALETTE = [
  C.amber, C.teal, C.blue, C.purple, C.red,
  C.orange, C.green, C.pink, "#38bdf8", C.yellow,
];

export const PRESET_COLORS = [
  "#2dd4bf","#60a5fa","#4ade80","#a78bfa","#f87171",
  "#fb923c","#f472b6","#facc15","#f5a623","#38bdf8","#e879f9","#34d399",
];

export const ACCT_TYPES = ["checking","savings","credit","investment","mortgage","debt","other"];

export const TYPE_COLOR = {
  credit: C.red, mortgage: C.red, debt: C.red,
  checking: C.teal, savings: C.teal,
  investment: C.purple, other: C.textDim,
};

export const SK = { sc:"cf-sc-v6", flow:"cf-flow-v5", ol:"cf-ol-v3", cal:"cf-cal-v1", ui:"cf-ui-v1", conn:"cf-conn-v1" };

export const DEFAULT_GROUPS = [
  {id:"g1",name:"Bills",    color:"#60a5fa"},
  {id:"g2",name:"Food",     color:"#fb923c"},
  {id:"g3",name:"Transport",color:"#facc15"},
  {id:"g4",name:"Savings",  color:"#2dd4bf"},
  {id:"g5",name:"Investments",color:"#a78bfa"},
  {id:"g6",name:"Giving",   color:"#4ade80"},
  {id:"g7",name:"Other",    color:"#f5a623"},
];
