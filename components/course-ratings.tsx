"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { SectionCard } from "@/components/section-card";
import { ProgressBar } from "@/components/ui/progress";
import { courseSlug } from "@/lib/catalogue/slug";

interface Ratings {
  rating: number;
  difficulty: number;
  reviews: number;
}

// Failures are not cached, so a later visit tries again.
const cache = new Map<string, Ratings>();

async function fetchRatings(code: string) {
  const response = await fetch(
    `https://mcgill.courses/api/courses/${code.replace(" ", "")}`,
    {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal: AbortSignal.timeout(5000),
    },
  );
  if (!response.ok)
    throw new Error(`mcgill.courses returned ${response.status}`);
  const { course } = await response.json();
  const ratings: Ratings = {
    rating: course.avgRating,
    difficulty: course.avgDifficulty,
    reviews: course.reviewCount,
  };
  if (!Object.values(ratings).every(Number.isFinite)) {
    throw new Error("Unexpected response from mcgill.courses");
  }
  return ratings;
}

/** Student ratings from mcgill.courses. Only the course code leaves the browser, and review text is never shown, only linked. */
export function CourseRatings({ code }: { code: string }) {
  return <RatingsCard key={code} code={code} />;
}

function RatingsCard({ code }: { code: string }) {
  const [ratings, setRatings] = useState<Ratings | "unavailable" | null>(
    cache.get(code) ?? null,
  );

  useEffect(() => {
    if (cache.has(code)) return;
    let active = true;
    fetchRatings(code)
      .then((result) => {
        cache.set(code, result);
        if (active) setRatings(result);
      })
      .catch(() => {
        if (active) setRatings("unavailable");
      });
    return () => {
      active = false;
    };
  }, [code]);

  const url = `https://mcgill.courses/course/${courseSlug(code)}`;

  return (
    <SectionCard id="ratings" title="Student ratings">
      <div className="flex flex-col gap-3">
        {ratings === null && <Skeleton />}
        {ratings === "unavailable" && (
          <SourceLink
            href={url}
            label="See student reviews on mcgill.courses"
          />
        )}
        {typeof ratings === "object" && ratings !== null && (
          <>
            {ratings.reviews > 0 ? (
              <>
                <dl className="grid grid-cols-2 gap-4">
                  <Meter label="Rating" value={ratings.rating} />
                  <Meter label="Difficulty" value={ratings.difficulty} />
                </dl>
                <SourceLink
                  href={url}
                  label={`Read the ${ratings.reviews.toLocaleString("en-CA")} ${ratings.reviews === 1 ? "review" : "reviews"} on mcgill.courses`}
                />
              </>
            ) : (
              <>
                <p className="font-medium">No reviews yet</p>
                <SourceLink
                  href={url}
                  label="Write the first review on mcgill.courses"
                />
              </>
            )}
            <p className="text-[13px] text-muted-foreground">
              Ratings from mcgill.courses, written by McGill students.
            </p>
          </>
        )}
      </div>
    </SectionCard>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const text = `${value.toFixed(1)} out of 5`;
  return (
    <div>
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">
        <span className="font-semibold text-2xl tabular-nums">
          {value.toFixed(1)}
        </span>
        <span className="text-[13px] text-muted-foreground"> out of 5</span>
        <ProgressBar
          value={value}
          max={5}
          label={label}
          valueText={text}
          className="mt-2"
        />
      </dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-4 motion-safe:animate-pulse">
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-16 rounded-sm bg-muted" />
          <div className="h-7 w-20 rounded-sm bg-muted" />
          <div className="h-2 rounded-sm bg-muted" />
        </div>
      ))}
    </div>
  );
}

function SourceLink({ href, label }: { href: string; label: string }) {
  const split = label.lastIndexOf(" ") + 1;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium underline underline-offset-2 hover:text-primary"
    >
      {label.slice(0, split)}
      <span className="whitespace-nowrap">
        {label.slice(split)}
        <ExternalLink
          aria-hidden
          className="ml-1.5 inline size-4 align-text-bottom"
        />
      </span>
    </a>
  );
}
