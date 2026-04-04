/**
 * Database layer — Node.js built-in SQLite (node:sqlite, stable since Node 22.5/24).
 * No native compilation, no extra dependencies.
 *
 * Pattern: singleton DatabaseSync instance cached on globalThis so Next.js
 * hot-reload doesn't open multiple connections during development.
 * Statements are prepared fresh per-call — node:sqlite StatementSync instances
 * are lightweight and not safe to share across async boundaries.
 */
import { DatabaseSync } from "node:sqlite";
import path from "path";
import fs from "fs";

// ── Config ────────────────────────────────────────────────────────────────────
const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(process.cwd(), "data", "cashflow.db");

// ── Singleton ─────────────────────────────────────────────────────────────────
declare global {
  // eslint-disable-next-line no-var
  var __cashflow_db: DatabaseSync | undefined;
}

function openDb(): DatabaseSync {
  if (global.__cashflow_db) return global.__cashflow_db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  const db = new DatabaseSync(DB_PATH);

  // WAL mode: concurrent reads, non-blocking writes
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA synchronous = NORMAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS state (
      budget_id TEXT    NOT NULL,
      key       TEXT    NOT NULL,
      value     TEXT    NOT NULL,
      updated   INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (budget_id, key)
    );
  `);

  global.__cashflow_db = db;
  return db;
}

export function getDb(): DatabaseSync {
  return openDb();
}

// ── Query helpers ─────────────────────────────────────────────────────────────
// Each function prepares a fresh statement — safe for concurrent Next.js requests.

export function dbGetAll(budgetId: string): { key: string; value: string }[] {
  return getDb()
    .prepare("SELECT key, value FROM state WHERE budget_id = ?")
    .all(budgetId) as { key: string; value: string }[];
}

export function dbGetOne(budgetId: string, key: string): string | null {
  const row = getDb()
    .prepare("SELECT value FROM state WHERE budget_id = ? AND key = ?")
    .get(budgetId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function dbUpsert(budgetId: string, key: string, value: string): void {
  getDb()
    .prepare(`
      INSERT INTO state (budget_id, key, value, updated)
      VALUES (?, ?, ?, unixepoch())
      ON CONFLICT (budget_id, key)
      DO UPDATE SET value = excluded.value, updated = excluded.updated
    `)
    .run(budgetId, key, value);
}

export function dbDelete(budgetId: string, key: string): void {
  getDb()
    .prepare("DELETE FROM state WHERE budget_id = ? AND key = ?")
    .run(budgetId, key);
}
