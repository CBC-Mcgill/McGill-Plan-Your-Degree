import { cn } from "cn";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

/** Settings layout: the title and one sentence on the left, the fields in a wide card on the right. */
export function SettingsSection({
  id,
  title,
  description,
  cardClassName = "p-5",
  children,
}: {
  id: string;
  title: string;
  description: string;
  cardClassName?: string;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid grid-cols-[16rem_minmax(0,1fr)] items-start gap-8"
    >
      <div>
        <h2 id={`${id}-title`} className="text-sm leading-5">
          {title}
        </h2>
        <p className="mt-1 text-[13px] text-muted-foreground leading-[18px]">
          {description}
        </p>
      </div>
      <Card className={cn("overflow-hidden", cardClassName)}>{children}</Card>
    </section>
  );
}
