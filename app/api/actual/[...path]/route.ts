import { NextRequest, NextResponse } from "next/server";
import { actualFetch } from "@/lib/actual";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return proxy(request, (await params).path, "POST", await request.text());
}

async function proxy(req: NextRequest, pathParts: string[], method: string, body?: string) {
  const path = "/" + pathParts.join("/");
  const qs   = req.nextUrl.search;
  try {
    const upstream = await actualFetch(`${path}${qs}`, { method, body: body || undefined });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
