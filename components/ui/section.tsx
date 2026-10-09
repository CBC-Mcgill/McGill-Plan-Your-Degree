import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** A named region of a page: a card with its h2 in the grey band. Stack several with a 24px gap. */
export function Section(
  props: ComponentProps<typeof Card> & { title: ReactNode },
) {
  return <Card {...props} />;
}
