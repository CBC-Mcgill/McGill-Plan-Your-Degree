import { expect, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

test("search finds COMP 251 and its page links the prerequisites", async ({
  page,
}) => {
  await page.goto("/courses");
  const search = page.getByRole("searchbox");
  await expect(search).toBeFocused();
  for (const query of ["comp251", "COMP 251", "comp 251"]) {
    await search.fill(query);
    await expect(page.locator("main li a").first()).toHaveAttribute(
      "href",
      "/courses/comp-251",
    );
  }
  await expect(page).toHaveURL(/q=comp\+251/);

  await page.locator("main li a").first().click();
  await expect(page).toHaveTitle(/COMP 251 Algorithms and Data Structures/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Algorithms and Data Structures",
  );
  await expect(
    page.getByRole("main").getByRole("link", { name: "COMP 250" }),
  ).toHaveAttribute("href", "/courses/comp-250");
  await expect(
    page.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
});

test("an unknown course is a 404", async ({ page }) => {
  const response = await page.goto("/courses/nope-999");
  expect(response?.status()).toBe(404);
});

test("with a profile, Available to me narrows the list and a course can be planned", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: null,
            startTerm: null,
            graduationTerm: null,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    ["plan-your-degree:profile", [done("COMP 250"), done("MATH 240")]],
  );
  await page.goto("/courses?q=comp+25");
  await expect(page.getByRole("searchbox")).toHaveValue("comp 25");
  const rows = page.locator("main li a");
  await expect(rows.filter({ hasText: "COMP 250" })).toBeVisible();

  await page.getByLabel("Status").selectOption("available");
  await expect(rows.filter({ hasText: "COMP 251" })).toBeVisible();
  await expect(rows.filter({ hasText: "COMP 250" })).toHaveCount(0);

  await rows.filter({ hasText: "COMP 251" }).click();
  await expect(page.getByLabel("Term")).toBeVisible();
  await page.getByRole("button", { name: "Add to plan" }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText(
    "Added to",
  );
  await expect(
    page.getByRole("link", { name: "View your plan" }),
  ).toHaveAttribute("href", "/plan");
});
