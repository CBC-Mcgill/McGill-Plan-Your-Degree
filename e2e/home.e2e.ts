import { expect, test } from "@playwright/test";

test("home renders without horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "McGill Plan Your Degree" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
