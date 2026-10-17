const REPO = "CBC-Mcgill/McGill-Plan-Your-Degree";
export const REPO_URL = `https://github.com/${REPO}`;

/** The repo's star count, fetched on the server and cached for an hour, so visitors' browsers never call GitHub. Null when GitHub is unreachable. */
export async function githubStars(): Promise<number | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}`, {
      next: { revalidate: 3600 },
    });
    if (!response.ok) return null;
    const { stargazers_count: stars } = (await response.json()) as {
      stargazers_count?: unknown;
    };
    return typeof stars === "number" ? stars : null;
  } catch {
    return null;
  }
}

/** A new-issue link that opens the bug form with the page and browser already filled in. GitHub hosts any screenshot the student pastes there. */
export function bugReportUrl(fields: {
  page?: string;
  browser?: string;
}): string {
  const params = new URLSearchParams({ template: "bug_report.yml" });
  for (const [field, value] of Object.entries(fields)) {
    if (value) params.set(field, value);
  }
  return `${REPO_URL}/issues/new?${params}`;
}
