import { expect, type Page, test } from "@playwright/test";

const year = new Date().getFullYear();

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: year - 2 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

/** A profile with `records` done, starting two years ago and graduating in three. No program unless `programId` names one. */
async function seedProfile(
  page: Page,
  records: ReturnType<typeof done>[],
  plan: { term: { season: string; year: number }; courses: string[] }[] = [],
  programId: string | null = null,
) {
  await page.addInitScript(
    ([key, state]) => {
      // Only the first load seeds, so a reload keeps what the test saved.
      if (localStorage.getItem(key as string)) return;
      localStorage.setItem(
        key as string,
        JSON.stringify({ state, version: 1 }),
      );
    },
    [
      "plan-your-degree:profile",
      {
        records,
        programId,
        startTerm: { season: "Fall", year: year - 2 },
        graduationTerm: { season: "Winter", year: year + 3 },
        plan,
        creditLimit: 17,
        importedAt: null,
      },
    ],
  );
}

test("starting without a transcript opens the path on the next term to plan", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.goto("/plan");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Plan every term to graduation",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");

  await page
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  await expect(
    page.getByRole("link", { name: "Pick your program" }),
  ).toHaveAttribute("href", "/profile#program");
  const terms = page.getByRole("tablist", { name: "Terms" }).getByRole("tab");
  await expect(terms.first()).toHaveAccessibleName(/^Fall 2026/);
  await expect(terms.first()).toHaveAttribute("aria-selected", "false");
  await expect(terms.nth(1)).toHaveAccessibleName(/^Winter 2027/);
  await expect(terms.nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Graduation", { exact: true })).toBeVisible();

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

test("the headline lists one row per open requirement, with missing courses linking to their pages", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 202")], [], "computer-engineering-beng");
  await page.goto("/plan");

  const missing = page.getByRole("region", {
    name: /^Your plan is \d+ credits short$/,
  });
  await expect(missing).toContainText("7 requirements still open");
  const rows = missing.getByRole("listitem");
  await expect(rows).toHaveCount(6);
  await expect(
    rows.filter({ hasText: "Technical complementaries" }),
  ).toContainText("Any 9 credits from List A or List B · See choices");
  await missing.getByRole("button", { name: "Show 1 more" }).click();
  await expect(rows).toHaveCount(7);
  await expect(rows.last()).toContainText("Elective course");

  const course = rows
    .filter({ hasText: "Required computer engineering courses" })
    .getByRole("link", { name: "ECSE 250" });
  await expect(course).toHaveAttribute("href", "/courses/ecse-250");
  await course.click();
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Fundamentals of Software Development",
    }),
  ).toBeVisible();
});

test("a course placed before its prerequisite warns until it is moved later", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 202"), done("MATH 240")]);
  await page.goto("/plan");

  const fall = `Fall ${year + 1}`;
  await page.getByRole("tab", { name: new RegExp(`^${fall}`) }).click();
  const search = page.getByRole("combobox", {
    name: `Add a course to ${fall}`,
  });
  await search.fill("COMP 251");
  await page.getByRole("option", { name: /COMP 251/ }).click();
  const warnings = page.getByRole("list", { name: "Warnings" });
  await expect(warnings).toContainText(
    "COMP 251 needs COMP 250 in an earlier term",
  );
  await expect(page.getByText("1 warning", { exact: true })).toBeVisible();

  // The same term is not earlier.
  await search.fill("COMP 250");
  await page.getByRole("option", { name: /COMP 250/ }).click();
  await expect(warnings).toContainText("COMP 251 needs COMP 250");

  await page
    .getByRole("button", { name: "Move COMP 250 to another term" })
    .click();
  await page
    .getByRole("menuitem", { name: new RegExp(`^Winter ${year + 1}`) })
    .click();
  await expect(
    page.getByRole("heading", { name: `Winter ${year + 1}` }),
  ).toBeFocused();
  await expect(warnings).toHaveCount(0);

  // Undo brings the course back, and the panel follows it.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("heading", { name: fall })).toBeFocused();
  await expect(warnings).toContainText("COMP 251 needs COMP 250");
});

test("the add box highlights the first course it can add and explains the rest", async ({
  page,
}) => {
  await seedProfile(page, [done("COMP 250")]);
  await page.goto("/plan");

  const search = page.getByRole("combobox", { name: /^Add a course to/ });
  await search.fill("comp 25");
  const taken = page.getByRole("option", { name: /COMP 250/ });
  await expect(taken).toHaveAttribute("aria-disabled", "true");
  await expect(taken).toHaveAttribute("aria-selected", "false");
  const first = page.getByRole("option", { selected: true });
  await expect(first).toHaveAccessibleName(/COMP 251/);

  // Arrow keys wrap around and never land on the taken course.
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowDown");
  await expect(taken).toHaveAttribute("aria-selected", "false");
  await expect(first).toHaveAccessibleName(/COMP 251/);

  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("list", { name: "Planned courses" }),
  ).toContainText("COMP 251");

  // With nothing to add, Enter says why.
  await search.fill("comp 250");
  await page.keyboard.press("Enter");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "COMP 250 is already completed" }),
  ).toBeVisible();
});

test("the credit limit is edited from the term load and kept after a reload", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  const winter = { season: "Winter", year: 2027 };
  await seedProfile(
    page,
    [done("COMP 202")],
    [{ term: winter, courses: ["COMP 250"] }],
  );
  await page.goto("/plan");
  const panel = page.getByRole("tabpanel");
  await expect(panel).toContainText("3 of 17 credits");

  await page.getByRole("button", { name: "Credit limit, 17" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Full time is 12 credits or more.",
  );
  await page.getByRole("spinbutton", { name: "Credit limit" }).fill("2");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Credit limit, 2" }),
  ).toBeFocused();
  await expect(panel).toContainText("3 of 2 credits, over your limit");
  await expect(
    page.getByRole("tab", { name: /^Winter 2027/ }),
  ).toHaveAccessibleName(/with warnings/);

  await page.reload();
  await expect(page.getByRole("tabpanel")).toContainText(
    "3 of 2 credits, over your limit",
  );
});
