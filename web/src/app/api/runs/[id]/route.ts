import { NextResponse } from "next/server";
import { getRun } from "@/lib/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = await getRun(id);
  if (!record) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  return NextResponse.json({ id, record });
}
