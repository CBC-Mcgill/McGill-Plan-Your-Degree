import { loadPrograms } from "@/lib/programs/server";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  return [...(await loadPrograms()).keys()].map((id) => ({ id }));
}

/** One program with its requirements, so the browser downloads only the one the student picked. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/programs/[id]">,
) {
  const program = (await loadPrograms()).get((await params).id);
  return program ? Response.json(program) : new Response(null, { status: 404 });
}
