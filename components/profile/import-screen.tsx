"use client";

import { FileUp, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ImportNotice } from "@/components/profile/import-notice";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto my-auto grid w-full max-w-6xl grid-cols-[1.1fr_1fr] items-center gap-12 px-8 py-14">
      <div>
        <h1 className="text-4xl leading-[1.05] xl:text-5xl">
          Build your profile
        </h1>
        <p className="mt-4 max-w-[34rem] text-lg text-muted-foreground leading-relaxed">
          Import your unofficial transcript and your courses fill in on their
          own. You check everything before anything is saved.
        </p>

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
          className="mt-8 flex flex-col items-center gap-3 min-w-0 rounded-lg border-2 border-border-strong border-dashed bg-card px-8 py-9 text-center transition-colors data-[dragging=true]:border-primary data-[dragging=true]:bg-muted"
        >
          <legend className="sr-only">Transcript PDF</legend>
          <FileUp aria-hidden className="size-9 text-muted-foreground" />
          <FileButton
            accept="application/pdf,.pdf"
            onFile={flow.importFile}
            disabled={flow.reading}
          >
            Choose your transcript PDF
          </FileButton>
          <p className="text-muted-foreground text-sm">or drop the file here</p>
        </fieldset>

        <div className="mt-4 empty:hidden">
          <ImportNotice reading={flow.reading} notice={flow.notice} />
        </div>

        <div className="mt-6 flex items-center gap-4">
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

      <div>
        <figure className="rounded-lg border-2 border-border bg-card p-6">
          <figcaption className="font-bold text-lg">
            Get your PDF from Minerva
          </figcaption>
          <ol className="mt-4 grid gap-4">
            {steps.map((step, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the steps are fixed and never reordered
              <li key={i} className="flex items-center gap-4">
                <span
                  aria-hidden
                  className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-bold"
                >
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </figure>
        <p className="mt-5 flex items-start gap-3 text-muted-foreground">
          <ShieldCheck
            aria-hidden
            className="mt-0.5 size-5 shrink-0 text-completed"
          />
          Your transcript is read in this browser and never uploaded. Your name
          and McGill ID are not kept, only your courses.
        </p>
      </div>
    </div>
  );
}
