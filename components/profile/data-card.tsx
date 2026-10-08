"use client";

import { ArchiveRestore, Download, FileUp, Trash2 } from "lucide-react";
import { AlertDialog } from "radix-ui";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <Card asChild className="p-5">
      <section>
        <h2 className="text-base">Your data</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          It all lives in this browser. Nothing is sent anywhere.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={downloadBackup}>
            <Download aria-hidden />
            Export a backup
          </Button>
          <FileButton
            variant="secondary"
            accept="application/json,.json"
            onFile={flow.restoreFile}
          >
            <ArchiveRestore aria-hidden />
            Restore from a backup
          </FileButton>
          <FileButton
            variant="secondary"
            accept="application/pdf,.pdf"
            onFile={flow.importFile}
            disabled={flow.reading}
          >
            <FileUp aria-hidden />
            Re-import a transcript
          </FileButton>

          <AlertDialog.Root>
            <AlertDialog.Trigger asChild>
              <Button variant="destructive">
                <Trash2 aria-hidden />
                Delete all my data
              </Button>
            </AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="fixed inset-0 z-50 bg-foreground/30" />
              <AlertDialog.Content className="fixed top-1/2 left-1/2 z-50 w-[28rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-card p-5 shadow-float">
                <AlertDialog.Title className="font-semibold text-lg">
                  Delete all my data?
                </AlertDialog.Title>
                <AlertDialog.Description className="mt-2 text-muted-foreground">
                  This removes your courses, program and plan from this browser.
                  It cannot be undone, so export a backup first if you might
                  want them back.
                </AlertDialog.Description>
                <div className="mt-5 flex justify-end gap-3">
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
    </Card>
  );
}
