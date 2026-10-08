"use client";

import { useState } from "react";
import { parseProfileFile } from "@/lib/profile/file";
import { useProfileStore } from "@/lib/profile/store";
import { readTranscriptFile } from "@/lib/transcript/client";
import type { Transcript } from "@/lib/transcript/parse";

export interface Notice {
  kind: "error" | "success";
  text: string;
}

// A real backup is far smaller. Reading less than the whole file keeps a huge one from filling memory.
const MAX_BACKUP_BYTES = 5_000_000;

/** Reading a transcript PDF and restoring a backup file. The import screen and the profile share it. */
export function useImportFlow() {
  const [reading, setReading] = useState(false);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  async function importFile(file: File) {
    if (reading) return;
    setNotice(null);
    setReading(true);
    const result = await readTranscriptFile(file);
    setReading(false);
    if (result.ok) setTranscript(result.transcript);
    else setNotice({ kind: "error", text: result.message });
  }

  async function restoreFile(file: File) {
    setNotice(null);
    const result = parseProfileFile(
      await file.slice(0, MAX_BACKUP_BYTES).text(),
    );
    if (result.ok) {
      useProfileStore.getState().loadProfile(result.profile);
      setNotice({ kind: "success", text: "Backup restored." });
    } else {
      setNotice({
        kind: "error",
        text: `This backup could not be restored. ${result.error}`,
      });
    }
  }

  return {
    reading,
    transcript,
    discardTranscript: () => setTranscript(null),
    importFile,
    notice,
    restoreFile,
  };
}

export type ImportFlow = ReturnType<typeof useImportFlow>;
