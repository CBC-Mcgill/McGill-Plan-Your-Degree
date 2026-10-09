import { toast } from "@/components/toast";
import { catalogueNow } from "@/lib/catalogue/client";
import { planWarnings } from "@/lib/engine/plan";
import { buildSnapshot } from "@/lib/engine/snapshot";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";

const termOf = (code: string) =>
  useProfileStore.getState().plan.find((entry) => entry.courses.includes(code))
    ?.term;

/** The plan warnings as keys, so a change shows which ones it created. Empty until the catalogue has loaded. */
function warningKeys(): Set<string> {
  const catalogue = catalogueNow();
  if (catalogue.status !== "ready") return new Set();
  const { records, plan, entry, creditLimit, graduationTerm } =
    useProfileStore.getState();
  const warnings = planWarnings(
    plan,
    buildSnapshot(records, plan, entry),
    catalogue.catalogue,
    creditLimit,
    graduationTerm,
  );
  return new Set(
    warnings.map(
      (w) =>
        `${w.kind}|${termKey(w.term)}|${"course" in w ? w.course : w.credits}`,
    ),
  );
}

/** Where focus was before the action, so an Undo can hand it back after the toast is gone. */
function rememberFocus() {
  const element = document.activeElement;
  const label = element?.getAttribute("aria-label");
  return () =>
    requestAnimationFrame(() => {
      const target = element?.isConnected
        ? element
        : label &&
          document.querySelector(`[aria-label="${CSS.escape(label)}"]`);
      if (target instanceof HTMLElement) target.focus();
    });
}

/** An Undo that only runs while the course is still where the action left it. */
function undo(
  code: string,
  left: Term | undefined,
  restore: () => void,
  message: string,
) {
  const refocus = rememberFocus();
  return {
    label: "Undo",
    run: () => {
      const now = termOf(code);
      const same = left && now ? termKey(left) === termKey(now) : left === now;
      if (!same) {
        toast("Already changed");
        return;
      }
      restore();
      toast(message);
      refocus();
    },
  };
}

/** Puts the course in the term, or moves it there, and shows a toast that can take it back. */
export function addWithUndo(term: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const from = termOf(code);
  const before = warningKeys();
  const label = termLabel(term);
  const action = undo(
    code,
    term,
    () => (from ? addToPlan(from, code) : removeFromPlan(term, code)),
    from
      ? `${code} moved back to ${termLabel(from)}`
      : `${code} removed from ${label}`,
  );
  addToPlan(term, code);
  const warned = [...warningKeys()].filter((key) => !before.has(key)).length;
  toast(
    `${code} ${from ? "moved" : "added"} to ${label}${warned ? `. ${warned} ${warned === 1 ? "warning" : "warnings"}` : ""}`,
    action,
  );
}

/** Takes the course out of the term, with a toast that can put it back. */
export function removeWithUndo(term: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const action = undo(
    code,
    undefined,
    () => addToPlan(term, code),
    `${code} added back to ${termLabel(term)}`,
  );
  removeFromPlan(term, code);
  toast(`${code} removed from ${termLabel(term)}`, action);
}
