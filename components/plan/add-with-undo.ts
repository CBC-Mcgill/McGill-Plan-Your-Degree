import { toast } from "@/components/toast";
import { useProfileStore } from "@/lib/profile/store";
import { termLabel } from "@/lib/profile/term-options";
import type { Term } from "@/lib/profile/types";

/** Puts the course in the term, or moves it there, and shows a toast that can take it back. */
export function addWithUndo(term: Term, code: string) {
  const { plan, addToPlan, removeFromPlan } = useProfileStore.getState();
  const from = plan.find((entry) => entry.courses.includes(code))?.term;
  addToPlan(term, code);
  toast(`${from ? "Moved" : "Added"} to ${termLabel(term)}`, {
    label: "Undo",
    run: () => {
      if (from) addToPlan(from, code);
      else removeFromPlan(term, code);
      toast(from ? "Moved back" : "Removed");
    },
  });
}

/** Takes the course out of the term, with a toast that can put it back. */
export function removeWithUndo(term: Term, code: string) {
  const { addToPlan, removeFromPlan } = useProfileStore.getState();
  removeFromPlan(term, code);
  toast(`Removed from ${termLabel(term)}`, {
    label: "Undo",
    run: () => addToPlan(term, code),
  });
}
