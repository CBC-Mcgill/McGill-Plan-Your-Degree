import { expect, test } from "@playwright/test";

const record = (code: string, season: string, year: number, credits = 3) => ({
  code,
  term: { season, year },
  credits,
  grade: "A",
  status: "completed",
  source: "manual",
});

// 32 credits across two terms: level 3, 3,200 XP, and 5 of 13 badges.
const profile = {
  state: {
    records: [
      ...["COMP 202", "MATH 133", "MATH 140", "ENGL 202", "BIOL 111"].map((c) =>
        record(c, "Fall", 2025),
      ),
      ...["COMP 206", "COMP 250", "MATH 240"].map((c) =>
        record(c, "Winter", 2026),
      ),
      record("MATH 141", "Winter", 2026, 4),
      record("PHYS 101", "Winter", 2026, 4),
      { ...record("COMP 251", "Fall", 2026), status: "in-progress" },
    ],
    programId: "computer-science-major-bsc",
    startTerm: { season: "Fall", year: 2025 },
    graduationTerm: { season: "Winter", year: 2028 },
    plan: [{ term: { season: "Winter", year: 2027 }, courses: ["COMP 302"] }],
    creditLimit: 17,
    importedAt: null,
  },
  version: 1,
};

test("progress shows as a level, badges, and a one-time celebration", async ({
  page,
}) => {
  await page.addInitScript(
    ({ key, value }) => localStorage.setItem(key, value),
    { key: "plan-your-degree:profile", value: JSON.stringify(profile) },
  );
  const toast = page.getByRole("status").filter({ hasText: "XP" });
  const level = page.getByRole("banner").getByRole("link", { name: /Level 3/ });

  await page.goto("/profile");
  await expect(toast).toContainText("+3,200 XP");
  await expect(toast).toContainText("Level 3 reached");
  await expect(toast).toContainText("5 badges earned");
  await expect(level).toHaveAttribute("href", "/profile#badges");
  await expect(level).toContainText("200 / 1,500 XP");

  const badges = page.locator("#badges");
  await expect(badges.getByRole("heading", { name: "Badges" })).toBeVisible();
  await expect(badges).toContainText("5 of 13 earned");
  await expect(badges.locator('[data-earned="true"]')).toHaveCount(5);
  await expect(
    badges.locator('[data-earned="true"]', { hasText: "Term cleared" }),
  ).toBeVisible();
  await expect(
    badges.locator('[data-earned="false"]', { hasText: "Graduation ready" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(toast).toHaveCount(0);

  await page.reload();
  await expect(level).toBeVisible();
  await expect(toast).toHaveCount(0);
});
