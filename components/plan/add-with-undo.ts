import { toast } from "@/components/toast";
import { catalogueNow } from "@/lib/catalogue/client";
import { COPY } from "@/lib/copy";
import { courseLoads, loadsName, startTerm } from "@/lib/engine/plan";
import { useProfileStore } from "@/lib/profile/store";
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

/** How a toast names the course and its terms: "ECSE 458N1 and N2" in Winter 2027 and Fall 2027 for a multi-term course, the plain code and term otherwise. */
function placement(code: string, start: Term): [string, Term[]] {
  const course = courseOf(code);
  const loads = course ? courseLoads(code, course, start) : [];
  return [
    loadsName(loads) || code,
    loads.length > 0 ? loads.map((load) => load.term) : [start],
  ];
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

/** An Undo that only runs while the course is still where the action left it. `after` replaces handing focus back. */
function undo(
  code: string,
  left: Term | undefined,
  restore: () => void,
  message: string,
  after?: () => void,
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
      (after ?? refocus)();
    },
  };
}

/** Puts the course in the term, or moves it there, and shows a toast that can take it back. A multi-term course starts in the first term from there that runs its first part. `onUndo` gets the term an undone move returns to. */
export function addWithUndo(
  requested: Term,
  code: string,
  onUndo?: (term: Term) => void,
) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const course = courseOf(code);
  const term = course ? startTerm(course, requested) : requested;
  const [name, terms] = placement(code, term);
  const from = termOf(code);
  const action = from
    ? undo(
        code,
        term,
        () => addToPlan(from, code),
        `${name} moved back to ${COPY.termPair(...placement(code, from)[1])}`,
        onUndo && (() => onUndo(from)),
      )
    : undo(
        code,
        term,
        () => removeFromPlan(term, code),
        COPY.toast.removed(name, ...terms),
      );
  addToPlan(term, code);
  toast(
    from ? COPY.toast.moved(name, ...terms) : COPY.toast.added(name, ...terms),
    action,
  );
}

/** Takes the course out of the term it starts in, with a toast that can put it back. */
export function removeWithUndo(term: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const [name, terms] = placement(code, term);
  const action = undo(
    code,
    undefined,
    () => addToPlan(term, code),
    `${name} added back to ${COPY.termPair(...terms)}`,
  );
  removeFromPlan(term, code);
  toast(COPY.toast.removed(name, ...terms), action);
}

/** Puts several courses in the term at once with one toast, whose Undo takes back those still where they landed. */
export function addAllWithUndo(requested: Term, codes: readonly string[]) {
  const [only] = codes;
  if (codes.length === 1 && only) {
    addWithUndo(requested, only);
    return;
  }
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  const placed = codes.map((code) => {
    const course = courseOf(code);
    return { code, term: course ? startTerm(course, requested) : requested };
  });
  const label = COPY.term(requested);
  const refocus = rememberFocus();
  for (const { code, term } of placed) addToPlan(term, code);
  toast(`${codes.length} courses added to ${label}`, {
    label: COPY.undo,
    run: () => {
      const still = placed.filter(({ code, term }) => {
        const now = termOf(code);
        return now !== undefined && termKey(now) === termKey(term);
      });
      if (still.length === 0) {
        toast("Already changed");
        return;
      }
      for (const { code, term } of still) removeFromPlan(term, code);
      toast(
        `${still.length} ${still.length === 1 ? "course" : "courses"} removed from ${label}`,
      );
      refocus();
    },
  });
}
