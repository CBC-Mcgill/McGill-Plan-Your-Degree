import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

export const BASE_URL = "https://coursecatalogue.mcgill.ca";
// The site's WAF answers generic User-Agents with an HTTP 202 challenge page.
export const USER_AGENT =
  "Mozilla/5.0 (compatible; McGillPlanYourDegreeBot/0.1; +https://github.com/CBC-Mcgill/McGill-Plan-Your-Degree)";

const MIN_INTERVAL_MS = 500;
const MAX_ATTEMPTS = 5;
const CACHE_DIR = ".cache/catalogue";
// ponytail: cache freshness is one fixed window, make it a flag if anyone needs older resumes.
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

let lastRequestAt = 0;

async function politeFetch(url: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    let reason: string;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 200) return await res.text();
      if (res.status === 404) throw new NotFoundError(url);
      reason = `HTTP ${res.status}`;
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      reason = error instanceof Error ? error.message : String(error);
    }
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`${url}: ${reason} after ${attempt} attempts`);
    }
    await sleep(2 ** attempt * 1000);
  }
}

export class NotFoundError extends Error {
  constructor(url: string) {
    super(`${url}: HTTP 404`);
  }
}

function cachePath(path: string): string {
  const name = path.replace(/^\/|\/$/g, "").replaceAll("/", "_") || "index";
  return join(CACHE_DIR, `${name}.html`);
}

/** Fetches a catalogue path, reusing a recent cached copy so an interrupted run can resume. */
export async function fetchPage(path: string): Promise<string> {
  const file = cachePath(path);
  const cached = await stat(file).catch(() => null);
  if (cached && Date.now() - cached.mtimeMs < CACHE_MAX_AGE_MS) {
    return readFile(file, "utf8");
  }
  const html = await politeFetch(BASE_URL + path);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, html);
  return html;
}
