import { expect, test } from "vitest";
import { bugReportUrl } from "./github.ts";

test("the bug report link opens the form with the page and browser filled in", () => {
  const url = new URL(
    bugReportUrl({ page: "/courses?q=comp 251", browser: "Mozilla/5.0 (X11)" }),
  );
  expect(url.pathname).toBe("/CBC-Mcgill/McGill-Plan-Your-Degree/issues/new");
  expect(url.searchParams.get("template")).toBe("bug_report.yml");
  expect(url.searchParams.get("page")).toBe("/courses?q=comp 251");
  expect(url.searchParams.get("browser")).toBe("Mozilla/5.0 (X11)");

  const plain = new URL(bugReportUrl({}));
  expect(plain.searchParams.get("template")).toBe("bug_report.yml");
  expect(plain.searchParams.has("page")).toBe(false);
  expect(plain.searchParams.has("browser")).toBe(false);
});
