import { expect, test } from "@playwright/test";

test("on a phone the header fits, search fills the screen and the menu reaches every page", async ({
  page,
}) => {
  await page.goto("/courses");
  const width = page.viewportSize()?.width ?? 0;
  const right = await page
    .locator("header")
    .first()
    .evaluate((el) =>
      Math.max(
        ...[el, ...el.querySelectorAll("*")].map(
          (node) => node.getBoundingClientRect().right,
        ),
      ),
    );
  expect(right).toBeLessThanOrEqual(width);

  await page.getByRole("button", { name: "Search courses" }).click();
  const palette = page.getByRole("dialog", { name: "Command palette" });
  await expect
    .poll(async () => (await palette.boundingBox())?.width)
    .toBe(width);
  await palette.getByRole("button", { name: "Cancel" }).click();
  await expect(palette).toBeHidden();

  await page.getByRole("button", { name: "Menu" }).click();
  const menu = page.getByRole("dialog", { name: "Menu" });
  await expect(menu.getByRole("link")).toHaveText([
    "Browse courses",
    "What's next",
    "Planner",
    /Advisor/,
    "Profile",
  ]);
  await menu.getByRole("link", { name: "What's next" }).click();
  await expect(page).toHaveURL("/next");
  await expect(menu).toBeHidden();
});
