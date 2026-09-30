import { listLinearProjects, LinearRequestError } from "@/server/linear-client";

export const dynamic = "force-dynamic";

export async function GET() {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ projects: [], viewerName: null, error: "missing_key" });
  }

  try {
    const result = await listLinearProjects(apiKey);
    return Response.json({ ...result, error: null });
  } catch (error) {
    const code = error instanceof LinearRequestError ? error.code : "unavailable";
    return Response.json({ projects: [], viewerName: null, error: code });
  }
}
