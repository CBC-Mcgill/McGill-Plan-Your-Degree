import { loadPrograms } from "@/lib/programs/server";
import type { ProgramSummary } from "@/lib/programs/types";

export const dynamic = "force-static";

/** Name, degree and faculty of every program, for the picker and the transcript guess. */
export async function GET() {
  const summaries: ProgramSummary[] = [];
  for (const { id, name, degree, faculty } of (await loadPrograms()).values()) {
    summaries.push({ id, name, degree, faculty });
  }
  return Response.json(summaries);
}
