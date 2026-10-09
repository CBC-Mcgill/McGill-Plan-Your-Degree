import { subjectHue } from "@/lib/subject-color";

/** A course code with its subject in a soft tag of the subject's color, so COMP, ECSE and MATH read apart in a list. */
export function CourseCode({ code }: { code: string }) {
  const [subject = code, number = ""] = code.split(" ");
  const hue = subjectHue(subject);
  return (
    <span className="inline-flex items-baseline gap-1">
      <span
        className="rounded-[4px] px-1"
        style={{
          color: `var(--subject-${hue})`,
          background: `var(--subject-${hue}-bg)`,
        }}
      >
        {subject}
      </span>{" "}
      {number}
    </span>
  );
}
