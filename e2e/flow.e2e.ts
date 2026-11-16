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
  await expect(page).toHaveURL("/plan");

  const row = page
    .getByRole("region", { name: "Required courses" })
    .getByRole("listitem")
    .filter({ hasText: "COMP 251" });
  await row
    .getByRole("button", { name: "Add COMP 251 to Winter 2027" })
    .click();
  await expect(
    row.getByRole("button", { name: "Remove COMP 251 from Winter 2027" }),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Terms", exact: true }).click();
  await expect(page).toHaveURL("/plan?view=terms");
  await page.getByRole("tab", { name: /^Winter 2027/ }).click();
  await expect(
    page.getByRole("button", { name: "Remove COMP 251 from Winter 2027" }),
  ).toBeVisible();
});

test("a CEGEP engineering student with an exemption still has the elective to take", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00"));
  await page.goto("/profile");
  await page
    .locator('input[accept*="pdf"]')
    .setInputFiles("lib/transcript/fixtures/cegep-engineering.pdf");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/plan");
  await expect(page.getByRole("main")).toContainText(
    /\d+ of 133 program credits with your plan/,
  );
  // Advanced standing counts for the degree only, so the elective is still to take.
  const list = page.getByRole("tablist", { name: "Requirements" });
  for (const group of ["Elective course", "Replace exempted credits"]) {
    await expect(
      list.getByRole("tab", { name: new RegExp(group) }),
    ).toContainText("0 of 3");
  }
});
