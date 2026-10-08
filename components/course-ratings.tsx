"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
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
    <section
      aria-labelledby="ratings-heading"
      className="mt-6 rounded-lg border-2 border-border bg-card p-6"
    >
      <h2 id="ratings-heading" className="text-lg">
        Student ratings
      </h2>
      <div className="mt-4 flex flex-col gap-4">
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
                <dl className="grid grid-cols-2 gap-5">
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
                <p className="font-semibold">No reviews yet</p>
                <SourceLink
                  href={url}
                  label="Write the first review on mcgill.courses"
                />
              </>
            )}
            <p className="text-muted-foreground text-sm">
              Ratings from mcgill.courses, written by McGill students.
            </p>
          </>
        )}
      </div>
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="font-semibold text-muted-foreground text-sm">{label}</dt>
      <dd className="mt-0.5">
        <span className="font-extrabold text-2xl">{value.toFixed(1)}</span>
        <span className="font-semibold text-muted-foreground text-sm">
          {" "}
          out of 5
        </span>
        <div
          aria-hidden
          className="relative mt-2 h-2 overflow-hidden rounded-sm bg-muted"
        >
          <div
            className="h-full bg-in-progress"
            style={{ width: `${(Math.min(5, Math.max(0, value)) / 5) * 100}%` }}
          />
          {[20, 40, 60, 80].map((left) => (
            <div
              key={left}
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-card"
              style={{ left: `${left}%` }}
            />
          ))}
        </div>
      </dd>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-busy className="grid grid-cols-2 gap-5 motion-safe:animate-pulse">
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
      className="font-semibold underline underline-offset-2 hover:text-primary"
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
