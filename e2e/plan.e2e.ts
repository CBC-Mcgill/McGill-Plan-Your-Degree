import { expect, test } from "@playwright/test";

const year = new Date().getFullYear();

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: year - 2 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

test("starting without a transcript opens the path on the next term to plan", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { level: 1, name: "Planner" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");

  await page
    .getByRole("button", { name: "Start planning without one" })
    .click();
  const terms = page.getByRole("tablist", { name: "Terms" }).getByRole("tab");
  await expect(terms.first()).toHaveAccessibleName(/^Fall 2026/);
  await expect(terms.first()).toHaveAttribute("aria-selected", "false");
  await expect(terms.nth(1)).toHaveAccessibleName(/^Winter 2027/);
  await expect(terms.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(
    page
      .getByRole("tablist", { name: "Terms" })
      .getByText("Graduation", { exact: true }),
  ).toBeVisible();

  await terms.nth(1).focus();
  await page.keyboard.press("ArrowDown");
  await expect(terms.nth(2)).toHaveAttribute("aria-selected", "true");
  await expect(terms.nth(2)).toBeFocused();

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("a course placed before its prerequisite warns until it is moved later", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, records, start, graduation]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: start,
            graduationTerm: graduation,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    [
      "plan-your-degree:profile",
      [done("COMP 202"), done("MATH 240")],
      { season: "Fall", year: year - 2 },
      { season: "Winter", year: year + 3 },
    ],
  );
  await page.goto("/plan");

  const fall = `Fall ${year + 1}`;
  await page.getByRole("tab", { name: new RegExp(`^${fall}`) }).click();
  const search = page.getByRole("combobox", {
    name: `Add a course to ${fall}`,
  });
  await search.fill("COMP 251");
  await page.getByRole("option", { name: /^COMP 251/ }).click();
  const warnings = page.getByRole("list", { name: "Warnings" });
  await expect(warnings).toContainText(
    "COMP 251 needs COMP 250 in an earlier term",
  );

  // The same term is not earlier.
  await search.fill("COMP 250");
  await page.getByRole("option", { name: /^COMP 250/ }).click();
  await expect(warnings).toContainText("COMP 251 needs COMP 250");

  await page
    .getByRole("button", { name: "Move COMP 250 to another term" })
    .click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^Winter ${year + 1}`) })
    .click();
  await expect(warnings).toHaveCount(0);
});
