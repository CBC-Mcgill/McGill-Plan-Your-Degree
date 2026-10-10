import { usePhone } from "@/components/profile/layout";
import type { ImportFailure } from "@/components/profile/use-import-flow";
import { Notice } from "@/components/ui/notice";

/** Reading a PDF, or why an import or a restore failed. `steps` points a wrong PDF at the Minerva steps beside it. */
export function ImportNotice({
  reading,
  error,
  steps = false,
}: {
  reading: boolean;
  error: ImportFailure | null;
  steps?: boolean;
}) {
  // The steps sit beside the notice, or under it on a phone.
  const where = usePhone() ? "below" : "on the right";
  if (reading) {
    return (
      <Notice tone="info" role="status">
        Reading your transcript...
      </Notice>
    );
  }
  if (!error) return null;
  return (
    <Notice tone="danger" role="alert">
      {error.text}
      {steps &&
        error.code === "not-transcript" &&
        ` Follow the steps ${where} to save the right page.`}
    </Notice>
  );
}
