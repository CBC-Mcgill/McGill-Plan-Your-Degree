import { useSyncExternalStore } from "react";
import { Card } from "@/components/ui/card";

/** The profile and the review: the course record in the wide column and the settings, touched once a year, in a side panel. Narrower than 1200px the table needs the full width, so the side panel's cards move under it, two abreast, and stacked on phones. */
export const PAGE_GRID =
  "mt-8 grid items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_24rem] max-md:mt-6 max-md:grid-cols-1";
export const SIDE_PANEL =
  "grid grid-cols-2 items-start gap-6 min-[1200px]:grid-cols-1 max-md:grid-cols-1";
/** The page's padding, with the 16px phone gutter. */
export const PAGE =
  "mx-auto w-full max-w-page px-8 py-12 max-md:px-4 max-md:py-8";
/** Inputs and selects 44px tall on phones, with 16px text so iOS does not zoom in on focus. */
export const PHONE_FIELDS =
  "max-md:[&_input]:h-11 max-md:[&_input]:text-base max-md:[&_select]:h-11 max-md:[&_select]:text-base";

const PHONE = "(max-width: 767.98px)";

/** True below Tailwind's md breakpoint, where a table becomes stacked rows. False on the server, so only call it in a component that renders after hydration. */
export function usePhone() {
  return useSyncExternalStore(
    (onChange) => {
      const query = matchMedia(PHONE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => matchMedia(PHONE).matches,
    () => false,
  );
}

const bone = "rounded-md bg-tint motion-safe:animate-pulse";

/** Stands in for the profile or the review while it loads, at the same layout. */
export function PageSkeleton({
  status,
  summary = false,
}: {
  status: string;
  summary?: boolean;
}) {
  return (
    <div className={PAGE}>
      <p role="status" className="sr-only">
        {status}
      </p>
      <div aria-hidden>
        <div className={`${bone} h-[38px] w-80 max-md:w-48`} />
        {summary && <div className={`${bone} mt-2 h-5 w-96 max-md:w-full`} />}
        <div className={PAGE_GRID}>
          <Card className="px-5 py-4">
            {Array.from({ length: 8 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={`${bone} mt-4 h-7 first:mt-0`} />
            ))}
          </Card>
          <Card className="px-5 py-4">
            <div className={`${bone} h-7 w-28`} />
            {Array.from({ length: 4 }, (_, row) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static placeholders never reorder
              <div key={row} className={`${bone} mt-4 h-9`} />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
