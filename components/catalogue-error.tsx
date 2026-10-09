"use client";

import { CircleAlert } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { retryCatalogue } from "@/lib/catalogue/client";

/** Shown in place of a page's course lists when the catalogue request fails. */
export function CatalogueError() {
  return (
    <Banner tone="danger" role="alert" className="items-center px-4 py-3">
      <CircleAlert aria-hidden className="mt-0!" />
      <span className="flex-1 font-medium">
        Could not load the course list.
      </span>
      <Button variant="secondary" size="sm" onClick={retryCatalogue}>
        Retry
      </Button>
    </Banner>
  );
}
