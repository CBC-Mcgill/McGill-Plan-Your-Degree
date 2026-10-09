import { expect, test } from "@playwright/test";

test("a student sends a suggestion and the advisor says it is coming soon", async ({
  page,
}) => {
  await page.goto("/advisor");
  await page.getByRole("button", { name: "Plan my next term" }).click();
  await expect(
    page.getByRole("textbox", { name: "Message the advisor" }),
  ).toHaveValue("Plan my next term");

  await page.getByRole("button", { name: "Send" }).click();
  const log = page.getByRole("log", { name: "Conversation" });
  await expect(log.getByText("Plan my next term")).toBeVisible();
  await expect(log.getByText(/coming soon/i)).toBeVisible();
  await expect(log.getByRole("link", { name: "Planner" })).toHaveAttribute(
    "href",
    "/plan",
  );
});
