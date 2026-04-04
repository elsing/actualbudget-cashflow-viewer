"use client";
import { useState, useEffect } from "react";
import { sGet, currentMonthKey, resetStateCache } from "@/lib/helpers";
import { SK, DEFAULT_GROUPS } from "@/lib/constants";
import { mkScenarios } from "@/lib/finance";
import type { AppState, AppData, Month, Transaction } from "@/types";

// ── Demo data ─────────────────────────────────────────────────────────────────
function generateDemo(): AppData {
  const cats = ["Housing","Food & Dining","Transport","Entertainment","Healthcare","Shopping","Utilities","Subscriptions"];
  const now  = new Date();
  const acctObjs = [
    {id:"demo-current",name:"Current",     type:"checking"},
    {id:"demo-cc",     name:"Credit Card", type:"credit"},
  ];
  const months: Month[] = [];
  let curBal = 150000, ccBal = 0;

  for (let i=23; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const income = 860000 + Math.round((Math.random()-.25)*100000);
    const catExp: Record<string,number> = {
      Housing:195000, "Food & Dining":58000+Math.round((Math.random()-.5)*22000),
      Transport:36000+Math.round((Math.random()-.5)*12000),
      Entertainment:22000+Math.round((Math.random()-.5)*18000),
      Healthcare:12000+Math.round(Math.random()*28000),
      Shopping:48000+Math.round((Math.random()-.5)*38000),
      Utilities:22000+Math.round((Math.random()-.5)*5000),
      Subscriptions:8500,
    };
    const expenses = Object.values(catExp).reduce((a,b)=>a+b,0);
    const txs: Transaction[] = [
      {id:`${key}-rent`, date:`${key}-01`,payee:"Landlord",   category:"Housing",       amount:-195000,account:"Current",     isIncome:false},
      {id:`${key}-g1`,   date:`${key}-03`,payee:"Tesco",      category:"Food & Dining", amount:-Math.round(14000+Math.random()*8000),account:"Current"},
      {id:`${key}-g2`,   date:`${key}-05`,payee:"Tesco",      category:"Food & Dining", amount:-Math.round(8000+Math.random()*5000), account:"Current"},
      {id:`${key}-fuel`, date:`${key}-07`,payee:"BP Fuel",    category:"Transport",     amount:-Math.round(4000+Math.random()*3000), account:"Current"},
      {id:`${key}-nf`,   date:`${key}-08`,payee:"Netflix",    category:"Subscriptions", amount:-1499,  account:"Credit Card"},
      {id:`${key}-sp`,   date:`${key}-09`,payee:"Spotify",    category:"Subscriptions", amount:-999,   account:"Credit Card"},
      {id:`${key}-sal`,  date:`${key}-10`,payee:"Employer",   category:"Income",        amount:income, account:"Current",isIncome:true},
      {id:`${key}-amz`,  date:`${key}-11`,payee:"Amazon",     category:"Shopping",      amount:-Math.round(6000+Math.random()*20000),account:"Credit Card"},
      {id:`${key}-edf`,  date:`${key}-12`,payee:"EDF Energy", category:"Utilities",     amount:-Math.round(8000+Math.random()*4000), account:"Current"},
      {id:`${key}-g3`,   date:`${key}-14`,payee:"Tesco",      category:"Food & Dining", amount:-Math.round(9000+Math.random()*5000), account:"Current"},
      {id:`${key}-boots`,date:`${key}-17`,payee:"Boots",      category:"Healthcare",    amount:-Math.round(1500+Math.random()*8000), account:"Credit Card"},
      {id:`${key}-gym`,  date:`${key}-18`,payee:"Gym",        category:"Entertainment", amount:-3500,  account:"Current"},
      {id:`${key}-g4`,   date:`${key}-22`,payee:"Tesco",      category:"Food & Dining", amount:-Math.round(7000+Math.random()*4000), account:"Current"},
      {id:`${key}-water`,date:`${key}-25`,payee:"Thames Water",category:"Utilities",   amount:-Math.round(3000+Math.random()*1000), account:"Current"},
      {id:`${key}-del`,  date:`${key}-27`,payee:"Deliveroo",  category:"Food & Dining", amount:-Math.round(2500+Math.random()*2000), account:"Current"},
    ];
    const catMap: Record<string,number> = {};
    txs.forEach(tx=>{ catMap[tx.category]=(catMap[tx.category]||0)+tx.amount; });
    const curNet = txs.filter(t=>t.account==="Current").reduce((a,t)=>a+t.amount,0);
    const ccNet  = txs.filter(t=>t.account==="Credit Card").reduce((a,t)=>a+t.amount,0);
    const prev = {cur:curBal,cc:ccBal};
    curBal+=curNet; ccBal+=ccNet;
    months.push({ month:key, income, expenses, net:income-expenses,
      startBalance:prev.cur+prev.cc, endBalance:curBal+ccBal,
      categories:catMap, transactions:txs });
  }

  return {
    months, categories:cats, incomeCategories:["Income"],
    categoryGroups:[], catGroupMap:{}, catIdMap:{},
    accountObjects:acctObjs, accounts:acctObjs.map(a=>a.name),
    txsByAccount:{"demo-current":{},"demo-cc":{}},
    startBalances:{"demo-current":150000,"demo-cc":0},
    accountMonthBals:{}, syncId:"demo",
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
  const [loadLog,  setLoadLog]  = useState<LoadEntry[]>([]);
  const [appState, setAppState] = useState<AppState | null>(null);
  const [fatal,    setFatal]    = useState<string | null>(null);

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
          (j.data??j??[]).forEach((c:any)=>{ catMap[c.id]=c.name; if(c.is_income)incomeCatIds.add(c.id); });
        }
        if (grpR.ok) {
          const j = await grpR.json();
          categoryGroups = (j.data??j??[]).filter((g:any)=>!g.hidden);
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
      if (!cancelled) setAppState({
        data: rawData,
        scenarios: sc?.scenarios?.length>0 ? sc.scenarios : mkScenarios(rawData),
        groups:    sc?.groups || DEFAULT_GROUPS,
        markers:   fl?.markers || {},
        reconciliations,
      });
    })();

    return () => { cancelled = true; };
  }, [config]);

  return { loadLog, appState, setAppState, fatal };
}
