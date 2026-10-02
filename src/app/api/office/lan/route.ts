import { officeLanAddresses } from "@/server/office-channel";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ urls: officeLanAddresses(3847) });
}
