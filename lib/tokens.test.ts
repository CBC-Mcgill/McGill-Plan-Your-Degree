import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const css = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const token = (name: string) => {
  const value = css.match(new RegExp(`--${name}: (#[0-9a-f]{6});`))?.[1];
  if (!value) throw new Error(`--${name} is not a hex token`);
  return value;
};

/** --tint is see-through: "tint" is it over a white card, where rows and their status words sit, and "tint-on-page" over the grey page. */
function tintOver(under: string) {
  const [red, green, blue, alpha] = (
    css.match(/--tint: rgb\((\d+) (\d+) (\d+) \/ ([\d.]+)\);/) ?? []
  )
    .slice(1)
    .map(Number);
  if (alpha === undefined) throw new Error("--tint is not rgb with alpha");
  return `#${[red, green, blue]
    .map((c = 0, i) => {
      const below = Number.parseInt(under.slice(1 + i * 2, 3 + i * 2), 16);
      return Math.round(c * alpha + below * (1 - alpha))
        .toString(16)
        .padStart(2, "0");
    })
    .join("")}`;
}

const hex = (name: string) =>
  name === "tint"
    ? tintOver(token("bg"))
    : name === "tint-on-page"
      ? tintOver(token("page"))
      : token(name);

/** WCAG 2 contrast ratio of two #rrggbb colors. */
function contrast(a: string, b: string) {
  const luminance = (color: string) => {
    const [red = 0, green = 0, blue = 0] = [1, 3, 5].map((i) => {
      const c = Number.parseInt(color.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test("every text token meets 4.5:1 on its surfaces and --fg-subtle meets 3:1", () => {
  const white = "#ffffff";
  const text: [string, string][] = [
    ["fg", "bg"],
    ["fg", "tint"],
    ["fg-muted", "bg"],
    ["fg-muted", "tint"],
    ["fg-muted", "subtle"],
    ["fg-muted", "page"],
    ["fg-muted", "tint-on-page"],
    ["fg", "tint-on-page"],
    ["fg-muted", "muted"],
    ["fg", "muted"],
    ["danger", "bg"],
    ["warn", "bg"],
    ["warn", "tint"],
    ["completed", "bg"],
    ["in-progress", "bg"],
    ["planned", "bg"],
    ["completed", "tint"],
    ["in-progress", "tint"],
    ["planned", "tint"],
    ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((i): [string, string][] => [
      [`subject-${i}`, "bg"],
      [`subject-${i}`, `subject-${i}-bg`],
    ]),
  ];
  for (const [fg, bg] of text) {
    expect(contrast(hex(fg), hex(bg)), `${fg} on ${bg}`).toBeGreaterThan(4.5);
  }
  for (const fill of ["primary", "primary-hover", "fg"]) {
    expect(contrast(white, hex(fill)), `white on ${fill}`).toBeGreaterThan(4.5);
  }
  for (const line of ["fg-subtle", "ring", "locked"]) {
    expect(contrast(hex(line), hex("bg")), `${line} on bg`).toBeGreaterThan(3);
  }
});
