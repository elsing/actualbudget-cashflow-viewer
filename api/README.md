# Actual Budget Cash Flow Dashboard

## How it fits together

```
Browser
  └── Vite dev server :5173
        ├── /api/*     → proxied to actual-http-api  :5007  (your existing setup)
        └── /cf-api/*  → proxied to cashflow-api     :5008  (new — persistence)

cashflow-api :5008
  └── SQLite database (data/cashflow.db)
       stores: scenarios, markers, reconciliations, per budgetId
```

In **production** `cashflow-api` also serves the built Vite app as static files,
so you only need one port exposed.

---

## Development setup

### 1. Start cashflow-api

```bash
cd cashflow-api
npm install
npm run dev        # starts on :5008
```

### 2. Start the dashboard

```bash
cd cashflow-dashboard
npm install
npm install recharts
npm run dev        # starts on :5173
```

Edit `vite.config.js` to point `/api` at your actual-http-api IP:

```js
"/api": {
  target: "http://YOUR_ACTUAL_HTTP_API_IP:5007",
  ...
}
```

Open http://localhost:5173 — the header will show **● SYNCED** when
cashflow-api is reachable, or **⚠ LOCAL ONLY** if it isn't (still works,
just no cross-device sync).

---

## Production (Docker)

Build the dashboard first, copy dist into the right place, then run one container:

```bash
# 1. Build the Vite app
cd cashflow-dashboard
npm run build           # outputs to dist/

# 2. Copy dist next to cashflow-api so it can serve it
cp -r dist/ ../cashflow-api/dist/

# 3. Run with Docker Compose
cd ..
docker compose -f cashflow-api/docker-compose.yml up -d
```

The app is then available at **http://your-server:5008** — no Vite, no proxy,
one process serving both the API and the frontend.

### Environment variables

| Variable    | Default                  | Description                        |
|-------------|--------------------------|-----------------------------------|
| `PORT`      | `5008`                   | Port to listen on                 |
| `DB_PATH`   | `./data/cashflow.db`     | Path to SQLite file               |
| `API_KEY`   | *(not set)*              | Optional auth key for the API     |
| `STATIC_DIR`| `../dist`                | Where to serve built frontend from|

---

## Data stored

Everything is stored per `budgetId` so multiple Actual budgets are isolated:

| Key              | Contents                              |
|------------------|---------------------------------------|
| `cf-sc-v6`       | Scenarios + groups                    |
| `cf-flow-v5`     | Month markers (good/bad)              |
| `cf-cal-v1`      | Reconciliation overrides              |
| `cf-ol-v3`       | Ollama AI settings                    |

The `cf-connection` key (API URL, key, account selection) stays in
localStorage only — it's device-specific and contains credentials.

---

## Multi-device sync

Once cashflow-api is running on a server, point every device at it.
State loads from the server on connect and saves back on every change.
If the server is unreachable, the app falls back to localStorage automatically.
