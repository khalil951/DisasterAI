import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { checkServices, overall } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET ?demo=true checks the replay webhook instead of n8n (demo mode needs only that, and the service for entries). */
export async function GET(request: Request) {
  const cfg = getConfig();
  const demo = new URL(request.url).searchParams.get("demo") === "true";
  const rows = await checkServices(cfg, demo ? cfg.replayUrl : cfg.n8nUrl);
  return NextResponse.json({ rows, overall: overall(rows), demo });
}
