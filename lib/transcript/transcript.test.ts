import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import {
  IMPORT_ERROR_MESSAGES,
  type ImportError,
  readTranscript,
} from "./index";

// Regenerate with `node lib/transcript/fixtures/generate.mts`.
const dir = join(import.meta.dirname, "fixtures");
const names = readdirSync(dir)
  .filter((file) => file.endsWith(".pdf"))
  .map((file) => file.slice(0, -4));

test.each(names)("fixture %s", async (name) => {
  const bytes = new Uint8Array(readFileSync(join(dir, `${name}.pdf`)));
  const { result, mustNotContain } = JSON.parse(
    readFileSync(join(dir, `${name}.json`), "utf8"),
  ) as {
    result: { ok: boolean; error?: ImportError };
    mustNotContain: string[];
  };

  const expected = result.error
    ? { ...result, message: IMPORT_ERROR_MESSAGES[result.error] }
    : result;
  const actual = await readTranscript(bytes);
  expect(actual).toEqual(expected);
  for (const secret of mustNotContain) {
    expect(JSON.stringify(actual)).not.toContain(secret);
  }
});

test("rejects a file that is not a PDF", async () => {
  const result = await readTranscript(new TextEncoder().encode("not a pdf"));
  expect(result).toMatchObject({ ok: false, error: "not-pdf" });
});
