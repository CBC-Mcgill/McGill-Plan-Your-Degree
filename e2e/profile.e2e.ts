import { expect, type Page, test } from "@playwright/test";

const fixture = "lib/transcript/fixtures/simple-record.pdf";

async function importAndSave(page: Page) {
  await page.goto("/profile");
  await page.locator('input[accept*="pdf"]').setInputFiles(fixture);
  await expect(
    page.getByRole("heading", { level: 1, name: "Check your transcript" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/next");
}

test("importing a transcript saves its courses", async ({ page }) => {
  await page.goto("/profile");
  await page.locator('input[accept*="pdf"]').setInputFiles(fixture);

  await expect(page.getByRole("heading", { name: "9 courses" })).toBeVisible();
  await expect(page.getByLabel("Program")).toHaveValue(
    "computer-science-major-bsc",
  );
  await expect(page.getByLabel("Start term")).toHaveValue(/.+/);
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/next");

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { level: 1, name: "Your profile" }),
  ).toBeVisible();
  await expect(page.getByText("COMP 250", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Program" })).toHaveValue(
    "computer-science-major-bsc",
  );
});

test("a file that is not a PDF shows an error", async ({ page }) => {
  await page.goto("/profile");
  await page.locator('input[accept*="pdf"]').setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a pdf"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "not a PDF",
  );
  await expect(
    page.getByRole("button", { name: "Choose your transcript PDF" }),
  ).toBeEnabled();
});

test("deleting all data clears the profile", async ({ page }) => {
  await importAndSave(page);
  await page.goto("/profile");
  await page.getByRole("button", { name: "Delete all my data" }).click();
  await page.getByRole("button", { name: "Delete everything" }).click();
  await expect(
    page.getByRole("button", { name: "Choose your transcript PDF" }),
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "Choose your transcript PDF" }),
  ).toBeVisible();
});

test("a browser that cannot save the profile says so and offers a backup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("full", "QuotaExceededError");
    };
  });
  await importAndSave(page);
  const banner = page.getByRole("alert").filter({ hasText: "could not save" });
  await expect(banner).toBeVisible();
  await expect(
    banner.getByRole("button", { name: "Export a backup" }),
  ).toBeVisible();
});
