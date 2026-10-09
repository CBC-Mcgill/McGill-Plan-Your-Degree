import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Program } from "./types.ts";

const DIR = join(process.cwd(), "data/programs");
const GENERATED_DIR = join(DIR, "generated");

let programs: Promise<ReadonlyMap<string, Program>> | undefined;

async function readDir(dir: string): Promise<Program[]> {
  const files = (await readdir(dir)).filter(
    (file) => file.endsWith(".json") && file !== "index.json",
  );
  return Promise.all(
    files.map(
      async (file) =>
        JSON.parse(await readFile(join(dir, file), "utf8")) as Program,
    ),
  );
}

async function read(): Promise<ReadonlyMap<string, Program>> {
  // Only the current catalogue year can be crawled, so the newest folder is the one to serve.
  const [latest] = (await readdir(GENERATED_DIR))
    .filter((dir) => /^\d{4}-\d{4}$/.test(dir))
    .sort()
    .reverse();
  const generated = latest ? await readDir(join(GENERATED_DIR, latest)) : [];
  // A hand-written file replaces the generated one for its id because it comes later in the map.
  return new Map([...generated, ...(await readDir(DIR))].map((p) => [p.id, p]));
}

/** Every program by id, read once per process. */
export function loadPrograms(): Promise<ReadonlyMap<string, Program>> {
  programs ??= read().catch((error) => {
    programs = undefined;
    throw error;
  });
  return programs;
}
