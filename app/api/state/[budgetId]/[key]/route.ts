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
