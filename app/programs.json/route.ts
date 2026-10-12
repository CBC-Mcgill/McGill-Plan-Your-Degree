import { loadPrograms } from "@/lib/programs/server";
import type { ProgramSummary } from "@/lib/programs/types";

export const dynamic = "force-static";

/** Name, degree, faculty and level of every program, for the picker and the transcript guess. */
export async function GET() {
  const summaries: ProgramSummary[] = [];
  for (const { id, name, degree, faculty, level } of (
    await loadPrograms()
  ).values()) {
    summaries.push({ id, name, degree, faculty, ...(level && { level }) });
  }
  return Response.json(summaries);
}
