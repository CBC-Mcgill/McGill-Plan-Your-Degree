import { loadPrograms } from "@/lib/programs/server";
import type { ProgramSummary } from "@/lib/programs/types";

export const dynamic = "force-static";

/** Name, degree, faculty, level and credits of every program, for the picker and the transcript guess. */
export async function GET() {
  const summaries: ProgramSummary[] = [];
  for (const { id, name, degree, faculty, level, credits } of (
    await loadPrograms()
  ).values()) {
    summaries.push({
      id,
      name,
      degree,
      faculty,
      credits,
      ...(level && { level }),
    });
  }
  return Response.json(summaries);
}
