import { NextRequest, NextResponse } from "next/server";
import { dbGetOne, dbUpsert, dbDelete } from "@/lib/db";

type Ctx = { params: Promise<{ budgetId: string; key: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const { budgetId, key } = await params;
    const value = dbGetOne(budgetId, key);
    if (value === null) return NextResponse.json({ ok: false, value: null }, { status: 404 });
    try { return NextResponse.json({ ok: true, value: JSON.parse(value) }); }
    catch { return NextResponse.json({ ok: true, value }); }
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const { budgetId, key } = await params;
    const body = await req.json();

    // Optimistic concurrency: if the client sends an `_loadedAt` timestamp,
    // only apply the write if the DB record's `_savedAt` matches.
    // This prevents an old session from overwriting a newer session's changes.
    if (typeof body._loadedAt === "number") {
      const existing = dbGetOne(budgetId, key);
      if (existing !== null) {
        try {
          const parsed = JSON.parse(existing) as Record<string, unknown>;
          const dbSavedAt = typeof parsed._savedAt === "number" ? parsed._savedAt : 0;
          if (dbSavedAt > body._loadedAt) {
            return NextResponse.json(
              { ok: false, conflict: true, dbSavedAt },
              { status: 409 }
            );
          }
        } catch {}
      }
      // Strip _loadedAt from what gets stored — it's only a concurrency token
      delete body._loadedAt;
    }

    dbUpsert(budgetId, key, JSON.stringify(body));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const { budgetId, key } = await params;
    dbDelete(budgetId, key);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
