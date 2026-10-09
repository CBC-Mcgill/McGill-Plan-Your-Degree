"use client";

import { TriangleAlert } from "lucide-react";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import {
  useProfileHydrated,
  useProfileStore,
  useSaveStatus,
} from "@/lib/profile/store";

/** Shown on every page while the browser refuses to save a profile worth keeping. */
export function StorageBanner() {
  const hydrated = useProfileHydrated();
  const failed = useSaveStatus((state) => state.failed);
  const hasProfile = useProfileStore(
    (state) =>
      state.records.length > 0 ||
      state.programId !== null ||
      state.plan.length > 0,
  );
  if (!hydrated || !failed || !hasProfile) return null;

  return (
    <div className="mx-auto w-full max-w-page px-8 pt-4">
      <Banner tone="warn" role="alert" className="items-center">
        <TriangleAlert aria-hidden className="mt-0 text-warn" />
        <p className="flex-1">
          This browser could not save your profile. Export a backup before you
          leave.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={async () =>
            (await import("@/components/profile/data-card")).downloadBackup()
          }
        >
          Export a backup
        </Button>
      </Banner>
    </div>
  );
}
