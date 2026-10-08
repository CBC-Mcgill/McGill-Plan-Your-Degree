import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** A card with a header row: a title, an optional caption, and a note on the right. Pass `bodyClassName=""` for a body that runs edge to edge. */
export function SectionCard({
  id,
  title,
  caption,
  trailing,
  bodyClassName = "px-5 pb-5",
  children,
}: {
  id: string;
  title: string;
  caption?: ReactNode;
  trailing?: ReactNode;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card asChild className="overflow-hidden">
      <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
        <div className="flex items-start justify-between gap-6 px-5 pt-5 pb-3">
          <div>
            <h2 id={`${id}-title`} className="text-sm leading-5">
              {title}
            </h2>
            {caption && (
              <p className="mt-0.5 text-[13px] text-muted-foreground">
                {caption}
              </p>
            )}
          </div>
          {trailing && (
            <p className="shrink-0 text-[13px] text-muted-foreground leading-5">
              {trailing}
            </p>
          )}
        </div>
        <div className={bodyClassName}>{children}</div>
      </section>
    </Card>
  );
}
