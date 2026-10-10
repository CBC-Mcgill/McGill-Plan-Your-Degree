import { expect, type Page, test } from "@playwright/test";

const done = (code: string) => ({
  code,
  term: { season: "Fall", year: 2025 },
  credits: 3,
  grade: "A",
  status: "completed",
  source: "manual",
});

/** Opens What's next on 8 October 2026, so the next term is Winter 2027, as a Computer Engineering student with a minor. */
async function openStudent(page: Page, path = "/next") {
  await page.clock.setFixedTime(new Date("2026-10-08T12:00:00"));
  await page.addInitScript(
    (value) => {
      if (!localStorage.getItem("plan-your-degree:profile")) {
        localStorage.setItem("plan-your-degree:profile", value);
      }
    },
    JSON.stringify({
      state: {
        creditLimit: 17,
        records: [
          done("INTG 215"),
          done("MGPO 440"),
          done("MATH 240"),
          done("MATH 222"),
        ],
        programId: "computer-engineering-beng",
        minorId: "technological-entrepreneurship-minor-beng",
        entry: "cegep",
        plan: [
          { term: { season: "Winter", year: 2027 }, courses: ["ECSE 202"] },
        ],
      },
      version: 4,
    }),
  );
  await page.goto(path);
}

async function expectNoSideScroll(page: Page) {
  const extra = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(extra).toBeLessThanOrEqual(0);
}

const list = (page: Page) => page.getByRole("list", { name: "Requirements" });

test("a visitor sees the import screen", async ({ page }) => {
  await page.goto("/next");
  const main = page.getByRole("main");
  await expect(
    main.getByRole("heading", { level: 1, name: "See what you can take next" }),
  ).toBeVisible();
  await expect(
    main.getByRole("link", { name: "Import your transcript" }),
  ).toBeVisible();
  await expectNoSideScroll(page);
});

test("on a phone the requirements are a list that opens one pane at a time", async ({
  page,
}) => {
  await openStudent(page);
  await expect(
    page.getByRole("heading", { level: 1, name: "Computer Engineering" }),
  ).toBeVisible();
  await expect(
    page.getByRole("tablist", { name: "Requirements" }),
  ).toBeHidden();

  const bars = page.getByRole("region", { name: "Credit progress" });
  const [major, minor] = await Promise.all(
    [0, 1].map((i) => bars.getByRole("img").nth(i).boundingBox()),
  );
  expect(major?.x).toBe(minor?.x);
  expect(minor?.y ?? 0).toBeGreaterThan(major?.y ?? 0);
  await expectNoSideScroll(page);

  await list(page)
    .getByRole("link", { name: /Required non-departmental courses/ })
    .tap();
  await expect(page).toHaveURL("/next?req=required-non-departmental-courses");
  await expect(list(page)).toBeHidden();
  const pane = page.getByRole("region", {
    name: "Required non-departmental courses",
  });
  await expect(pane).toBeVisible();
  const back = page.getByRole("link", { name: "All requirements" });
  await expect(back).toBeFocused();
  await expectNoSideScroll(page);

  const add = pane.getByRole("button", { name: /^Add .+ to Winter 2027$/ });
  const name = (await add.first().getAttribute("aria-label")) ?? "";
  await expect(add.first().locator("..")).toHaveCSS("opacity", "1");
  await add.first().tap();
  await expect(
    page.getByRole("button", {
      name: name.replace(/^Add (.+) to/, "Remove $1 from"),
    }),
  ).toBeFocused();

  await back.tap();
  await expect(page).toHaveURL("/next");
  await expect(
    list(page).getByRole("link", {
      name: /Required non-departmental courses/,
    }),
  ).toBeFocused();
  await page.goBack();
  await expect(pane).toBeVisible();
});

test("every pane fits a phone, and a link opens the minor's pane", async ({
  page,
}) => {
  await openStudent(page, "/next?req=minor");
  const minor = page.getByRole("region", {
    name: "Technological Entrepreneurship minor",
  });
  await expect(
    minor.getByRole("listitem").filter({ hasText: "INTG 215" }),
  ).toContainText("Counts for both");
  await expectNoSideScroll(page);

  await page.goto("/next");
  await expect(list(page)).toBeVisible();
  const hrefs = await page
    .getByRole("main")
    .locator('a[href^="?req="]')
    .evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(5);
  for (const href of hrefs) {
    await page.goto(`/next${href}`);
    await expect(
      page.getByRole("link", { name: "All requirements" }),
    ).toBeVisible();
    await expectNoSideScroll(page);
  }
});
