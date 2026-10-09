"use client";

import { useState } from "react";
import { toast } from "@/components/toast";
import { COPY } from "@/lib/copy";
import { parseProfileFile, profileOf } from "@/lib/profile/file";
import { useProfileStore } from "@/lib/profile/store";
import { readTranscriptFile } from "@/lib/transcript/client";
import type { Transcript } from "@/lib/transcript/parse";
import type { ImportError } from "@/lib/transcript/result";

export interface ImportFailure {
  /** Null when a backup could not be restored. */
  code: ImportError | null;
  text: string;
}

// A real backup is far smaller. Reading less than the whole file keeps a huge one from filling memory.
const MAX_BACKUP_BYTES = 5_000_000;

/** Reading a transcript PDF and restoring a backup file. The import screen and the profile share it. */
export function useImportFlow() {
  const [reading, setReading] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [error, setError] = useState<ImportFailure | null>(null);

  async function importFile(file: File) {
    if (reading) return;
    setError(null);
    setReading(true);
    const result = await readTranscriptFile(file);
    setReading(false);
    if (result.ok) setTranscript(result.transcript);
    else setError({ code: result.error, text: result.message });
  }

  async function restoreFile(file: File) {
    setError(null);
    const result = parseProfileFile(
      await file.slice(0, MAX_BACKUP_BYTES).text(),
    );
    if (!result.ok) {
      setError({
        code: null,
        text: `This backup could not be restored. ${result.error}`,
      });
      return;
    }
    const store = useProfileStore.getState();
    const previous = profileOf(store);
    store.loadProfile(result.profile);
    toast("Profile restored", {
      label: COPY.undo,
      run: () => store.loadProfile(previous),
    });
  }

  return {
    reading,
    transcript,
    discardTranscript: () => setTranscript(null),
    importFile,
    error,
    restoreFile,
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
