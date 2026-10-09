"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ImportNotice } from "@/components/profile/import-notice";
import type { ImportFlow } from "@/components/profile/use-import-flow";
import { Button } from "@/components/ui/button";
import { FileButton } from "@/components/ui/file-button";
import { COPY } from "@/lib/copy";

const hasFiles = (event: DragEvent) =>
  event.dataTransfer?.types.includes("Files") ?? false;

/** The whole page takes a dropped PDF. The overlay shows only while a file is over the window. */
function usePageDrop(onFile: (file: File) => void) {
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const over = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragging(true);
    };
    const leave = (event: DragEvent) => {
      if (event.relatedTarget === null) setDragging(false);
    };
    const drop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file) onFile(file);
    };
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [onFile]);
  return dragging;
}

export function ImportScreen({
  flow,
  onStartEmpty,
}: {
  flow: ImportFlow;
  onStartEmpty: () => void;
}) {
  const dragging = usePageDrop(flow.importFile);

  return (
    <div className="mx-auto w-full max-w-page px-8 pt-12">
      <h1>{COPY.importTranscript}</h1>
      <p className="mt-2 text-fg-muted">Your courses fill in on their own.</p>

      <div className="mt-8 grid grid-cols-2 items-start gap-12">
        <div>
          <FileButton
            data-import
            accept="application/pdf,.pdf"
            onFile={flow.importFile}
            disabled={flow.reading}
          >
            Choose your transcript PDF
          </FileButton>
          <p className="mt-2 text-fg-muted">or drop it anywhere on this page</p>
          <div className="mt-4 empty:hidden">
            <ImportNotice reading={flow.reading} error={flow.error} steps />
          </div>
          <div className="-ml-3 mt-6 flex items-center">
            <Button variant="text" onClick={onStartEmpty}>
              {COPY.startWithout}
            </Button>
            <FileButton
              variant="text"
              accept="application/json,.json"
              onFile={flow.restoreFile}
            >
              {COPY.restore}
            </FileButton>
          </div>
        </div>

        <div>
          <h2>Get your PDF from Minerva</h2>
          <ol className="mt-4 grid list-inside list-decimal gap-2">
            <li>
              Log in to Minerva and open{" "}
              <strong className="font-semibold">Student Records</strong>.
            </li>
            <li>
              Choose{" "}
              <strong className="font-semibold">
                View Your Unofficial Transcript
              </strong>
              .
            </li>
            <li>
              Print the page and choose{" "}
              <strong className="font-semibold">Save as PDF</strong>.
            </li>
          </ol>
          <p className="mt-4 flex items-start gap-2 text-fg-muted">
            <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
            {COPY.privacy} Your name and McGill ID are not kept, only your
            courses.
          </p>
        </div>
      </div>

      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-[90] grid place-items-center bg-scrim transition-opacity duration-[120ms] starting:opacity-0 motion-reduce:transition-none">
          <p className="rounded-lg bg-bg px-6 py-4 font-semibold shadow-float">
            Drop your transcript PDF
          </p>
        </div>
      )}
    </div>
  );
}
