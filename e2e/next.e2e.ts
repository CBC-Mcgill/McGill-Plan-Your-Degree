import { expect, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

test("without a profile it asks the student to import a transcript", async ({
  page,
}) => {
  await page.goto("/next");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { name: "What's next" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
  await expect(
    main.getByRole("link", { name: "Browse courses" }),
  ).toHaveAttribute("href", "/courses");
});

test("with a profile, a required course can be added to the next term", async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: "computer-science-major-bsc",
            startTerm: null,
            graduationTerm: null,
            plan: [],
            creditLimit: 17,
            importedAt: null,
          },
          version: 1,
        }),
      ),
    [
      "plan-your-degree:profile",
      [done("COMP 202"), done("COMP 206"), done("COMP 250")],
    ],
  );
  await page.goto("/next");
  await expect(page.getByLabel("Term").locator("option:checked")).toHaveText(
    "Winter 2027",
  );

  const row = page
    .getByRole("region", { name: "Must take" })
    .getByRole("listitem")
    .filter({ hasText: "COMP 273" });
  await row.getByRole("button", { name: "Add to Winter 2027" }).click();
  await expect(row.getByRole("link", { name: /Planned/ })).toHaveAttribute(
    "href",
    "/plan",
  );
  await expect(row.getByRole("link", { name: /Planned/ })).toBeFocused();
});
