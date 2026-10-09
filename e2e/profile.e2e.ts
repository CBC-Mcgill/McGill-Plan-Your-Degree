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

test("importing a transcript saves its courses, and a re-import says what it replaces", async ({
  page,
}) => {
  await page.goto("/profile");
  await page.locator('input[accept*="pdf"]').setInputFiles(fixture);

  await expect(page.getByText("9 courses, not saved yet.")).toBeVisible();
  await expect(page.getByText(/Saving replaces/)).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Program" })).toHaveValue(
    "Computer Science Major (B.Sc.)",
  );
  await expect(page.getByLabel("Start term", { exact: true })).toHaveValue(
    /.+/,
  );
  await page.getByRole("button", { name: "Save to my profile" }).click();
  await expect(page).toHaveURL("/next");

  await page.goto("/profile");
  await expect(
    page.getByRole("heading", { level: 1, name: "Profile" }),
  ).toBeAttached();
  await expect(page.getByText("COMP 250", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Program" })).toHaveValue(
    "Computer Science Major (B.Sc.)",
  );

  await page.locator('input[accept*="pdf"]').setInputFiles(fixture);
  await expect(
    page.getByText(
      "9 courses, not saved yet. Saving replaces your imported courses and keeps the ones you added by hand.",
    ),
  ).toBeVisible();
});

test("a program read from the catalogue can be found and used", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  const program = page.getByRole("combobox", { name: "Program" });
  await program.fill("psychology major bsc");
  await expect(page.getByRole("group", { name: "Science" })).toBeVisible();
  await program.press("Enter");
  await expect(program).toHaveValue("Psychology Major (B.Sc.)");
  await expect(page.getByText("read automatically")).toBeVisible();

  await page.getByRole("link", { name: "What's next", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Psychology Major",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await expect(page.getByText("Check this requirement").first()).toBeVisible();
});

test("a file that is not a transcript shows an error", async ({ page }) => {
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

  await page
    .locator('input[accept*="pdf"]')
    .setInputFiles("lib/transcript/fixtures/not-a-transcript.pdf");
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "This PDF is not a McGill unofficial transcript. Follow the steps on the right to save the right page.",
  );
});

test("restoring a backup replaces the profile, and Undo brings it back", async ({
  page,
}) => {
  await importAndSave(page);
  await page.goto("/profile");
  const backup = {
    format: "plan-your-degree-profile",
    version: 4,
    profile: {
      records: [],
      programId: null,
      minorId: null,
      entry: null,
      advancedStanding: 0,
      creditsRequired: null,
      startTerm: { season: "Fall", year: 2026 },
      graduationTerm: null,
      plan: [],
      creditLimit: 17,
      importedAt: null,
    },
  };
  await page.locator('input[accept*="json"]').setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByText("No courses yet.")).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByText("COMP 250", { exact: true })).toBeVisible();
});

test("a course added by hand lands in its term", async ({ page }) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  const toggle = page.getByRole("button", { name: "Add a course" });
  await toggle.click();
  const code = page.getByLabel("Code", { exact: true });
  await expect(code).toBeFocused();
  await code.fill("comp250");
  await code.press("Enter");
  await expect(page.getByText("COMP 250", { exact: true })).toBeVisible();

  await code.press("Escape");
  await expect(code).toBeHidden();
  await expect(toggle).toBeFocused();
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

test("starting without a transcript counts as a profile everywhere", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Start without a transcript" })
    .click();
  await expect(page.getByRole("combobox", { name: "Program" })).toHaveValue("");

  await page.getByRole("link", { name: "What's next", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Other courses you can take/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Pick your program" }).click();
  await expect(page).toHaveURL("/profile#program");
  await expect(page.locator("#program")).toBeInViewport();
});

test("the expected graduation label defines the term on focus", async ({
  page,
}) => {
  await page.goto("/profile");
  await page
    .getByRole("button", { name: "Start without a transcript" })
    .click();

  await page.getByRole("button", { name: "Expected graduation" }).focus();
  await expect(page.getByRole("tooltip")).toHaveText(
    "The last term you take courses. Finishing in April? Pick Winter, even if the ceremony is in May or June.",
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  // Home's next step links here.
  await page.goto("/profile#graduation");
  await expect(page.getByLabel("Expected graduation")).toHaveAttribute(
    "id",
    "graduation",
  );
  await expect(page.locator("#graduation")).toBeInViewport();
});
