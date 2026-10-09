/** "1 credit", "3 credits". */
export const creditsText = (credits: number) =>
  `${credits} ${credits === 1 ? "credit" : "credits"}`;

/** "Required Courses" becomes "Required courses", and acronyms such as COMP stay. */
export function sentence(title: string): string {
  return title.replace(
    /\b([A-Z])([a-z]+)/g,
    (word, first: string, rest: string, at: number) =>
      at === 0 ? word : first.toLowerCase() + rest,
  );
}
