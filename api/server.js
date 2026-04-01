/**
 * cashflow-api
 * Dev:  Vite proxies /cf-api/* here on :5008
 * Prod: This server also serves the built Vite dist/ as static files
 *       One container, one port — no separate web server needed.
 */

const express  = require("express");
const cors     = require("cors");
const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");

const PORT    = parseInt(process.env.PORT    || "5008");
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "data", "cashflow.db");
const API_KEY = process.env.API_KEY || null;
const STATIC  = process.env.STATIC_DIR || path.join(__dirname, "..", "dist");

// DB setup
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.exec(`
  CREATE TABLE IF NOT EXISTS state (
    budget_id TEXT NOT NULL,
    key       TEXT NOT NULL,
    value     TEXT NOT NULL,
    updated   INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (budget_id, key)
  );
`);

const stmtGetAll = db.prepare("SELECT key, value FROM state WHERE budget_id = ?");
const stmtUpsert = db.prepare(`
  INSERT INTO state (budget_id, key, value, updated)
  VALUES (?, ?, ?, unixepoch())
  ON CONFLICT (budget_id, key)
  DO UPDATE SET value = excluded.value, updated = excluded.updated
`);
const stmtDelete = db.prepare("DELETE FROM state WHERE budget_id = ? AND key = ?");

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    cb(null, false);
  },
}));
app.use(express.json({ limit: "10mb" }));

function auth(req, res, next) {
  if (!API_KEY) return next();
  const key = req.headers["x-cf-api-key"] || req.query.apiKey;
  if (key !== API_KEY) return res.status(401).json({ error: "Unauthorized" });
  next();
}

const api = express.Router();
api.use(auth);

api.get("/health", (req, res) =>
  res.json({ ok: true, db: DB_PATH, port: PORT })
);

api.get("/state/:budgetId", (req, res) => {
  try {
    const rows  = stmtGetAll.all(req.params.budgetId);
    const state = {};
    rows.forEach(r => {
      try { state[r.key] = JSON.parse(r.value); } catch { state[r.key] = r.value; }
    });
    res.json({ ok: true, state });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

api.patch("/state/:budgetId/:key", (req, res) => {
  try {
    stmtUpsert.run(req.params.budgetId, req.params.key, JSON.stringify(req.body));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

api.delete("/state/:budgetId/:key", (req, res) => {
  try {
    stmtDelete.run(req.params.budgetId, req.params.key);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use("/cf-api", api);

// Serve built Vite app in production
if (fs.existsSync(STATIC)) {
  app.use(express.static(STATIC));
  app.get("*", (req, res) => res.sendFile(path.join(STATIC, "index.html")));
  console.log("Serving static files from:", STATIC);
} else {
  console.log("No dist/ — API-only mode (dev)");
}

app.listen(PORT, () => {
  console.log(`cashflow-api :${PORT}  DB: ${DB_PATH}`);
  if (API_KEY) console.log("  Auth: x-cf-api-key required");
});
