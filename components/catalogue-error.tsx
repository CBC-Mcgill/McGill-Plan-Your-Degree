"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { retryCatalogue } from "@/lib/catalogue/client";

/** Shown in place of a page's course lists when the catalogue request fails. */
export function CatalogueError() {
  return (
    <Notice
      tone="danger"
      role="alert"
      action={
        <Button variant="secondary" onClick={retryCatalogue}>
          Retry
        </Button>
      }
    >
      Could not load the course list.
    </Notice>
  );
}
