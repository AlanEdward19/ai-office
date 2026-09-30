import { machineDisplayName } from "@/server/office-channel";

export const dynamic = "force-dynamic";

export async function GET() {
  const name = await machineDisplayName();
  return Response.json({ name });
}
