import { cn } from "cn";
import { type ReactNode, useId } from "react";

/** White on the grey page: 12px corners, a hairline and a soft bottom edge. The outline repeats the hairline over a full-bleed child, such as a hovered row. */
export const CARD =
  "rounded-lg bg-bg shadow-card outline outline-1 -outline-offset-1 outline-line";

/** The grey band at the top of a card, 20px in like the card's content. */
export const BAND =
  "flex items-center gap-4 rounded-t-lg border-line border-b bg-subtle px-5 py-3";

/**
 * A card. With `title` it is a named region: an h2 (it may hold a `Term`) in the grey band with `meta` and `action` on the right, and its content 20px in below.
 * Without one it is the bare surface, padded by the caller. Rows inside bleed to the card's edges and draw a hairline between each other (`ROW` in course-row).
 */
export function Card({
  title,
  meta,
  action,
  id,
  className,
  children,
}: {
  title?: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  const headingId = `${useId()}-title`;
  if (title === undefined) {
    return <div className={cn(CARD, className)}>{children}</div>;
  }
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn(CARD, "scroll-mt-6", className)}
    >
      <div className={BAND}>
        <h2 id={headingId} className="min-w-0">
          {title}
        </h2>
        {(meta || action) && (
          <div className="ml-auto flex shrink-0 items-center gap-4">
            {meta && <div className="text-fg-muted tabular-nums">{meta}</div>}
            {action && <div className="-my-1.5">{action}</div>}
          </div>
        )}
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}
