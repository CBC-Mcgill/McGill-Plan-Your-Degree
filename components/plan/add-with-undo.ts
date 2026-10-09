import { toast } from "@/components/toast";
import { catalogueNow } from "@/lib/catalogue/client";
import { COPY } from "@/lib/copy";
import { courseLoads, loadsName, startTerm } from "@/lib/engine/plan";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import { type Term, termKey } from "@/lib/profile/types";

const termOf = (code: string) =>
  useProfileStore.getState().plan.find((entry) => entry.courses.includes(code))
    ?.term;

function courseOf(code: string) {
  const catalogue = catalogueNow();
  return catalogue.status === "ready"
    ? catalogue.catalogue.get(code)
    : undefined;
}

/** How a toast names the course: "ECSE 458D1 and D2" for a multi-term course, the plain code otherwise. */
function nameOf(code: string, start: Term) {
  const course = courseOf(code);
  return (course && loadsName(courseLoads(code, course, start))) || code;
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
    label: COPY.undo,
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

/** Puts the course in the term, or moves it there, and shows a toast that can take it back. A multi-term course starts in the first term from there that runs its first part. */
export function addWithUndo(requested: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const course = courseOf(code);
  const term = course ? startTerm(course, requested) : requested;
  const name = nameOf(code, term);
  const from = termOf(code);
  const action = undo(
    code,
    term,
    () => (from ? addToPlan(from, code) : removeFromPlan(term, code)),
    from
      ? `${name} moved back to ${termLabel(from)}`
      : COPY.toast.removed(name, term),
  );
  addToPlan(term, code);
  toast(
    from ? COPY.toast.moved(name, term) : COPY.toast.added(name, term),
    action,
  );
}

/** Takes the course out of the term it starts in, with a toast that can put it back. */
export function removeWithUndo(term: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const name = nameOf(code, term);
  const action = undo(
    code,
    undefined,
    () => addToPlan(term, code),
    `${name} added back to ${termLabel(term)}`,
  );
  removeFromPlan(term, code);
  toast(COPY.toast.removed(name, term), action);
}
