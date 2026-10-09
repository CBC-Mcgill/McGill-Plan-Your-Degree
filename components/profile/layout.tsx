import { Card } from "@/components/ui/card";

/** The profile and the review: the course record in the wide column and the settings, touched once a year, in a side panel. Narrower than 1200px the table needs the full width, so the side panel's cards move under it, two abreast. */
export const PAGE_GRID =
  "mt-8 grid items-start gap-6 min-[1200px]:grid-cols-[minmax(0,1fr)_24rem]";
export const SIDE_PANEL =
  "grid grid-cols-2 items-start gap-6 min-[1200px]:grid-cols-1";

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
    <div className="mx-auto w-full max-w-page px-8 py-12">
      <p role="status" className="sr-only">
        {status}
      </p>
      <div aria-hidden>
        <div className={`${bone} h-[38px] w-80`} />
        {summary && <div className={`${bone} mt-2 h-5 w-96`} />}
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
