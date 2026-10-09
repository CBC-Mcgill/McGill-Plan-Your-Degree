import * as cheerio from "cheerio";

const PROGRAMS = /^\/en\/undergraduate\/[^/]+\/programs\/.+\/$/;
// Faculty paths that list the same programs under a second name come last, so the faculty's own page wins.
const SHARED_FACULTY = "/arts-science/";

/** Lists program page paths from the sitemap, leaving out department index pages that only link to deeper pages. */
export function programPaths(sitemapXml: string): string[] {
  const $ = cheerio.load(sitemapXml, { xml: true });
  const all = $("loc")
    .map((_, loc) => new URL($(loc).text().trim()).pathname)
    .get()
    .filter((path) => PROGRAMS.test(path));
  const pages = all.filter(
    (path) => !all.some((o) => o !== path && o.startsWith(path)),
  );
  const bySlug = new Map<string, string>();
  for (const path of pages.sort(
    (a, b) =>
      Number(a.includes(SHARED_FACULTY)) - Number(b.includes(SHARED_FACULTY)) ||
      (a < b ? -1 : 1),
  )) {
    const slug = path.split("/").at(-2) ?? "";
    if (!bySlug.has(slug)) bySlug.set(slug, path);
  }
  return [...bySlug.values()].sort();
}
