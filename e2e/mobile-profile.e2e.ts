import { expect, type Locator, type Page, test } from "@playwright/test";

const KEY = "plan-your-degree:profile";
const fixture = "lib/transcript/fixtures/cegep-engineering.pdf";

const record = (code: string, grade: string | null, status: string) => ({
  code,
  term: { season: status === "completed" ? "Winter" : "Fall", year: 2026 },
  credits: 3,
  grade,
  status,
  source: "transcript",
});

async function seed(page: Page) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key as string, value as string),
    [
      KEY,
      JSON.stringify({
        state: {
          records: [
            record("COMP 250", "A", "completed"),
            record("MATH 240", "B+", "completed"),
            record("ECSE 222", null, "in-progress"),
          ],
          programId: "computer-engineering-beng",
          minorId: "technological-entrepreneurship-minor-beng",
          entry: "cegep",
          advancedStanding: 0,
          creditsRequired: null,
          startTerm: { season: "Fall", year: 2025 },
          graduationTerm: { season: "Winter", year: 2029 },
          plan: [],
          creditLimit: 17,
          importedAt: null,
        },
        version: 4,
      }),
    ],
  );
}

async function expectNoSideScroll(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

async function expectTappable(target: Locator) {
  await expect(target).toBeVisible();
  expect((await target.boundingBox())?.height).toBeGreaterThanOrEqual(44);
}

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-09T12:00:00"));
});

test("on a phone a visitor imports a transcript and saves it from the bar", async ({
  page,
}) => {
  await page.goto("/profile");
  await expectTappable(
    page.getByRole("button", { name: "Choose your transcript PDF" }),
  );
  await expectNoSideScroll(page);

  await page.locator('input[accept*="pdf"]').setInputFiles(fixture);
  await expect(
    page.getByRole("heading", { level: 1, name: "Check your transcript" }),
  ).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const courses = page.getByRole("list", {
    name: "Your courses, newest term first",
  });
  await expect(courses.getByRole("listitem").first()).toBeVisible();
  await expectNoSideScroll(page);

  const save = page.getByRole("button", { name: "Save to my profile" });
  await expectTappable(save);
  const bar = await save.boundingBox();
  expect((bar?.y ?? 0) + (bar?.height ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.height ?? 0,
  );

  // The Undo toast sits above the save bar, not over Save.
  const remove = courses.getByRole("button", { name: /^Remove / }).first();
  await expectTappable(remove);
  await remove.click();
  const undo = page.getByRole("button", { name: "Undo" });
  await expectTappable(undo);
  const toast = await undo.boundingBox();
  expect((toast?.y ?? 0) + (toast?.height ?? 0)).toBeLessThan(bar?.y ?? 0);

  await page.getByRole("combobox", { name: "Program" }).click();
  await expect(save).toBeHidden();
  await page.getByRole("heading", { name: "Check your transcript" }).click();
  await save.click();
  await expect(page).toHaveURL("/next");
});

test("on a phone a student's profile stacks, and every action is a tap away", async ({
  page,
}) => {
  await seed(page);
  await page.goto("/profile");
  await expect(page.getByText("COMP 250", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Remove COMP 250" }),
  ).toBeVisible();
  await expectNoSideScroll(page);

  await page.getByRole("link", { name: "Degree", exact: true }).click();
  await expect(
    page.getByRole("combobox", { name: "Program" }),
  ).toBeInViewport();
  await page.getByRole("combobox", { name: "Minor" }).click();
  const list = page.getByRole("listbox", { name: "Minors" });
  const box = await list.boundingBox();
  expect(box?.x).toBeGreaterThanOrEqual(0);
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Add a course" }).click();
  await expectTappable(page.getByRole("button", { name: "Add", exact: true }));
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: "Delete all my data" }).click();
  const dialog = page.getByRole("alertdialog");
  await expectTappable(dialog.getByRole("button", { name: "Cancel" }));
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
});

test("on a phone the visitor screens fit", async ({ page }) => {
  for (const path of ["/next", "/plan"]) {
    await page.goto(path);
    await expectTappable(
      page.getByRole("link", { name: "Import your transcript" }),
    );
    await expectNoSideScroll(page);
  }
});

test("on a phone the advisor keeps its chats behind a button and stacks the suggestions", async ({
  page,
}) => {
  await page.goto("/advisor");
  await expect(page.getByRole("complementary", { name: "Chats" })).toBeHidden();
  const first = await page
    .getByRole("button", { name: /Plan my next term/ })
    .boundingBox();
  const second = await page
    .getByRole("button", { name: /Am I on track/ })
    .boundingBox();
  expect(second?.x).toBe(first?.x);
  expect(second?.y).toBeGreaterThan((first?.y ?? 0) + (first?.height ?? 0));
  await expectNoSideScroll(page);

  await page.getByRole("button", { name: "Chats", exact: true }).click();
  const sheet = page.getByRole("dialog", { name: "Chats" });
  await expect(sheet.getByText(/Nothing you type is saved/)).toBeVisible();
  await sheet.getByRole("button", { name: "Close chats" }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole("button", { name: /Plan my next term/ }).click();
  await page.getByRole("button", { name: "Send message" }).click();
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText(/coming soon/i)).toBeVisible();
  // A touch screen has no hover, so the answer's actions always show.
  await expect(
    log.getByRole("button", { name: "Copy" }).locator(".."),
  ).toHaveCSS("opacity", "1");
  await page.getByRole("button", { name: "New chat" }).click();
  await expect(log.getByText(/coming soon/i)).toHaveCount(0);
  await expectNoSideScroll(page);
});
