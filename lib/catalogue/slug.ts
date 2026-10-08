/** "COMP 251" becomes "comp-251". */
export function courseSlug(code: string): string {
  return code.toLowerCase().replace(" ", "-");
}

/** "comp-251" becomes "COMP 251". Nothing checks the result exists, so look it up in the catalogue. */
export function codeFromSlug(slug: string): string {
  return slug.toUpperCase().replace("-", " ");
}
