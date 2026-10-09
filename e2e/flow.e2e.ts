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
    .getByRole("region", { name: "Required courses" })
    .getByRole("listitem")
    .filter({ hasText: "COMP 251" });
  await row
    .getByRole("button", { name: "Add COMP 251 to Winter 2027" })
    .click();
  await expect(
    row.getByRole("button", { name: "Remove COMP 251 from Winter 2027" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Planner" }).click();
  await expect(page).toHaveURL("/plan");
  await page.getByRole("tab", { name: /^Winter 2027/ }).click();
  await expect(
    page.getByRole("button", { name: "Remove COMP 251 from Winter 2027" }),
  ).toBeVisible();
});

test("a CEGEP engineering student with an exemption reads the same credits on Home, What's next and the Planner", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00"));
  await page.goto("/profile");
  await page
    .locator('input[accept*="pdf"]')
    .setInputFiles("lib/transcript/fixtures/cegep-engineering.pdf");
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/next");
  const main = page.getByRole("main");
  const figure = async (pattern: RegExp) => {
    await expect(main).toContainText(pattern);
    return Number(pattern.exec(await main.innerText())?.[1]);
  };
  const counting = await figure(
    /(\d+) of 133 program credits earned or in progress/,
  );

  await page.goto("/");
  const earned = await figure(/(\d+) of 133 degree credits earned/);
  const inProgress = await figure(/(\d+)\s+in progress/);
  const toGo = await figure(/(\d+)\s+to go/);
  expect(counting).toBe(earned + inProgress);

  await page.goto("/plan");
  await expect(
    page.getByRole("heading", { name: `Your plan is ${toGo} credits short` }),
  ).toBeVisible();
  await expect(
    page.getByRole("listitem").filter({ hasText: "Replace exempted credits" }),
  ).toContainText("3 to go");
});
