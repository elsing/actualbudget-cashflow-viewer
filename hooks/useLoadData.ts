"use client";
import { useState, useEffect } from "react";
import { sGet, currentMonthKey, resetStateCache } from "@/lib/helpers";
import { SK, DEFAULT_GROUPS } from "@/lib/constants";
import { mkScenarios } from "@/lib/finance";
import type { AppState, AppData, Month, Transaction } from "@/types";

// ── Demo data ─────────────────────────────────────────────────────────────────
// Based on a typical UK household: couple, combined take-home ~£3,800/mo,
// renting a 2-bed flat, one car, standard bills. Amounts in pence.
function generateDemo(): AppData {
  const cats = ["Rent","Groceries","Eating Out","Transport","Energy & Water","Council Tax","Insurance","Subscriptions","Clothing","Personal Care","Entertainment","Savings"];
  const groups = ["Home","Food","Transport","Bills","Lifestyle","Savings"];
  const catGroupMap: Record<string,string> = {
    "Rent":"Home","Groceries":"Food","Eating Out":"Food",
    "Transport":"Transport","Energy & Water":"Bills","Council Tax":"Bills",
    "Insurance":"Bills","Subscriptions":"Lifestyle","Clothing":"Lifestyle",
    "Personal Care":"Lifestyle","Entertainment":"Lifestyle","Savings":"Savings",
  };
  const now  = new Date();
  const acctObjs = [
    {id:"demo-current", name:"Joint Current",  type:"checking"},
    {id:"demo-savings", name:"Easy Access ISA", type:"savings"},
  ];
  const months: Month[] = [];
  // Start with a plausible balance
  let curBal = 340000;  // £3,400 current account
  let savBal = 620000;  // £6,200 savings

  for (let i = 23; i >= 0; i--) {
    const d   = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const mo  = d.getMonth(); // 0=Jan, used for seasonal variation

    // Combined take-home: £3,750–£3,850 with occasional overtime
    const baseIncome = 375000;
    const bonusMonth = mo === 11; // December bonus
    const income = baseIncome + (bonusMonth ? 45000 : 0) + Math.round((Math.random() - 0.3) * 15000);

    // Seasonal spending — higher energy in winter, higher entertainment in summer
    const isWinter  = mo <= 1 || mo >= 10;
    const isSummer  = mo >= 5 && mo <= 8;

    const txs: Transaction[] = [
      // Bills hit 1st-2nd
      {id:`${key}-rent`,   date:`${key}-01`, payee:"Foxtons Estates",    category:"Rent",            amount:-125000, account:"Joint Current", isIncome:false},
      {id:`${key}-ct`,     date:`${key}-01`, payee:"Southwark Council",  category:"Council Tax",     amount:-16500,  account:"Joint Current"},
      {id:`${key}-ins`,    date:`${key}-02`, payee:"Aviva Home Ins",     category:"Insurance",       amount:-3200,   account:"Joint Current"},
      // Salary lands on the last working day — simulate as 28th
      {id:`${key}-sal`,    date:`${key}-28`, payee:"Employer",           category:"Income",          amount:income,  account:"Joint Current", isIncome:true},
      // Direct debits — energy, water
      {id:`${key}-enrg`,   date:`${key}-03`, payee:"Octopus Energy",     category:"Energy & Water",  amount:-(isWinter ? 18500 : 9500) + Math.round((Math.random()-.5)*2000), account:"Joint Current"},
      {id:`${key}-water`,  date:`${key}-03`, payee:"Thames Water",       category:"Energy & Water",  amount:-4200,   account:"Joint Current"},
      // Subscriptions
      {id:`${key}-nf`,     date:`${key}-05`, payee:"Netflix",            category:"Subscriptions",   amount:-1799,   account:"Joint Current"},
      {id:`${key}-spot`,   date:`${key}-05`, payee:"Spotify Family",     category:"Subscriptions",   amount:-1799,   account:"Joint Current"},
      {id:`${key}-gym`,    date:`${key}-06`, payee:"PureGym",            category:"Subscriptions",   amount:-2499,   account:"Joint Current"},
      {id:`${key}-prime`,  date:`${key}-07`, payee:"Amazon Prime",       category:"Subscriptions",   amount:-899,    account:"Joint Current"},
      // Groceries — weekly shops
      {id:`${key}-g1`,     date:`${key}-03`, payee:"Sainsbury's",        category:"Groceries",       amount:-Math.round(6500+Math.random()*2500), account:"Joint Current"},
      {id:`${key}-g2`,     date:`${key}-10`, payee:"Sainsbury's",        category:"Groceries",       amount:-Math.round(5800+Math.random()*2200), account:"Joint Current"},
      {id:`${key}-g3`,     date:`${key}-17`, payee:"Sainsbury's",        category:"Groceries",       amount:-Math.round(6200+Math.random()*2000), account:"Joint Current"},
      {id:`${key}-g4`,     date:`${key}-24`, payee:"Lidl",               category:"Groceries",       amount:-Math.round(3500+Math.random()*1500), account:"Joint Current"},
      // Transport
      {id:`${key}-tfl`,    date:`${key}-01`, payee:"TfL Contactless",    category:"Transport",       amount:-Math.round(7500+Math.random()*3000), account:"Joint Current"},
      {id:`${key}-fuel`,   date:`${key}-12`, payee:"Shell",              category:"Transport",       amount:-Math.round(5500+Math.random()*2000), account:"Joint Current"},
      // Eating out — varies by season
      {id:`${key}-rest1`,  date:`${key}-08`, payee:"Dishoom",            category:"Eating Out",      amount:-Math.round(3500+(isSummer?2000:0)+Math.random()*2500), account:"Joint Current"},
      {id:`${key}-cafe`,   date:`${key}-15`, payee:"Pret A Manger",      category:"Eating Out",      amount:-Math.round(1800+Math.random()*1200), account:"Joint Current"},
      {id:`${key}-deliv`,  date:`${key}-20`, payee:"Deliveroo",          category:"Eating Out",      amount:-Math.round(2200+Math.random()*1800), account:"Joint Current"},
      // Personal care
      {id:`${key}-hair`,   date:`${key}-16`, payee:"Supercuts",          category:"Personal Care",   amount:-Math.round(1500+Math.random()*1500), account:"Joint Current"},
      {id:`${key}-pharm`,  date:`${key}-19`, payee:"Boots",              category:"Personal Care",   amount:-Math.round(800+Math.random()*1200),  account:"Joint Current"},
      // Entertainment
      {id:`${key}-ent`,    date:`${key}-21`, payee:"Odeon",              category:"Entertainment",   amount:-(isSummer ? Math.round(2000+Math.random()*3000) : Math.round(500+Math.random()*1500)), account:"Joint Current"},
      // Clothing — occasional
      ...(Math.random() > 0.5 ? [{id:`${key}-clo`, date:`${key}-23`, payee:"ASOS",  category:"Clothing",  amount:-Math.round(3500+Math.random()*6500), account:"Joint Current"}] : []),
      // Savings transfer on payday
      {id:`${key}-sav`,    date:`${key}-28`, payee:"ISA Transfer",       category:"Savings",         amount:-30000,  account:"Joint Current"},
      {id:`${key}-savr`,   date:`${key}-28`, payee:"ISA Transfer",       category:"Savings",         amount:30000,   account:"Easy Access ISA", isIncome:false},
    ];

    const catMap: Record<string,number> = {};
    txs.forEach(tx => { catMap[tx.category] = (catMap[tx.category] || 0) + tx.amount; });

    const expenses = txs.filter(t => t.amount < 0 && !t.isIncome && t.account === "Joint Current")
      .reduce((a, t) => a + Math.abs(t.amount), 0);

    const curNet = txs.filter(t => t.account === "Joint Current").reduce((a, t) => a + t.amount, 0);
    const savNet = txs.filter(t => t.account === "Easy Access ISA").reduce((a, t) => a + t.amount, 0);
    const prevCur = curBal, prevSav = savBal;
    curBal += curNet; savBal += savNet;

    months.push({
      month: key, income, expenses, net: income - expenses,
      startBalance: prevCur + prevSav,
      endBalance:   curBal  + savBal,
      categories: catMap, transactions: txs,
    });
  }

  return {
    months, categories: cats, incomeCategories: ["Income"],
    categoryGroups: groups.map((g, i) => ({ id: `g${i}`, name: g, is_income: false, categories: [] })),
    catGroupMap, catIdMap: {},
    accountObjects: acctObjs, accounts: acctObjs.map(a => a.name),
    txsByAccount: { "demo-current": {}, "demo-savings": {} },
    startBalances: { "demo-current": 340000, "demo-savings": 620000 },
    accountMonthBals: {}, syncId: "demo",
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
interface Config {
  demo?: boolean;
  budgetId?: string;
  accountIds?: string[];
  typeOverrides?: Record<string, string>;
  password?: string;
}

interface LoadEntry { text: string; status: "ok"|"error"|"warn"|"pending"; detail?: string; }

export function useLoadData(config: Config | null) {
  const [loadLog,     setLoadLog]     = useState<LoadEntry[]>([]);
  const [appState,    setAppState]    = useState<AppState | null>(null);
  const [fatal,       setFatal]       = useState<string | null>(null);
  const [dataSavedAt, setDataSavedAt] = useState<number>(0);

  const appendLog  = (text: string, status: LoadEntry["status"] = "ok", detail = "") =>
    setLoadLog(l => [...l, {text,status,detail}]);
  const updateLast = (status: LoadEntry["status"], detail = "") =>
    setLoadLog(l => l.length ? [...l.slice(0,-1), {...l[l.length-1], status, detail}] : l);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    resetStateCache();
    setLoadLog([]); setFatal(null); setAppState(null);

    (async () => {
      // ── DEMO ─────────────────────────────────────────────────────────────
      if (config.demo) {
        appendLog("Generating demo data…","pending");
        await new Promise(r=>setTimeout(r,400));
        const rawData = generateDemo();
        updateLast("ok",`${rawData.months.length} months · demo`);
        const [sc,fl,cal] = await Promise.all([sGet(SK.sc),sGet(SK.flow),sGet(SK.cal)]) as any[];
        if (!cancelled) setAppState({
          data: rawData,
          scenarios: sc?.scenarios?.length>0 ? sc.scenarios : mkScenarios(rawData),
          groups:    sc?.groups || DEFAULT_GROUPS,
          markers:   fl?.markers || {},
          reconciliations: cal?.reconciliations || {},
        });
        return;
      }

      // ── REAL DATA ─────────────────────────────────────────────────────────
      // All Actual API calls go to /api/actual/... — server-side proxy,
      // API key lives in env vars, never touches the browser.
      const syncId  = config.budgetId!;
      const typeOvs = config.typeOverrides || {};
      const pw = config.password || (typeof sessionStorage !== "undefined" ? sessionStorage.getItem("cf-pw") ?? "" : "");
      const authHeaders: Record<string, string> = {};
      if (pw) authHeaders["x-dashboard-password"] = pw;
      const now     = new Date();
      const start   = new Date(); start.setMonth(start.getMonth()-23); start.setDate(1);
      const startStr = start.toISOString().slice(0,10);
      const endStr   = now.toISOString().slice(0,10);

      // Step 1: accounts
      appendLog("Loading accounts…","pending");
      let openAccounts: {id:string;name:string;type:string;offbudget?:boolean;closed?:boolean}[] = [];
      try {
        const r = await fetch(`/api/actual/v1/budgets/${syncId}/accounts`, { headers: authHeaders });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const all = j.data??j??[];
        const seen = new Set<string>();
        const unique = all.filter((a:any)=>{ if(!a.id||seen.has(a.id))return false; seen.add(a.id); return true; });
        openAccounts = (config.accountIds?.length
          ? unique.filter((a:any)=>config.accountIds!.includes(a.id))
          : unique.filter((a:any)=>!a.offbudget&&!a.closed))
          .map((a:any) => typeOvs[a.id]?{...a,type:typeOvs[a.id]}:a);
        updateLast("ok",`${openAccounts.length} accounts`);
      } catch(e:any) { updateLast("error",e.message); setFatal(`Could not load accounts: ${e.message}`); return; }
      if (!openAccounts.length) { setFatal("No accounts selected."); return; }

      // Step 2: categories + groups (parallel)
      appendLog("Loading categories…","pending");
      const catMap: Record<string,string> = {};
      const incomeCatIds = new Set<string>();
      let categoryGroups: any[] = [];
      try {
        const [catR, grpR] = await Promise.all([
          fetch(`/api/actual/v1/budgets/${syncId}/categories`, { headers: authHeaders }),
          fetch(`/api/actual/v1/budgets/${syncId}/categorygroups`, { headers: authHeaders }),
        ]);
        if (catR.ok) {
          const j = await catR.json();
          (j.data??j??[]).forEach((c:any)=>{ 
            if (c.hidden) return; // skip hidden categories
            catMap[c.id]=c.name; 
            if(c.is_income)incomeCatIds.add(c.id); 
          });
        }
        if (grpR.ok) {
          const j = await grpR.json();
          categoryGroups = (j.data??j??[])
            .filter((g:any)=>!g.hidden)
            .map((g:any)=>({...g, categories:(g.categories||[]).filter((c:any)=>!c.hidden)}));
          categoryGroups.forEach((g:any)=>{ if(g.is_income)(g.categories||[]).forEach((c:any)=>incomeCatIds.add(c.id)); });
        }
        updateLast("ok",`${Object.keys(catMap).length} categories · ${categoryGroups.length} groups`);
      } catch(e:any) { updateLast("warn",`Categories: ${e.message}`); }

      // Step 3: transactions per account
      appendLog("Fetching transactions…","pending");
      const txsByAccount: Record<string,Record<string,Transaction[]>> = {};
      const allTxByMonth: Record<string,{month:string;income:number;expenses:number;categories:Record<string,number>;transactions:Transaction[]}> = {};
      let totalTx = 0;

      for (const acct of openAccounts) {
        if (cancelled) return;
        appendLog(`  ${acct.name}…`,"pending");
        txsByAccount[acct.id] = {};
        try {
          const r = await fetch(`/api/actual/v1/budgets/${syncId}/accounts/${acct.id}/transactions?since_date=${startStr}&until_date=${endStr}`, { headers: authHeaders });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          const txs: any[] = j.data??j??[];

          // Expand splits, exclude transfers
          const expanded: any[] = [];
          const seenChildIds = new Set<string>();
          txs.forEach(tx => {
            if (tx.transfer_id) return;
            if (tx.subtransactions?.length > 0) {
              tx.subtransactions.forEach((child:any) => {
                seenChildIds.add(child.id);
                expanded.push({...tx, id:child.id, amount:child.amount??0, category:child.category, is_child:true, parent_id:tx.id});
              });
              return;
            }
            if (tx.is_parent === true) return;
            if (!seenChildIds.has(tx.id)) expanded.push(tx);
          });

          expanded.forEach(tx => {
            const mKey = tx.date?.slice(0,7); if (!mKey) return;
            if (!txsByAccount[acct.id][mKey]) txsByAccount[acct.id][mKey] = [];
            txsByAccount[acct.id][mKey].push({...tx, account:acct.name});
            if (!allTxByMonth[mKey]) allTxByMonth[mKey]={month:mKey,income:0,expenses:0,categories:{},transactions:[]};
            const amt = tx.amount??0;
            const catId = typeof tx.category==="string"?tx.category:tx.category?.id;
            const cat = catMap[catId]||(catId?`Cat:${catId.slice(0,6)}`:"Uncategorized");
            const isIncome = incomeCatIds.has(catId)||(!catId&&amt>0);
            if (isIncome) allTxByMonth[mKey].income += amt;
            else if (amt<0) allTxByMonth[mKey].expenses += Math.abs(amt);
            allTxByMonth[mKey].categories[cat] = (allTxByMonth[mKey].categories[cat]||0)+amt;
            allTxByMonth[mKey].transactions.push({
              id:tx.id, date:tx.date,
              payee:tx.payee?.name||tx.payee_name||tx.imported_payee||"—",
              category:cat, amount:amt, account:acct.name, isIncome,
            });
          });
          totalTx += expanded.length;
          updateLast("ok",`${expanded.length} tx`);
        } catch(e:any) { updateLast("warn",`Skipped — ${e.message}`); }
      }

      // Step 4: start balances (parallel)
      appendLog("Fetching start balances…","pending");
      const startBalances: Record<string,number> = {};
      const allMonthKeys = Object.keys(allTxByMonth).sort();
      const firstStart   = allMonthKeys.length ? `${allMonthKeys[0].slice(0,7)}-01` : startStr;
      const anchor = new Date(firstStart); anchor.setDate(anchor.getDate()-1);
      const anchorStr = anchor.toISOString().slice(0,10);
      await Promise.all(openAccounts.map(async acct => {
        try {
          const r = await fetch(`/api/actual/v1/budgets/${syncId}/accounts/${acct.id}/balance?cutoff=${anchorStr}`, { headers: authHeaders });
          if (r.ok) { const j=await r.json(); startBalances[acct.id]=j.data?.balance??j.balance??0; }
          else startBalances[acct.id] = 0;
        } catch { startBalances[acct.id] = 0; }
      }));
      updateLast("ok", openAccounts.map(a=>`${a.name}: ${new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format((startBalances[a.id]??0)/100)}`).join(" · "));

      // Step 5: load saved state + compute balances
      appendLog("Computing balances…","pending");
      const [sc,fl,cal] = await Promise.all([sGet(SK.sc),sGet(SK.flow),sGet(SK.cal)]) as any[];
      const reconciliations = cal?.reconciliations || {};
      // Store the timestamp this data was saved — Dashboard uses it to detect stale writes
      const dataSavedAt: number = sc?._savedAt ?? 0;

      const accountMonthBals: Record<string,Record<string,{start:number;end:number;net:number;calcEnd:number}>> = {};
      for (const acct of openAccounts) {
        accountMonthBals[acct.id] = {};
        let runBal = startBalances[acct.id] ?? 0;
        const recs = reconciliations[acct.id] || {};
        for (const mKey of allMonthKeys) {
          const net = (txsByAccount[acct.id]?.[mKey]||[]).reduce((s:number,tx:any)=>s+(tx.amount||0),0);
          const calcEnd = runBal + net;
          const end = recs[mKey] !== undefined ? recs[mKey] : calcEnd;
          accountMonthBals[acct.id][mKey] = {start:runBal,end,net,calcEnd};
          runBal = end;
        }
      }

      const months: Month[] = allMonthKeys.map(mKey => {
        const m = allTxByMonth[mKey];
        const startBalance = openAccounts.reduce((s,a)=>s+(accountMonthBals[a.id]?.[mKey]?.start??0),0);
        const endBalance   = openAccounts.reduce((s,a)=>s+(accountMonthBals[a.id]?.[mKey]?.end??0),0);
        const accountEndBals: Record<string,number> = {};
        openAccounts.forEach(a=>{ accountEndBals[a.id]=accountMonthBals[a.id]?.[mKey]?.end??0; });
        return { ...m, net:m.income-m.expenses, startBalance, endBalance, accountEndBals };
      });

      if (!months.length) { setFatal("No transactions found."); return; }

      // Sort categories by group order
      const groupOrder: Record<string,number> = {};
      const catGroupMap: Record<string,string> = {};
      categoryGroups.forEach((g:any,gi:number) => {
        (g.categories||[]).forEach((c:any,ci:number) => {
          const name = catMap[c.id]||c.name;
          groupOrder[name] = gi*1000+ci;
          catGroupMap[name] = g.name;
        });
      });
      const allCats = [...new Set(months.flatMap(m=>Object.keys(m.categories)))]
        .sort((a,b)=>{ const oa=groupOrder[a]??99999,ob=groupOrder[b]??99999; return oa!==ob?oa-ob:a.localeCompare(b); });
      const incomeCatNames = [...incomeCatIds].map(id=>catMap[id]).filter(Boolean);

      updateLast("ok",`${months.length} months · ${totalTx} tx · ${allCats.length} categories`);

      const rawData: AppData = {
        months, categories:allCats, incomeCategories:incomeCatNames,
        categoryGroups, catGroupMap, catIdMap:catMap,
        accountObjects:openAccounts.map(a=>({id:a.id,name:a.name,type:a.type||"other"})),
        accounts:openAccounts.map(a=>a.name),
        txsByAccount, startBalances, accountMonthBals, syncId,
      };

      appendLog("Ready","ok");
      await new Promise(r=>setTimeout(r,350));
      if (!cancelled) {
        setAppState({
          data: rawData,
          scenarios: sc?.scenarios?.length>0 ? sc.scenarios : mkScenarios(rawData),
          groups:    sc?.groups || DEFAULT_GROUPS,
          markers:   fl?.markers || {},
          reconciliations,
        });
        setDataSavedAt(dataSavedAt);
      }
    })();

    return () => { cancelled = true; };
  }, [config]);

  return { loadLog, appState, setAppState, fatal, dataSavedAt };
}
