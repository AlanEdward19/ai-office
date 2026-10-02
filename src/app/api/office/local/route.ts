import { findSession, reportLocalOffice } from "@/server/office-channel";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = findSession(request);
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  const result = reportLocalOffice(body);
  if (!result.ok) {
    const status = result.reason === "closed" ? 409 : 400;
    return Response.json({ error: result.reason }, { status });
  }
  return Response.json({ ok: true });
}
