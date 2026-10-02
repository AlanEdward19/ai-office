import { ingestLanPeer } from "@/server/lan-bridge";

export const dynamic = "force-dynamic";

/** Another office on this LAN. The body is only accepted from a beacon heard on the local network. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const result = ingestLanPeer(body);
  if (result.ok) return new Response(null, { status: 204 });
  const status = result.reason === "invalid" ? 400 : result.reason === "forbidden" ? 403 : 409;
  return Response.json({ error: result.reason }, { status });
}
