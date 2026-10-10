import { expect, type Page, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

const seedStudent = (page: Page) =>
  page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: null,
            graduationTerm: { season: "Winter", year: 2028 },
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", [done("COMP 250"), done("MATH 240")]],
  );

const expectNoSideScroll = async (page: Page) =>
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);

test.beforeEach(({ page }) =>
  page.route("https://mcgill.courses/**", (route) => route.abort()),
);

test("a visitor on a phone browses stacked rows and opens a course by tap", async ({
  page,
}) => {
  await page.goto("/courses?q=comp+251");
  const list = page.getByRole("list", { name: "Courses" });
  const row = list.getByRole("listitem").filter({ hasText: "COMP 251" });
  await expect(row).toContainText("Algorithms and Data Structures");
  await expect(row).toContainText("3 cr");
  await expect(page.getByRole("table")).toBeHidden();
  await expectNoSideScroll(page);

  await row.tap();
  await expect(page).toHaveURL("/courses/comp-251");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Algorithms and Data Structures",
  );
  await expect(
    page.getByRole("link", { name: "Import your transcript" }),
  ).toBeInViewport();
  await expect(page.getByText("Offered", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Unlocks" })).toBeVisible();
  await expectNoSideScroll(page);
});

test("a student on a phone switches views, filters by tap and plans a course", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await seedStudent(page);
  await page.goto("/courses?q=comp+25");
  const rows = page
    .getByRole("list", { name: "Courses" })
    .getByRole("listitem");
  await expect(rows.filter({ hasText: "COMP 251" })).toBeVisible();

  await page.getByRole("tab", { name: "All" }).tap();
  await expect(page).toHaveURL(/view=all/);
  await expect(rows.filter({ hasText: "COMP 250" })).toContainText("Completed");

  await page.getByRole("button", { name: "Level" }).tap();
  const level = page.getByRole("checkbox", { name: "300" });
  await expect(level).toBeInViewport();
  await level.tap();
  await expect(page).toHaveURL(/level=300/);
  await page.keyboard.press("Escape");
  await expect(rows.filter({ hasText: "COMP 251" })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear Level" }).tap();
  await expect(page).not.toHaveURL(/level=/);
  await expectNoSideScroll(page);

  await rows.filter({ hasText: "COMP 251" }).tap();
  await expect(page).toHaveURL("/courses/comp-251");
  const add = page.getByRole("button", { name: "Add to Winter 2027" });
  await expect(add).toBeInViewport();
  await add.tap();
  await expect(page.getByText("Planned for Winter 2027")).toBeVisible();
  await expectNoSideScroll(page);

  await page.goto("/courses/ecse-458");
  await expect(
    page.getByRole("region", { name: "Prerequisites" }),
  ).toContainText("Locked");
  await expectNoSideScroll(page);
});
