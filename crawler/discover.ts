import * as cheerio from "cheerio";

/** Lists every course page path linked from the /courses/ index, sorted and deduplicated. */
export function coursePaths(indexHtml: string): string[] {
  const $ = cheerio.load(indexHtml);
  const paths = new Set<string>();
  $("a[href^='/courses/']").each((_, a) => {
    const slug = /^\/courses\/([a-z0-9]+-[a-z0-9]+)\/?$/.exec(
      $(a).attr("href") ?? "",
    )?.[1];
    if (slug) paths.add(`/courses/${slug}/`);
  });
  return [...paths].sort();
}
