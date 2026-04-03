import { useState, useEffect } from "react";
import { sGet, currentMonthKey, resetStateCache } from "../helpers.js";
import { SK } from "../constants.js";
import { mkScenarios } from "../finance.js";
import { DEFAULT_GROUPS } from "../constants.js";

// ── Demo ──────────────────────────────────────────────────────────────────────
function generateDemo() {
  const cats = ["Housing","Food & Dining","Transport","Entertainment","Healthcare","Shopping","Utilities","Subscriptions"];
  const now = new Date();
  // accountObjects with id, name, type
  const acctObjs = [
    {id:"demo-current",name:"Current",type:"checking",offbudget:false},
    {id:"demo-cc",name:"Credit Card",type:"credit",offbudget:false},
  ];
  const months = [];
  // per-account running balances
  let curBal = 150000, ccBal = 0;

  for (let i=23; i>=0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const dIM = new Date(d.getFullYear(), d.getMonth()+1, 0).getDate();
    const income = 860000 + Math.round((Math.random()-.25)*100000);
    const catExp = {
      Housing: 195000,
      "Food & Dining": 58000+Math.round((Math.random()-.5)*22000),
      Transport: 36000+Math.round((Math.random()-.5)*12000),
      Entertainment: 22000+Math.round((Math.random()-.5)*18000),
      Healthcare: 12000+Math.round(Math.random()*28000),
      Shopping: 48000+Math.round((Math.random()-.5)*38000),
      Utilities: 22000+Math.round((Math.random()-.5)*5000),
      Subscriptions: 8500,
    };
    const expenses = Object.values(catExp).reduce((a,b)=>a+b,0);

    // Credit card spend this month
    const ccSpend = catExp.Subscriptions + catExp.Shopping + Math.round(catExp.Healthcare*0.5);
    const ccPayment = ccBal; // pay off last month's balance

    // Transactions
    const txs = [
      {id:`${key}-pay`,date:`${key}-01`,payee:"Credit Card Payment",category:null,amount:-ccPayment,account:"Current",transfer_id:`${key}-cc-pay`},
      {id:`${key}-cc-pay`,date:`${key}-01`,payee:"Credit Card Payment",category:null,amount:ccPayment,account:"Credit Card",transfer_id:`${key}-pay`},
      {id:`${key}-rent`,date:`${key}-01`,payee:"Landlord",category:"Housing",amount:-195000,account:"Current",transfer_id:null},
      {id:`${key}-g1`,date:`${key}-03`,payee:"Tesco",category:"Food & Dining",amount:-Math.round(14000+Math.random()*8000),account:"Current",transfer_id:null},
      {id:`${key}-g2`,date:`${key}-05`,payee:"Tesco",category:"Food & Dining",amount:-Math.round(8000+Math.random()*5000),account:"Current",transfer_id:null},
      {id:`${key}-fuel`,date:`${key}-07`,payee:"BP Fuel",category:"Transport",amount:-Math.round(4000+Math.random()*3000),account:"Current",transfer_id:null},
      {id:`${key}-nf`,date:`${key}-08`,payee:"Netflix",category:"Subscriptions",amount:-1499,account:"Credit Card",transfer_id:null},
      {id:`${key}-sp`,date:`${key}-09`,payee:"Spotify",category:"Subscriptions",amount:-999,account:"Credit Card",transfer_id:null},
      {id:`${key}-sal`,date:`${key}-10`,payee:"Employer",category:"Income",amount:income,account:"Current",transfer_id:null,isIncome:true},
      {id:`${key}-amz`,date:`${key}-11`,payee:"Amazon",category:"Shopping",amount:-Math.round(6000+Math.random()*20000),account:"Credit Card",transfer_id:null},
      {id:`${key}-edf`,date:`${key}-12`,payee:"EDF Energy",category:"Utilities",amount:-Math.round(8000+Math.random()*4000),account:"Current",transfer_id:null},
      {id:`${key}-g3`,date:`${key}-14`,payee:"Tesco",category:"Food & Dining",amount:-Math.round(9000+Math.random()*5000),account:"Current",transfer_id:null},
      {id:`${key}-boots`,date:`${key}-17`,payee:"Boots",category:"Healthcare",amount:-Math.round(1500+Math.random()*8000),account:"Credit Card",transfer_id:null},
      {id:`${key}-gym`,date:`${key}-18`,payee:"Gym",category:"Entertainment",amount:-3500,account:"Current",transfer_id:null},
      {id:`${key}-g4`,date:`${key}-22`,payee:"Tesco",category:"Food & Dining",amount:-Math.round(7000+Math.random()*4000),account:"Current",transfer_id:null},
      {id:`${key}-water`,date:`${key}-25`,payee:"Thames Water",category:"Utilities",amount:-Math.round(3000+Math.random()*1000),account:"Current",transfer_id:null},
      {id:`${key}-del`,date:`${key}-27`,payee:"Deliveroo",category:"Food & Dining",amount:-Math.round(2500+Math.random()*2000),account:"Current",transfer_id:null},
    ];

    // Non-transfer transactions only for balance calc
    const nonTransfer = txs.filter(t=>!t.transfer_id);
    const curTxs = nonTransfer.filter(t=>t.account==="Current");
    const ccTxs  = nonTransfer.filter(t=>t.account==="Credit Card");
    const curNet = curTxs.reduce((a,t)=>a+t.amount,0);
    const ccNet  = ccTxs.reduce((a,t)=>a+t.amount,0);

    const prevCurBal = curBal; const prevCcBal = ccBal;
    curBal += curNet; ccBal += ccNet;

    // Build category map (net signed)
    const catMap = {};
    nonTransfer.forEach(tx => {
      if (!tx.category) return;
      catMap[tx.category] = (catMap[tx.category]||0) + tx.amount;
    });

    const net = income - expenses;
    months.push({
      month: key,
      income,
      expenses,
      net,
      // total across both accounts
      startBalance: prevCurBal + prevCcBal,
      endBalance: curBal + ccBal,
      categories: catMap,
      transactions: nonTransfer,
      // per-account
      accountStartBals: {"demo-current":prevCurBal,"demo-cc":prevCcBal},
      accountEndBals:   {"demo-current":curBal,"demo-cc":ccBal},
    });
  }

  return {
    months,
    categories: cats,
    incomeCategories: ["Income"],
    accountObjects: acctObjs,
    accounts: acctObjs.map(a=>a.name),
    // txsByAccount for calibration
    txsByAccount: {
      "demo-current": {},
      "demo-cc": {},
    },
    startBalances: {"demo-current":150000,"demo-cc":0},
  };
}

