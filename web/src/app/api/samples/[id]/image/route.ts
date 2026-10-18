import { getSample } from "@/lib/samples";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[a-z0-9_]{1,40}$/.test(id)) return new Response("Not found", { status: 404 });
  const s = await getSample(id);
  if (!s?.image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(s.image.bytes), { headers: { "Content-Type": s.image.type, "Cache-Control": "public, max-age=3600" } });
}
