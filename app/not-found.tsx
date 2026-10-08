import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto my-auto w-full max-w-6xl px-8 py-16">
      <h1 className="text-5xl">Page not found</h1>
      <p className="mt-4 max-w-prose text-lg text-muted-foreground">
        We could not find that page. The course may not exist, or the link may
        be mistyped.
      </p>
      <div className="mt-9 flex items-center gap-4">
        <Button asChild>
          <Link href="/courses">Browse courses</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
