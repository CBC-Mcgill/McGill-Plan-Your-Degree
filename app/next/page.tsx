import type { Metadata } from "next";

export const metadata: Metadata = { title: "What's next" };

export default function NextPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-8 py-14">
      <h1 className="text-4xl">What's next</h1>
      <p className="mt-3 max-w-prose text-lg text-muted-foreground">
        Soon this page lists the courses you can take next term and the ones you
        still need to graduate.
      </p>
    </div>
  );
}
