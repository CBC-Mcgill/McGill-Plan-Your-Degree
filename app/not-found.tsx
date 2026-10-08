import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto my-auto w-full max-w-page px-8 py-16">
      <h1>Page not found</h1>
      <p className="mt-3 max-w-prose text-muted-foreground">
        We could not find that page. The course may not exist, or the link may
        be mistyped.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button asChild size="lg">
          <Link href="/courses">Browse courses</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </div>
  );
}
