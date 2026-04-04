# Actual Budget — Cash Flow Dashboard

A self-hosted personal finance dashboard built on [Actual Budget](https://actualbudget.org/). All Actual API calls are proxied server-side — your API key never reaches the browser.

Built with **Next.js 16**, **TypeScript**, and **Node.js built-in SQLite** (`node:sqlite`). No native dependencies.

Claude AI coded the project, with me providing the direction for it. I am aware there are a few bugs here and there, but on the whole it works.

---

## Quick start

```bash
# 1. Configure
cp .env.local.example .env.local
# Edit .env.local — set ACTUAL_API_URL and ACTUAL_API_KEY

# 2. Install and run
npm install
npm run dev     # http://localhost:3000
```

On first load, click **CONNECT →** to select your budget and accounts.

---

## Requirements

- **Node.js 24+**
- An [Actual-Budget](https://github.com/actualbudget/actual instance running

---

## Environment variables

Copy `.env.local.example` to `.env.local`:

```env
ACTUAL_API_URL=http://localhost:5007   # URL of your actual-http-api
ACTUAL_API_KEY=your-key-here          # API key for actual-http-api
DB_PATH=./data/cashflow.db            # Optional — defaults to ./data/cashflow.db
```

These are **server-only** — Next.js never sends them to the browser.

---

## Production (Docker)

```bash
docker compose up -d
# Dashboard at http://your-server:3000
```

The `docker-compose.yml` includes `actual-http-api` (but it is commented out by default) and the dashboard. Set your values in a `.env` file alongside `docker-compose.yml`:

```env
ACTUAL_SERVER_URL=http://actual-server:5006
ACTUAL_SERVER_PASSWORD=your-password
ACTUAL_API_KEY=your-api-key
```

---

## Architecture

```
Browser (any device)
  └── Next.js :3000
        ├── React UI (components/)          — client components
        ├── /api/actual/[...path]           — server-side proxy → actual-http-api
        ├── /api/state/[budgetId]/[key]     — SQLite persistence
        └── /api/health                     — health check
```

**Why server-side proxy?** The API key lives in `.env.local` on the server. The browser only ever calls `/api/actual/...` on your own domain — Actual's URL and key are never exposed in network requests.

**Why `node:sqlite`?** No native compilation, no prebuilt binary issues across platforms/Node versions. Ships with Node.js 22.5+.

---

## Features

### Monthly Flow
- Real account balances from the Actual API — no accumulated error
- Account filter chips recompute month totals live using per-account data
- Day-by-day chart with transfer filtering and scenario projection overlay
- Good/bad month marking with benchmark cards (avg start + end balance)
- Manual balance override (✎) on any month card — correction flows forward permanently

### Calibration
- Per-account reconciliation table: accounts as rows, months as columns
- Click any cell to enter the real end-of-month balance
- Corrections propagate forward through all subsequent months — money cannot leak

### Scenarios
- Multiple scenarios with rename, reorder, and colour picker on the tab bar
- Income types: by Actual category (avg or last month + fixed top-up), all income, fixed, ±%
- Row types: Fixed £, % of income, Live avg (complete months only), Last complete month
- Live avg uses **net** per category — income within a category (e.g. flatmate rent) reduces the expense
- Transaction drill-down on any live/last row — see exactly which transactions feed the figure
- 2- or 3-way scenario comparison

### Scenario Projection (📅 tab)
- Pick which scenario to project
- Starting balance defaults to the **start of the most recent complete month** (before any transactions) — editable with a reset button
- Income day auto-detected from historical transaction dates — editable with a reset button
- Every row has a day-of-month picker; live/last rows show their auto-detected day alongside
- All settings persist across tab switches and page reloads via the database
- Net change and final balance shown at the bottom

### Overview
- Income filter: pick which categories count as income
- Expense filter: narrow to specific categories
- Net uses calibrated balances when no filter, or income−expenses when filtered

### Categories
- Sorted by average monthly spend (largest first)
- Grouped by Actual category groups; toggle between grouped and flat view

### AI Analysis
- Ollama (local LLM) integration — no data leaves your machine
- Full analysis mode: trends, anomalies, payee patterns, 3-month forecast, actions
- Chat mode: ask specific questions about your transactions
- Good/bad markers and previous analyses included as context automatically

---

## Data persistence

All state is stored per `budgetId` in SQLite, so multiple budgets are isolated.

| Key            | Contents                                    | Scope              |
|----------------|---------------------------------------------|--------------------|
| `cf-sc-v6`     | Scenarios + groups                          | DB + localStorage  |
| `cf-flow-v5`   | Month markers (good/bad)                    | DB + localStorage  |
| `cf-cal-v1`    | Reconciliation overrides per account        | DB + localStorage  |
| `cf-ui-v1`     | UI state: active tab, filters, ranges, projection settings | DB + localStorage |
| `cf-conn-v1`   | Account type overrides                      | DB + localStorage  |
| `cf-ol-v3`     | Ollama settings                             | DB + localStorage  |
| `cf-connection`| Budget ID, account selection                | localStorage only (device-specific, no secrets) |

The server-side DB is the source of truth. localStorage is a fallback when the server is unreachable, and a migration source for first-time syncs.

---

## Project structure

```
cashflow/
  app/
    page.tsx                          Entry point
    layout.tsx                        Root layout (fonts, metadata)
    globals.css                       Global styles + mobile breakpoints
    api/
      health/route.ts                 Health check (also verifies DB)
      actual/[...path]/route.ts       Server-side proxy to actual-http-api
      state/[budgetId]/route.ts       Load all persisted state
      state/[budgetId]/[key]/route.ts Get / set / delete one key
  components/
    Dashboard.tsx                     Root client component — tab routing, uiState
    connect/
      ConnectionPanel.tsx             Budget + account selection (3-step wizard)
    tabs/
      MonthlyFlowTab.tsx              Balance chart, day-by-day view, projection
      ScenariosTab.tsx                Editor, row editor, compare, projection
      OverviewTab.tsx                 Overview + Categories tabs
      CalibrationTab.tsx              Per-account reconciliation table
      AITab.tsx                       Ollama analysis + chat
    ui/
      index.tsx                       Chip, ColorSwatch, ChartTip, RangeButtons
  hooks/
    useLoadData.ts                    Data fetching: accounts → categories → transactions → balances
  lib/
    db.ts                             SQLite singleton + typed query helpers
    actual.ts                         Typed server-side Actual API client
    constants.ts                      Design tokens, storage keys, account types
    helpers.ts                        Formatters, sGet/sSet, completeMonths
    finance.ts                        Scenario resolution, live averages, mkScenarios
  types/
    index.ts                          Shared TypeScript interfaces
```

---

## Balance algorithm

For each account:
1. Fetch the real API balance at the day *before* the first month in the 24-month window (the anchor)
2. Walk forward month by month: `end = start + sum(account's non-transfer transactions)`
3. Reconciliation overrides replace the calculated end for a specific account+month — all subsequent months flow from the corrected value

**What's excluded from transactions:**
- Transfers (`transfer_id` set) — they cancel across accounts
- Parent split transactions (`is_parent: true` or `subtransactions` present) — children are used instead, which carry real categories and correct amounts

**Complete months only** — all averages (live avg, income avg, AI analysis) exclude the current partial month and any month with no recorded transactions.

---

## Notes

- The API URL shown at connection is auto-detected from the page hostname — no manual entry needed in production
- Account types set in the wizard are synced to the database and restored on any device
- Scenario projection uses start-of-month balance (before bills), not end-of-month
