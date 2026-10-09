import { expect, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

test("toasts name the course, show one at a time, and Undo only runs when it is still true", async ({
  page,
  context,
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
  const toast = page.locator('[aria-live="polite"]');
  const add = (code: string) =>
    page.getByRole("button", { name: `Add ${code} to Winter 2027` }).first();

  await add("COMP 273").click();
  await expect(toast).toHaveText("COMP 273 added to Winter 2027Undo");
  const box = await toast.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.x).toBe(24);
  expect(viewport && box && viewport.height - box.y - box.height).toBe(24);
  await add("COMP 303").click();
  await expect(toast).toHaveText("COMP 303 added to Winter 2027Undo");
  await expect(toast.getByRole("button", { name: "Undo" })).toHaveAttribute(
    "title",
    /^Undo \((⌘Z|Ctrl\+Z)\)$/,
  );

  await page.keyboard.press("ControlOrMeta+z");
  await expect(toast).toHaveText("COMP 303 removed from Winter 2027");
  await expect(add("COMP 303")).toBeFocused();

  await add("COMP 303").click();
  const other = await context.newPage();
  await other.goto("/profile");
  await other.evaluate(() => {
    const key = "plan-your-degree:profile";
    const saved = JSON.parse(localStorage.getItem(key) ?? "");
    saved.state.plan = [];
    localStorage.setItem(key, JSON.stringify(saved));
  });
  await other.close();
  await expect(
    page.getByRole("button", { name: "Add COMP 273 to Winter 2027" }).first(),
  ).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(toast).toHaveText("Already changed");
});
