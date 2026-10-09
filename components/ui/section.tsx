import { cn } from "cn";
import { type ReactNode, useId } from "react";

/** A named region: an h2 (it may hold a `Term`), then its content 16px below. A section that follows another starts 48px below it. `meta` is a muted fraction and `action` a text button, both on the right of the heading. */
export function Section({
  title,
  titleHidden = false,
  meta,
  action,
  id,
  children,
}: {
  title: ReactNode;
  titleHidden?: boolean;
  meta?: ReactNode;
  action?: ReactNode;
  id?: string;
  children: ReactNode;
}) {
  const headingId = `${useId()}-title`;
  const heading = (
    <h2 id={headingId} className={cn(titleHidden && "sr-only")}>
      {title}
    </h2>
  );
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-6 [section+&]:mt-12"
    >
      {titleHidden && !meta && !action ? (
        heading
      ) : (
        <div className="mb-4 flex items-baseline gap-4">
          {heading}
          <div className="ml-auto flex shrink-0 items-baseline gap-4">
            {meta && <p className="text-fg-muted tabular-nums">{meta}</p>}
            {action && <div className="-my-1">{action}</div>}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}
