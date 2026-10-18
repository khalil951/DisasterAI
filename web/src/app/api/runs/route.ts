import { NextResponse } from "next/server";
import { listRuns } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 10, 1), 50);
  return NextResponse.json({ runs: await listRuns(limit) });
}
