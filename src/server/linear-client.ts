import "server-only";

import { readLinearPage, type LinearProject } from "@/domain/rooms";

const ENDPOINT = "https://api.linear.app/graphql";

const QUERY = `
  query OfficeProjects($after: String) {
    viewer { name email }
    projects(first: 50, after: $after) {
      nodes { id name }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export class LinearRequestError extends Error {
  constructor(readonly code: "unauthorized" | "unavailable") {
    super(code);
    this.name = "LinearRequestError";
  }
}

export async function listLinearProjects(
  apiKey: string,
  signal?: AbortSignal,
): Promise<{ viewerName: string | null; projects: LinearProject[] }> {
  const projects: LinearProject[] = [];
  let viewerName: string | null = null;
  let after: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query: QUERY, variables: { after } }),
    });

    if (response.status === 401 || response.status === 403) {
      throw new LinearRequestError("unauthorized");
    }
    if (!response.ok) throw new LinearRequestError("unavailable");

    const payload: unknown = await response.json();
    if (
      payload &&
      typeof payload === "object" &&
      Array.isArray((payload as { errors?: unknown }).errors) &&
      !(payload as { data?: unknown }).data
    ) {
      throw new LinearRequestError("unavailable");
    }

    const parsed = readLinearPage(payload);
    if (!viewerName && parsed.viewerName) viewerName = parsed.viewerName;
    projects.push(...parsed.projects);
    if (!parsed.hasNextPage || !parsed.endCursor) break;
    after = parsed.endCursor;
  }

  return { viewerName, projects };
}
