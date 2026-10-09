"use client";

import { AlertDialog } from "radix-ui";
import { ImportNotice } from "@/components/profile/import-notice";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { toast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { Section } from "@/components/ui/section";
import { COPY } from "@/lib/copy";
import { exportProfile } from "@/lib/profile/file";
import { useProfileStore } from "@/lib/profile/store";

export function downloadBackup() {
  const url = URL.createObjectURL(
    new Blob([exportProfile(useProfileStore.getState())], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  // The en-CA format is year-month-day in local time.
  link.download = `plan-your-degree-backup-${new Date().toLocaleDateString("en-CA")}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast("Backup downloaded");
}

export function DataCard({ flow }: { flow: ImportFlow }) {
  const reset = useProfileStore((s) => s.reset);

  return (
    <Section id="data" title="Your data">
      <p className="text-fg-muted">
        It all lives in this browser, and nothing is sent anywhere.
      </p>
      {/* Wider than the 720 column on purpose, so the four data actions stay one row. */}
      <div className="-ml-3 mt-4 flex w-max items-center whitespace-nowrap">
        <Button variant="text" onClick={downloadBackup}>
          {COPY.exportBackup}
        </Button>
        <FileButton
          variant="text"
          accept="application/json,.json"
          onFile={flow.restoreFile}
        >
          {COPY.restore}
        </FileButton>
        <span className="mr-3 text-fg-muted">{COPY.restoreWarning}</span>
        <FileButton
          data-import
          variant="text"
          accept="application/pdf,.pdf"
          onFile={flow.importFile}
          disabled={flow.reading}
        >
          {COPY.reimport}
        </FileButton>
        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <Button variant="danger">{COPY.deleteAll}</Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-scrim transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none" />
            <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-bg p-6 shadow-float transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none">
              <AlertDialog.Title>Delete all your data?</AlertDialog.Title>
              <AlertDialog.Description className="mt-2">
                This removes your courses, program and plan from this browser.
              </AlertDialog.Description>
              <div className="mt-6 -mr-3 flex justify-end gap-2">
                <AlertDialog.Cancel asChild>
                  <Button variant="text">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button variant="danger" onClick={reset}>
                    Delete everything
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
      <div className="mt-4 empty:hidden">
        <ImportNotice reading={flow.reading} error={flow.error} />
      </div>
    </Section>
  );
}
