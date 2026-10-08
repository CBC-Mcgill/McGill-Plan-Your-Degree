import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { Notice } from "@/components/profile/use-import-flow";

export function ImportNotice({
  reading = false,
  notice,
}: {
  reading?: boolean;
  notice?: Notice | null;
}) {
  if (reading) {
    return (
      <p
        role="status"
        className="flex items-center gap-2.5 rounded-md border-2 border-in-progress/30 bg-in-progress-surface px-4 py-3 font-semibold text-in-progress"
      >
        <LoaderCircle
          aria-hidden
          className="size-5 shrink-0 animate-spin motion-reduce:animate-none"
        />
        Reading your transcript...
      </p>
    );
  }
  if (!notice) return null;
  const error = notice.kind === "error";
  const Icon = error ? CircleAlert : CircleCheck;
  return (
    <p
      role={error ? "alert" : "status"}
      className={`flex items-start gap-2.5 rounded-md border-2 px-4 py-3 font-semibold ${
        error
          ? "border-failed/30 bg-failed-surface text-failed"
          : "border-completed/30 bg-completed-surface text-completed"
      }`}
    >
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0" />
      {notice.text}
    </p>
  );
}
