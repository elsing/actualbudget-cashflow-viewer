import { NextRequest, NextResponse } from "next/server";
import { dbGetAll } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ budgetId: string }> }
) {
  try {
    const { budgetId } = await params;
    const rows = dbGetAll(budgetId);
    const state: Record<string, unknown> = {};
    for (const row of rows) {
      try { state[row.key] = JSON.parse(row.value); }
      catch { state[row.key] = row.value; }
    }
    return NextResponse.json({ ok: true, state });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
