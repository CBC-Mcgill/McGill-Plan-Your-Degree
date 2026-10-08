import { expect, test } from "@playwright/test";

test("a student imports a transcript, adds a course, and sees it in the plan", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.goto("/profile");
  await page
    .locator('input[accept*="pdf"]')
    .setInputFiles("lib/transcript/fixtures/simple-record.pdf");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/next");

  const row = page
    .getByRole("region", { name: "Must take" })
    .getByRole("listitem")
    .filter({ hasText: "COMP 251" });
  await row.getByRole("button", { name: "Add to Winter 2027" }).click();
  await expect(row.getByRole("link", { name: /Planned/ })).toBeVisible();

  await page.getByRole("link", { name: "Planner" }).click();
  await expect(page).toHaveURL("/plan");
  await page.getByRole("tab", { name: /^Winter 2027/ }).click();
  await expect(
    page.getByRole("button", { name: "Remove COMP 251 from Winter 2027" }),
  ).toBeVisible();

  await expect(
    page.getByRole("banner").getByRole("link", { name: /^Lv \d/ }),
  ).toBeVisible();
});
