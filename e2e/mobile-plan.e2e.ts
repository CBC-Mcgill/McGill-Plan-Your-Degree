import { expect, type Locator, type Page, test } from "@playwright/test";

const record = (
  code: string,
  season: string,
  year: number,
  status: string,
) => ({
  code,
  term: { season, year },
  credits: 3,
  grade: status === "completed" ? "A" : null,
  status,
  source: "transcript",
});

async function seed(page: Page) {
  await page.addInitScript(
    ([key, state]) => {
      if (localStorage.getItem(key as string)) return;
      localStorage.setItem(
        key as string,
        JSON.stringify({ state, version: 1 }),
      );
    },
    [
      "plan-your-degree:profile",
      {
        records: [
          record("COMP 202", "Fall", 2025, "completed"),
          record("ECSE 200", "Fall", 2025, "completed"),
          record("ECSE 222", "Winter", 2026, "completed"),
          record("ECSE 206", "Fall", 2026, "in-progress"),
        ],
        programId: "computer-engineering-beng",
        startTerm: { season: "Fall", year: 2025 },
        graduationTerm: { season: "Winter", year: 2028 },
        plan: [
          {
            term: { season: "Winter", year: 2027 },
            courses: ["ECSE 308", "ECSE 324"],
          },
          { term: { season: "Fall", year: 2027 }, courses: ["ECSE 310"] },
        ],
        creditLimit: 17,
        importedAt: null,
      },
    ],
  );
}

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** Shown without hover, and at least 44px tall to tap. */
async function expectTappable(control: Locator) {
  await control.scrollIntoViewIfNeeded();
  await expect(control).toBeInViewport();
  await expect(control).toHaveCSS("opacity", "1");
  expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44);
}

/** The selected term sits inside the strip's visible part, which scrolls sideways on its own. */
async function expectSelectedInStrip(page: Page) {
  await expect
    .poll(() =>
      page
        .getByRole("tablist", { name: "Terms" })
        .getByRole("tab", { selected: true })
        .evaluate((tab) => {
          const strip = tab.closest("[role=tablist]")?.parentElement;
          if (!strip) return false;
          const outer = strip.getBoundingClientRect();
          const inner = tab.getBoundingClientRect();
          return inner.left >= outer.left && inner.right <= outer.right;
        }),
    )
    .toBe(true);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00"));
});

test("on a phone a visitor can start a plan and gets the term strip", async ({
  page,
}) => {
  await page.goto("/plan");
  await page.getByRole("button", { name: "Start without a transcript" }).tap();

  const terms = page.getByRole("tablist", { name: "Terms" });
  await expect(terms).toHaveAttribute("aria-orientation", "horizontal");
  await expect(terms.getByRole("tab", { selected: true })).toHaveAccessibleName(
    /^Winter 2027/,
  );
  await expectSelectedInStrip(page);
  await expect(
    page.getByRole("combobox", { name: "Add a course to Winter 2027" }),
  ).toBeVisible();
  await expectNoSideScroll(page);
});

test("on a phone the plan fits, terms switch by tap and every course action works without hover", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/plan");

  await expect(
    page.getByRole("heading", { level: 1, name: /program credits/ }),
  ).toBeVisible();
  const missing = page.getByRole("region", {
    name: /^Your plan is \d+ credits short$/,
  });
  await expect(missing.getByText(/\d+ open/)).toBeVisible();
  await expect(missing.getByRole("listitem").first()).toContainText("to go");
  await expectNoSideScroll(page);

  // The strip scrolls inside itself and keeps the selected term in view.
  const strip = page.getByRole("tablist", { name: "Terms" });
  const heading = page.locator("#term-heading");
  await expect(strip.getByRole("tab", { selected: true })).toHaveAccessibleName(
    /^Winter 2027/,
  );
  await expectSelectedInStrip(page);
  await strip.getByRole("tab", { name: /^Fall 2026/ }).tap();
  await expect(heading).toHaveText("Fall 2026");
  await expect(page.getByRole("tabpanel")).toContainText("ECSE 206");
  await strip.getByRole("tab", { name: /^Winter 2027/ }).tap();
  await expect(heading).toHaveText("Winter 2027");

  const planned = page.getByRole("list", { name: "Planned courses" });
  const move = planned.getByRole("button", {
    name: "Move ECSE 308 to another term",
  });
  await expectTappable(move);
  await expectTappable(
    planned.getByRole("button", { name: /^Remove ECSE 324 from/ }),
  );
  await move.tap();
  await page.getByRole("menuitem", { name: /^Fall 2027/ }).tap();
  await expect(heading).toHaveText("Fall 2027");
  await expect(planned).toContainText("ECSE 308");
  await expectNoSideScroll(page);

  // Picking from the checklist pins Add to the bottom of the screen.
  const fill = page.getByRole("region", { name: "Fill Fall 2027" });
  await fill.getByRole("checkbox").first().tap();
  const add = fill.getByRole("button", { name: "Add 1 course" });
  await expect(add).toBeInViewport();
  await add.tap();
  await expect(planned.getByRole("listitem")).toHaveCount(3);

  // The search box is big enough that iOS does not zoom into it.
  const search = page.getByRole("combobox", {
    name: "Add a course to Fall 2027",
  });
  await expect(search).toHaveCSS("font-size", "16px");
  await search.tap();
  await search.fill("COMP 302");
  await page.getByRole("option", { name: /COMP 302/ }).tap();
  await expect(planned).toContainText("COMP 302");
  await expectNoSideScroll(page);
});
