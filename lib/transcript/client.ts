import {
  IMPORT_ERROR_MESSAGES,
  type ImportError,
  type ReadResult,
} from "./result.ts";
import type { WorkerReply } from "./worker.ts";

export const READ_TIMEOUT_MS = 15_000;

const fail = (error: ImportError): ReadResult => ({
  ok: false,
  error,
  message: IMPORT_ERROR_MESSAGES[error],
});

/** Reads a transcript PDF in a Web Worker, so a malformed file cannot freeze the page. The file goes nowhere else. */
export function readTranscriptFile(file: File): Promise<ReadResult> {
  return new Promise((resolve) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      resolve(fail("unreadable"));
      return;
    }
    const finish = (result: ReadResult) => {
      clearTimeout(timer);
      worker.terminate();
      resolve(result);
    };
    const timer = setTimeout(() => finish(fail("timeout")), READ_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<Partial<WorkerReply> | null>) => {
      if (event.data && "transcriptResult" in event.data) {
        finish(event.data.transcriptResult ?? fail("unreadable"));
      }
    };
    worker.onerror = () => finish(fail("unreadable"));
    worker.postMessage(file);
  });
}
