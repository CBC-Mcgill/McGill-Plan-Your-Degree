"use client";

import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { COPY } from "@/lib/copy";
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
    <div className="mx-auto w-full max-w-page px-8 pt-6">
      <Notice
        tone="warn"
        role="alert"
        action={
          <Button
            variant="text"
            onClick={async () =>
              (await import("@/components/profile/data-card")).downloadBackup()
            }
          >
            {COPY.exportBackup}
          </Button>
        }
      >
        This browser could not save your profile. Export a backup before you
        leave.
      </Notice>
    </div>
  );
}
