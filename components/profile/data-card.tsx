"use client";

import { ArchiveRestore, Download, FileUp, Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { exportProfile } from "@/lib/profile/file";
import { useProfileStore } from "@/lib/profile/store";

function downloadBackup() {
  const url = URL.createObjectURL(
    new Blob([exportProfile(useProfileStore.getState())], {
      type: "application/json",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `plan-your-degree-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export function DataCard({
  flow,
  onReset,
}: {
  flow: ImportFlow;
  onReset: () => void;
}) {
  const reset = useProfileStore((s) => s.reset);

  return (
    <section className="rounded-lg border-2 border-border bg-card p-6">
      <h2 className="text-xl">Your data</h2>
      <p className="mt-1 text-muted-foreground text-sm">
        It all lives in this browser. Nothing is sent anywhere.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button variant="secondary" className="px-5" onClick={downloadBackup}>
          <Download aria-hidden />
          Export a backup
        </Button>
        <FileButton
          variant="secondary"
          className="px-5"
          accept="application/json,.json"
          onFile={flow.restoreFile}
        >
          <ArchiveRestore aria-hidden />
          Restore from a backup
        </FileButton>
        <FileButton
          variant="secondary"
          className="px-5"
          accept="application/pdf,.pdf"
          onFile={flow.importFile}
          disabled={flow.reading}
        >
          <FileUp aria-hidden />
          Re-import a transcript
        </FileButton>

        <AlertDialog.Root>
          <AlertDialog.Trigger asChild>
            <Button variant="secondary" className="px-5 text-failed">
              <Trash2 aria-hidden />
              Delete all my data
            </Button>
          </AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/50" />
            <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-border-strong bg-card p-6 shadow-edge">
              <AlertDialog.Title className="text-2xl">
                Delete all my data?
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-3 text-muted-foreground">
                This removes your courses, program and plan from this browser.
                It cannot be undone, so export a backup first if you might want
                them back.
              </AlertDialog.Description>
              <div className="mt-6 flex justify-end gap-3">
                <AlertDialog.Cancel asChild>
                  <Button variant="secondary">Cancel</Button>
                </AlertDialog.Cancel>
                <AlertDialog.Action asChild>
                  <Button
                    onClick={() => {
                      reset();
                      onReset();
                    }}
                  >
                    Delete everything
                  </Button>
                </AlertDialog.Action>
              </div>
            </AlertDialog.Content>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>
    </section>
  );
}
