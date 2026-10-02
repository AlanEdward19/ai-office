import { beatLanOffice } from "@/server/lan-bridge";

export const dynamic = "force-dynamic";

/** Heartbeat from an open page. Names only — this route does not hand out an address. */
export function GET() {
  return Response.json({ peers: beatLanOffice() });
}
