import { MAX_FILE_BYTES, readTranscript } from "./index";
import type { ReadResult } from "./result";

export interface WorkerReply {
  /** Null when reading threw. */
  transcriptResult: ReadResult | null;
}

// pdf.js starts its own message handler in this worker and posts "ready" messages, so replies carry a key of their own.
self.onmessage = async (event: MessageEvent<File>) => {
  let transcriptResult: ReadResult | null = null;
  try {
    // One byte past the limit is enough for readTranscript to reject a big file without loading all of it.
    const buffer = await event.data.slice(0, MAX_FILE_BYTES + 1).arrayBuffer();
    transcriptResult = await readTranscript(new Uint8Array(buffer));
  } catch {}
  self.postMessage({ transcriptResult } satisfies WorkerReply);
};
