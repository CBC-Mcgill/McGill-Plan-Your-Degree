import { expect, test } from "@playwright/test";

const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test("the palette puts a named page first and keeps focus where the student is", async ({
  page,
}) => {
  await page.goto("/", { waitUntil: "networkidle" });
  const opener = page.getByRole("button", { name: /Search courses/ });
  await opener.focus();
  await page.keyboard.press("Enter");

  await page.getByRole("combobox").fill("plan");
  const first = page.getByRole("option").first();
  await expect(first).toHaveAccessibleName("Planner");
  await expect(first).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();

  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("plan");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/plan$/);
  await expect(page.getByRole("main")).toBeFocused();
});

test("the palette finds What's next by its old name and says each course's status", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, record]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({ state: { records: [record] }, version: 4 }),
      ),
    [
      "plan-your-degree:profile",
      {
        code: "COMP 250",
        term: { season: "Fall", year: 2025 },
        credits: 3,
        grade: "A",
        status: "completed",
        source: "manual",
      },
    ],
  );
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  const input = page.getByRole("combobox");

  await input.fill("requirements");
  await expect(page.getByRole("option").first()).toHaveAccessibleName(
    "What's next",
  );

  await input.fill("comp 250");
  await expect(page.getByRole("option").first()).toContainText("Completed");
});

test("the palette opens on recent courses, newest first, then required courses for next term", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: { records, programId: "computer-science-major-bsc" },
          version: 4,
        }),
      ),
    [
      "plan-your-degree:profile",
      ["COMP 202", "COMP 206", "COMP 250"].map((code) => ({
        code,
        term: { season: "Fall", year: 2025 },
        credits: 3,
        grade: "A",
        status: "completed",
        source: "manual",
      })),
    ],
  );
  await page.goto("/courses/comp-302", { waitUntil: "networkidle" });
  await page.goto("/courses/math-240", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");

  const recent = page
    .getByRole("group", { name: "Recent" })
    .getByRole("option");
  await expect(recent).toHaveCount(2);
  await expect(recent.first()).toContainText("MATH 240");
  await expect(recent.first()).toHaveAttribute("aria-selected", "true");
  await expect(
    page
      .getByRole("group", { name: "Suggested for Winter 2027" })
      .getByRole("option")
      .first(),
  ).toContainText("Can take");
  await expect(page.getByRole("group", { name: "Pages" })).toBeVisible();
});

test("the course list keeps the header search, the shortcut opens the palette and / focuses the list's field", async ({
  page,
}) => {
  await page.goto("/courses", { waitUntil: "networkidle" });
  await expect(page.locator("header kbd")).toHaveCount(1);
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  await expect(page.getByRole("searchbox")).toBeFocused();
});

test("the palette says when courses fail to load, outside the listbox", async ({
  page,
}) => {
  await page.route("**/catalogue.json", (route) => route.abort());
  await page.goto("/", { waitUntil: "networkidle" });
  await page.keyboard.press("Control+k");
  await page.getByRole("combobox").fill("comp");
  await expect(page.getByRole("dialog").getByRole("status")).toHaveText(
    "Could not load courses",
  );
  await expect(page.getByRole("listbox")).toHaveCount(0);
});

test("the shortcut hint follows the platform", async ({ browser }) => {
  for (const [userAgent, hint] of [
    [WINDOWS, "Ctrl K"],
    [MAC, "⌘K"],
  ] as const) {
    const context = await browser.newContext({ userAgent });
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.locator("header kbd")).toHaveText(hint);
    await context.close();
  }
});
