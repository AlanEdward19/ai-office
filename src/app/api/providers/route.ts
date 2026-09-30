import { PROVIDER_LABELS } from "@/domain/providers";
import { detectAuthenticatedProviders } from "@/server/local-logins";

export const dynamic = "force-dynamic";

export async function GET() {
  const ids = await detectAuthenticatedProviders();
  return Response.json({
    providers: ids.map((id) => ({ id, label: PROVIDER_LABELS[id] })),
  });
}
