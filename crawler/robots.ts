/** Returns the Disallow prefixes that apply to every user agent. */
export function disallowedPaths(robotsTxt: string): string[] {
  const rules: string[] = [];
  let appliesToAll = false;
  for (const raw of robotsTxt.split("\n")) {
    const line = raw.replace(/#.*/, "").trim();
    const [key = "", ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) appliesToAll = value === "*";
    else if (appliesToAll && /^disallow$/i.test(key) && value)
      rules.push(value);
  }
  return rules;
}

export function isAllowed(path: string, disallowed: string[]): boolean {
  return !disallowed.some((prefix) => path.startsWith(prefix));
}
