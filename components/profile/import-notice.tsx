import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react";
import type { Notice } from "@/components/profile/use-import-flow";
import { Banner } from "@/components/ui/banner";

export function ImportNotice({
  reading = false,
  notice,
}: {
  reading?: boolean;
  notice?: Notice | null;
}) {
  if (reading) {
    return (
      <Banner
        tone="progress"
        role="status"
        className="items-center px-4 py-3 font-medium"
      >
        <LoaderCircle
          aria-hidden
          className="mt-0! animate-spin motion-reduce:animate-none"
        />
        Reading your transcript...
      </Banner>
    );
  }
  if (!notice) return null;
  const error = notice.kind === "error";
  const Icon = error ? CircleAlert : CircleCheck;
  return (
    <Banner
      tone={error ? "danger" : "success"}
      role={error ? "alert" : "status"}
      className="px-4 py-3 font-medium"
    >
      <Icon aria-hidden />
      {notice.text}
    </Banner>
  );
}
