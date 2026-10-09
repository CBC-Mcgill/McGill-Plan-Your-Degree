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

test("the planner add box skips taken courses and explains why", async ({
  page,
}) => {
  const year = new Date().getFullYear();
  const start = { season: "Fall", year: year - 2 };
  await page.addInitScript(
    ([key, term, graduation]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records: [
              {
                code: "COMP 250",
                term,
                credits: 3,
                grade: "A",
                status: "completed",
                source: "manual",
              },
            ],
            programId: null,
            startTerm: term,
            graduationTerm: graduation,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", start, { season: "Winter", year: year + 3 }],
  );
  await page.goto("/plan");

  const search = page.getByRole("combobox", { name: /^Add a course to/ });
  await search.fill("comp 25");
  const taken = page.getByRole("option", { name: /^COMP 250/ });
  await expect(taken).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "COMP 250 is already completed" }),
  ).toBeVisible();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowUp");
  await expect(taken).toHaveAttribute("aria-selected", "false");
});
