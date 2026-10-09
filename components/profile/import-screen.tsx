"use client";

import { FileUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ImportNotice } from "@/components/profile/import-notice";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileButton } from "@/components/ui/file-button";

const steps = [
  <>
    Log in to Minerva and open <strong>Student Records</strong>.
  </>,
  <>
    Choose <strong>View Your Unofficial Transcript</strong>.
  </>,
  <>
    Print the page and choose <strong>Save as PDF</strong>.
  </>,
];

export function ImportScreen({
  flow,
  onStartEmpty,
}: {
  flow: ImportFlow;
  onStartEmpty: () => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mx-auto w-full max-w-page px-8 py-10">
      <h1>Build your profile</h1>
      <p className="mt-1 max-w-prose text-muted-foreground">
        Import your unofficial transcript and your courses fill in on their own.
        You check everything before anything is saved.
      </p>

      <div className="mt-6 grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-6">
        <div className="flex flex-col gap-4">
          <fieldset
            onDragEnter={() => setDragging(true)}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragging(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              const file = event.dataTransfer.files[0];
              if (file) flow.importFile(file);
            }}
            data-dragging={dragging}
            className="flex min-w-0 flex-col items-center gap-3 rounded-lg border border-input border-dashed bg-card px-8 py-10 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-subtle"
          >
            <legend className="sr-only">Transcript PDF</legend>
            <FileUp
              aria-hidden
              className="size-8 text-muted-foreground"
              strokeWidth={1.5}
            />
            <FileButton
              data-import
              size="lg"
              accept="application/pdf,.pdf"
              onFile={flow.importFile}
              disabled={flow.reading}
            >
              Choose your transcript PDF
            </FileButton>
            <p className="text-[13px] text-muted-foreground">
              or drop the file here
            </p>
          </fieldset>

          <div className="empty:hidden">
            <ImportNotice reading={flow.reading} notice={flow.notice} />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={onStartEmpty}>
              Start without a transcript
            </Button>
            <FileButton
              variant="secondary"
              accept="application/json,.json"
              onFile={flow.restoreFile}
            >
              Restore from a backup file
            </FileButton>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card asChild className="p-5">
            <figure>
              <figcaption className="text-sm font-semibold leading-5">
                Get your PDF from Minerva
              </figcaption>
              <ol className="mt-3 grid gap-3">
                {steps.map((step, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the steps are fixed and never reordered
                  <li key={i} className="flex items-center gap-4">
                    <span
                      aria-hidden
                      className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-semibold text-[13px]"
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </figure>
          </Card>
          <p className="flex items-start gap-2.5 text-muted-foreground">
            <ShieldCheck
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-completed"
            />
            Your transcript is read in this browser and never uploaded. Your
            name and McGill ID are not kept, only your courses.
          </p>
        </div>
      </div>
    </div>
  );
}
