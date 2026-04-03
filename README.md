# Actual Budget — Cash Flow Dashboard

A personal finance dashboard built on top of [Actual Budget](https://actualbudget.org/). Connects to your Actual data via the HTTP API, adds multi-device persistence via a small SQLite companion server, and gives you richer cash flow analysis, scenario planning, and AI-powered insights than Actual's built-in views.

---

## Architecture

```
Browser (any device)
  └── Vite / built static files
        ├── /api/*     → proxied to  actual-http-api  :5007  (Actual's API)
        └── /cf-api/*  → proxied to  cashflow-api     :5008  (persistence)

cashflow-api :5008
  └── Express + SQLite  (data/cashflow.db)
       Stores: scenarios, markers, reconciliations, UI state, account type overrides
```

In **production**, `cashflow-api` also serves the built Vite app as static files — one container, one port, no separate web server needed.

---

## Quick start (development)

### Prerequisites
- Node.js 18+
- [actual-http-api](https://github.com/jhonderson/actual-http-api) running (Docker or local)

### 1. Start the persistence API

```bash
cd api
npm install
npm run dev        # starts on :5008
```

### 2. Start the dashboard

```bash
cd dashboard
npm install
npm run dev        # starts on :5173
```

Open **http://localhost:5173**. The API URL is auto-detected from the page hostname — just enter your Actual API key.

### Vite proxy config

Edit `vite.config.js` to point `/api` at your actual-http-api:

```js
"/api": {
  target: "http://YOUR_ACTUAL_HTTP_API_HOST:5007",
  changeOrigin: true,
  rewrite: path => path.replace(/^\/api/, ""),
},
```

---

## Production deployment (Docker)

```bash
# 1. Build the frontend
cd cashflow-dashboard
npm run build               # outputs to dist/

# 2. Place dist/ where cashflow-api can serve it
cp -r dist/ ../cashflow-api/dist/

# 3. Run everything
cd ..
docker compose -f cashflow-api/docker-compose.yml up -d
```

The dashboard is then available at **http://your-server:5008**.
The API URL shown on the connect screen auto-fills as `http://your-server:5007`.

### Environment variables (cashflow-api)

| Variable      | Default                | Description                              |
|---------------|------------------------|------------------------------------------|
| `PORT`        | `5008`                 | Port cashflow-api listens on             |
| `DB_PATH`     | `./data/cashflow.db`   | Path to the SQLite database file         |
| `API_KEY`     | *(unset)*              | Optional: require `x-cf-api-key` header  |
| `STATIC_DIR`  | `../dist`              | Where to serve the built frontend from   |

---

## Features

### Monthly Flow
- Per-account balance chart using real API balances — no accumulated error
- Account filter chips update month balances live (uses per-account data)
- Day-by-day chart for any selected month with transfer filtering
- Scenario projection overlay on the current month (and past months)
- Good/bad month marking with benchmark cards showing avg start + end balances
- Manual balance override (✎) on any month card — correction flows forward permanently

### Calibration
- Table view: accounts as rows, months as columns
- Click any cell to enter the real end-of-month balance
- Corrections flow forward through all subsequent months automatically — money cannot leak

### Scenarios
- Multiple scenarios with rename, reorder, colour picker on the tab bar
- Income types: by Actual category (avg or last month), all income, fixed, ±%
- Row types: Fixed £, % of income, Live avg (complete months), Last complete month
- Live avg uses **net** per category (income within a category reduces the expense)
- Transaction drill-down on any live/last row — see exactly which transactions are included
- 2- or 3-way scenario comparison

### Overview
- Income filter: pick which categories count as income
- Expense filter: narrow to specific categories
- Net uses calibrated balances when no filter, or income−expenses when filtered

### Categories
- Sorted largest first, grouped by Actual category groups
- Toggle between grouped and flat view

### AI Analysis
- Ollama (local LLM) integration
- Full analysis mode: trends, anomalies, payee patterns, forecast, actions
- Chat mode: ask specific questions about your transactions
- Good/bad markers and previous analyses fed as context automatically

---

## Data stored

All state is stored per `budgetId` so multiple budgets are isolated.

| Key           | Contents                                      | Storage  |
|---------------|-----------------------------------------------|----------|
| `cf-sc-v6`    | Scenarios + groups                            | DB + localStorage |
| `cf-flow-v5`  | Month markers (good/bad)                      | DB + localStorage |
| `cf-cal-v1`   | Reconciliation overrides                      | DB + localStorage |
| `cf-ui-v1`    | UI state (active tab, filters, ranges)        | DB + localStorage |
| `cf-conn-v1`  | Account type overrides                        | DB + localStorage |
| `cf-ol-v3`    | Ollama settings                               | DB + localStorage |
| `cf-connection` | API key, budget ID, account selection       | localStorage only (device-specific, contains credentials) |

---

## Source layout

```
cashflow-dashboard/src/
  App.jsx                     Root component, tab routing, persistent UI state
  constants.js                Colours, font, storage keys, account types
  helpers.js                  Formatters, storage (sGet/sSet), completeMonths
  finance.js                  Balance algorithm, scenario resolution, live averages
  hooks/
    useLoadData.js            All data fetching — accounts, categories, transactions, balances
  components/
    connect/
      ConnectionPanel.jsx     3-step wizard: key → budget → accounts
    tabs/
      MonthlyFlowTab.jsx      Main flow view, day-by-day chart, projection
      ScenariosTab.jsx        Scenario editor, income editor, row editor, compare
      OverviewTab.jsx         Overview + Categories tabs
      CalibrationTab.jsx      Per-account reconciliation table
      AITab.jsx               Ollama analysis + chat
    ui/
      index.jsx               Chip, ColorSwatch, ChartTip, RangeButtons

cashflow-api/
  server.js                   Express + SQLite — API + static file server
  package.json
  Dockerfile
  docker-compose.yml
```

---

## Notes

- **Split transactions** are handled correctly: parent records are excluded and children (with real categories) are used instead.
- **Transfer transactions** are excluded from all balance calculations and daily charts.
- **Complete months only** — all averages (live avg, income avg) exclude the current partial month and any month with no transactions.
- The **API URL** is always derived from the page's hostname automatically. No manual entry needed.