// ── Main hook ─────────────────────────────────────────────────────────────────
export function useLoadData(config) {
  const [loadLog,  setLoadLog]  = useState([]);
  const [appState, setAppState] = useState(null);
  const [fatal,    setFatal]    = useState(null);

  const appendLog   = (text,status="ok",detail="") => setLoadLog(l=>[...l,{text,status,detail}]);
  const updateLast  = (status,detail="") => setLoadLog(l=>l.length?[...l.slice(0,-1),{...l[l.length-1],status,detail}]:l);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    resetStateCache(); // clear cached state so we reload for this budgetId
    setLoadLog([]); setFatal(null); setAppState(null);

    (async () => {
      // ── DEMO ───────────────────────────────────────────────────────────────
      if (config.demo) {
        appendLog("Generating demo data…","pending");
        await new Promise(r=>setTimeout(r,400));
        const rawData = generateDemo();
        updateLast("ok",`${rawData.months.length} months · demo`);
        const [sc,fl,cal] = await Promise.all([sGet(SK.sc),sGet(SK.flow),sGet(SK.cal)]);
        if (!cancelled) setAppState({
          data: rawData,
          scenarios: sc?.scenarios?.length>0 ? sc.scenarios : mkScenarios(rawData),
          groups: sc?.groups || DEFAULT_GROUPS,
          markers: fl?.markers || {},
          reconciliations: cal?.reconciliations || {},
        });
        return;
      }

      // ── REAL DATA ──────────────────────────────────────────────────────────
      const h = {"x-api-key": config.apiKey};
      const syncId = config.budgetId;
      const typeOvs = config.typeOverrides || {};

      // Date range: 24 months back
      const end = new Date();
      const start = new Date(); start.setMonth(start.getMonth()-23); start.setDate(1);
      const startStr = start.toISOString().slice(0,10);
      const endStr   = end.toISOString().slice(0,10);

      // Step 1: accounts
      appendLog("Loading accounts…","pending");
      let openAccounts = [];
      try {
        const r = await fetch(`${config.apiUrl}/v1/budgets/${syncId}/accounts`,{headers:h});
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        const all = j.data??j??[];
        const seen = new Set();
        const unique = all.filter(a => {
          if (!a.id||seen.has(a.id)) return false;
          seen.add(a.id); return true;
        });
        openAccounts = config.accountIds?.length>0
          ? unique.filter(a=>config.accountIds.includes(a.id))
          : unique.filter(a=>!a.offbudget&&!a.closed);
        // Apply user type overrides
        openAccounts = openAccounts.map(a => typeOvs[a.id]?{...a,type:typeOvs[a.id]}:a);
        updateLast("ok",`${openAccounts.length} accounts`);
      } catch(e) {
        updateLast("error",e.message);
        setFatal(`Could not load accounts: ${e.message}`); return;
      }
      if (!openAccounts.length) { setFatal("No accounts selected."); return; }

      // Step 2: categories + category groups
      appendLog("Loading categories…","pending");
      const catMap = {};
      const incomeCatIds = new Set();
      let categoryGroups = []; // [{id, name, is_income, categories:[{id,name}]}]
      try {
        const [catR, grpR] = await Promise.all([
          fetch(`${config.apiUrl}/v1/budgets/${syncId}/categories`,{headers:h}),
          fetch(`${config.apiUrl}/v1/budgets/${syncId}/categorygroups`,{headers:h}),
        ]);
        if (catR.ok) {
          const j = await catR.json();
          (j.data??j??[]).forEach(c => {
            catMap[c.id] = c.name;
            if (c.is_income) incomeCatIds.add(c.id);
          });
        }
        if (grpR.ok) {
          const j = await grpR.json();
          categoryGroups = (j.data??j??[]).filter(g => !g.hidden);
          // Also register income cats from groups
          categoryGroups.forEach(g => {
            if (g.is_income) (g.categories||[]).forEach(c => incomeCatIds.add(c.id));
          });
        }
        updateLast("ok",`${Object.keys(catMap).length} categories · ${categoryGroups.length} groups (${incomeCatIds.size} income)`);
      } catch(e) {
        updateLast("warn",`Categories unavailable: ${e.message}`);
      }

      // Step 3: fetch transactions per account, build txsByAccount and month summaries
      appendLog("Fetching transactions…","pending");
      // txsByAccount[id][monthKey] = array of non-transfer transactions
      const txsByAccount = {};
      // allTxByMonth[monthKey] = { income, expenses, categories, transactions (all accounts) }
      const allTxByMonth = {};
      let totalTx = 0;

      for (const acct of openAccounts) {
        if (cancelled) return;
        appendLog(`  ${acct.name}…`,"pending");
        txsByAccount[acct.id] = {};
        try {
          const r = await fetch(
            `${config.apiUrl}/v1/budgets/${syncId}/accounts/${acct.id}/transactions?since_date=${startStr}&until_date=${endStr}`,
            {headers:h}
          );
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          const j = await r.json();
          const txs = (j.data??j??[]);
          // Expand split transactions: replace parent with its children.
          // Actual's API returns splits in two possible shapes:
          //   A) Parent has subtransactions[] inline, children not returned separately
          //   B) Parent + children returned as flat list with is_parent/is_child flags
          // We handle both: extract subtransaction children from parents (shape A),
          // and for shape B we just keep the children (is_child:true) and drop the parent.
          const expanded = [];
          const seenChildIds = new Set();

          txs.forEach(tx => {
            if (tx.transfer_id) return; // skip transfers entirely

            if (tx.subtransactions?.length > 0) {
              // Shape A — parent with embedded children. Use the children.
              tx.subtransactions.forEach(child => {
                seenChildIds.add(child.id);
                expanded.push({
                  ...tx,                        // inherit date, payee, account from parent
                  id:       child.id,
                  amount:   child.amount ?? 0,
                  category: child.category,     // real category on the child
                  is_child: true,
                  parent_id: tx.id,
                });
              });
              return; // don't add the parent itself
            }

            if (tx.is_parent === true) {
              // Shape B parent with no inline children — children come as separate records.
              // Skip the parent; the children will appear later in the loop.
              return;
            }

            // Normal transaction or shape-B child — include it
            if (!seenChildIds.has(tx.id)) {
              expanded.push(tx);
            }
          });

          const nonTransfer = expanded;

          nonTransfer.forEach(tx => {
            const mKey = tx.date?.slice(0,7); if (!mKey) return;
            // Per-account bucket
            if (!txsByAccount[acct.id][mKey]) txsByAccount[acct.id][mKey] = [];
            txsByAccount[acct.id][mKey].push({...tx, account:acct.name});
            // All-account month summary
            if (!allTxByMonth[mKey]) allTxByMonth[mKey] = {month:mKey,income:0,expenses:0,categories:{},transactions:[]};
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
          const parentSplits = txs.filter(tx=>tx.subtransactions?.length>0||tx.is_parent===true).length;
          const childCount   = nonTransfer.filter(tx=>tx.is_child).length;
          totalTx += nonTransfer.length;
          updateLast("ok",`${nonTransfer.length} tx · ${txs.filter(tx=>tx.transfer_id).length} transfers excluded · ${parentSplits} splits expanded (${childCount} children)`);
        } catch(e) {
          updateLast("warn",`Skipped — ${e.message}`);
        }
      }

      // Step 4: fetch starting balance for each account
      // The anchor is the real API balance at the day BEFORE the first month starts.
      appendLog("Fetching account start balances…","pending");
      const startBalances = {};
      const allMonthKeys = Object.keys(allTxByMonth).sort();
      const firstMonthStart = allMonthKeys.length ? `${allMonthKeys[0].slice(0,7)}-01` : startStr;
      // Use the day before first month as cutoff (gives balance at start of period)
      const anchorDate = new Date(firstMonthStart);
      anchorDate.setDate(anchorDate.getDate()-1);
      const anchorStr = anchorDate.toISOString().slice(0,10);

      await Promise.all(openAccounts.map(async acct => {
        try {
          const r = await fetch(
            `${config.apiUrl}/v1/budgets/${syncId}/accounts/${acct.id}/balance?cutoff=${anchorStr}`,
            {headers:h}
          );
          if (r.ok) {
            const j = await r.json();
            startBalances[acct.id] = j.data?.balance ?? j.balance ?? 0;
          } else startBalances[acct.id] = 0;
        } catch { startBalances[acct.id] = 0; }
      }));
      updateLast("ok", openAccounts.map(a=>`${a.name}: ${
        new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP",maximumFractionDigits:0}).format((startBalances[a.id]??0)/100)
      }`).join(" · "));

      // Step 5: load reconciliations, then compute per-account forward balances
      appendLog("Computing balances…","pending");
      const [sc,fl,cal] = await Promise.all([sGet(SK.sc),sGet(SK.flow),sGet(SK.cal)]);
      const reconciliations = cal?.reconciliations || {};

      // Walk forward per account
      const accountMonthBals = {}; // [acctId][mKey] = {start,end,net}
      for (const acct of openAccounts) {
        accountMonthBals[acct.id] = {};
        let runBal = startBalances[acct.id] ?? 0;
        const recs = reconciliations[acct.id] || {};
        for (const mKey of allMonthKeys) {
          const acctTxs = txsByAccount[acct.id]?.[mKey] || [];
          const net = acctTxs.reduce((s,tx)=>s+(tx.amount||0),0);
          const calcEnd = runBal + net;
          const end = recs[mKey] !== undefined ? recs[mKey] : calcEnd;
          accountMonthBals[acct.id][mKey] = { start:runBal, end, net, calcEnd };
          runBal = end;
        }
      }

      // Build month summaries with total balances across ALL accounts
      const months = allMonthKeys.map(mKey => {
        const m = allTxByMonth[mKey];
        const startBalance = openAccounts.reduce((s,a)=>s+(accountMonthBals[a.id]?.[mKey]?.start??0),0);
        const endBalance   = openAccounts.reduce((s,a)=>s+(accountMonthBals[a.id]?.[mKey]?.end??0),0);
        m.net = m.income - m.expenses;
        m.startBalance = startBalance;
        m.endBalance   = endBalance;
        m.accountEndBals = {};
        openAccounts.forEach(a=>{ m.accountEndBals[a.id]=accountMonthBals[a.id]?.[mKey]?.end??0; });
        return m;
      });

      if (!months.length) { setFatal("No transactions found in the last 24 months."); return; }

      // Sort categories by their group order from Actual, then A-Z within group
      const groupOrder = {};
      const catGroupMap = {}; // catName → groupName
      categoryGroups.forEach((g,gi) => {
        (g.categories||[]).forEach((c,ci) => {
          const name = catMap[c.id]||c.name;
          groupOrder[name] = gi*1000 + ci;
          catGroupMap[name] = g.name;
        });
      });
      const allCatsUnsorted = [...new Set(months.flatMap(m=>Object.keys(m.categories)))];
      const allCats = allCatsUnsorted.sort((a,b) => {
        const oa = groupOrder[a]??99999, ob = groupOrder[b]??99999;
        return oa!==ob ? oa-ob : a.localeCompare(b);
      });
      const incomeCatNames = [...incomeCatIds].map(id=>catMap[id]).filter(Boolean);

      updateLast("ok",`${months.length} months · ${totalTx} transactions · ${allCats.length} categories`);

      const rawData = {
        months,
        categories: allCats,
        incomeCategories: incomeCatNames,
        categoryGroups,
        catGroupMap,
        catIdMap: catMap,  // id→name at load time — for stable ID-based storage
        accountObjects: openAccounts.map(a=>({id:a.id,name:a.name,type:a.type||"other"})),
        accounts: openAccounts.map(a=>a.name),
        txsByAccount,
        startBalances,
        accountMonthBals, // [acctId][mKey] = {start,end,net,calcEnd}
        syncId,
        apiUrl: config.apiUrl,
        apiKey: config.apiKey,
      };

      appendLog("Ready","ok");
      await new Promise(r=>setTimeout(r,350));
      if (!cancelled) setAppState({
        data: rawData,
        scenarios: sc?.scenarios?.length>0 ? sc.scenarios : mkScenarios(rawData),
        groups: sc?.groups || DEFAULT_GROUPS,
        markers: fl?.markers || {},
        reconciliations,
      });
    })();

    return () => { cancelled = true; };
  }, [config]);

  return { loadLog, appState, setAppState, fatal };
}