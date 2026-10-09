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
  await page.goto("/requirements");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "Requirements" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toHaveAttribute("href", "/profile");
});

test("it shows which requirement each course counts toward and what is left", async ({
  page,
}) => {
  await page.addInitScript(
    ([key, records]) =>
      localStorage.setItem(
        key as string,
        JSON.stringify({
          state: {
            records,
            programId: "computer-engineering-beng",
            plan: [],
            creditLimit: 17,
          },
          version: 3,
        }),
      ),
    [
      "plan-your-degree:profile",
      [done("INTG 215"), done("MGPO 440"), done("MATH 240")],
    ],
  );
  await page.goto("/requirements");

  const groupB = page.getByRole("region", {
    name: "Complementary studies group B",
  });
  const course = groupB.getByRole("listitem").filter({ hasText: "INTG 215" });
  await expect(course).toContainText("Completed");
  await expect(groupB).toContainText("Desautels Faculty of Management");
  await expect(groupB).toContainText("3 credits to go");
  await expect(
    groupB.getByRole("link", { name: /See options/ }),
  ).toHaveAttribute("href", "/next");
  await expect(
    page
      .getByRole("region", { name: "Complementary studies group A" })
      .getByRole("listitem")
      .filter({ hasText: "MGPO 440" }),
  ).toBeVisible();

  const required = page.getByRole("region", {
    name: "Required non-departmental courses",
  });
  await expect(
    required.getByRole("listitem").filter({ hasText: "MATH 240" }),
  ).toContainText("Completed");
  await expect(
    required.getByRole("listitem").filter({ hasText: "MATH 262" }),
  ).toContainText("Needs MATH 141 and MATH 133 first");
});

test("a started profile with no program asks for one", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(
      key as string,
      JSON.stringify({
        state: {
          records: [],
          programId: null,
          startTerm: { season: "Fall", year: 2026 },
        },
        version: 3,
      }),
    );
  }, "plan-your-degree:profile");
  await page.goto("/requirements");
  await expect(
    page.getByRole("link", { name: "Pick your program" }),
  ).toHaveAttribute("href", "/profile#program");
});
