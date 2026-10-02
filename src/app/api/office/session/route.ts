import { findSession, readSessionToken, sessionCookie, signInOffice } from "@/server/office-channel";
import type { OfficeRole } from "@/domain/office-share";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = findSession(request);
  if (!session) return Response.json({ error: "signed_out" }, { status: 401 });
  return Response.json({ role: session.role, name: session.name });
}

export async function POST(request: Request) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const requested = record.intent === "colleague" ? "observer" : record.intent;
  const intent: OfficeRole | null =
    requested === "host" || requested === "interact" || requested === "observer" ? requested : null;
  if (!intent) return Response.json({ error: "name_required" }, { status: 400 });
  const name = typeof record.name === "string" ? record.name : "";
  const result = await signInOffice({
    intent,
    name,
    token: readSessionToken(request.headers.get("cookie")),
  });
  if (!result.ok) {
    const status = result.reason === "name_required" ? 400 : 409;
    return Response.json({ error: result.reason }, { status });
  }
  return new Response(JSON.stringify({ role: result.role, name: result.name }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": sessionCookie(result.token),
    },
  });
}
