import { loadCatalogue } from "@/lib/catalogue/server";
import type { CourseSummary } from "@/lib/catalogue/types";

export const dynamic = "force-static";

/** The whole catalogue without descriptions and notes, which the browser does not need. */
export async function GET() {
  const summaries: CourseSummary[] = [];
  for (const { description, notes, ...summary } of (
    await loadCatalogue()
  ).values()) {
    summaries.push(summary);
  }
  return Response.json(summaries);
}
