"use client";

import { cn } from "cn";
import { type ReactNode, useEffect, useState } from "react";
import { seasonsOffered } from "@/components/course-row";
import { ExternalLink } from "@/components/external-link";
import { CARD } from "@/components/ui/card";
import { Term } from "@/components/ui/tooltip";
import meta from "@/data/catalogue/meta.json";
import { courseSlug } from "@/lib/catalogue/slug";
import type { CourseSummary } from "@/lib/catalogue/types";
import { COPY } from "@/lib/copy";
import { partRoutes } from "@/lib/engine/parts";
import { GLOSSARY } from "@/lib/glossary";

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

/**
 * The full-width bar of what students compare: credits, terms, and the rating, difficulty and review count from mcgill.courses (D32).
 * Only the course code leaves the browser, and review text is never shown, only linked. Without reviews the three ratings become one fact.
 */
export function CourseFactsBar({ course }: { course: CourseSummary }) {
  const terms = partRoutes(course)[0]?.length ?? 0;
  const offered = seasonsOffered(course);
  return (
    <dl
      className={cn(
        CARD,
        "mt-8 grid grid-cols-[repeat(4,minmax(max-content,1fr))_minmax(max-content,1.4fr)]",
      )}
    >
      <Fact label="Credits">
        {course.credits ?? <Unit>Not listed</Unit>}
        {terms > 1 && (
          <Unit>
            {" "}
            over <Term def={GLOSSARY.multiTerm}>{terms} terms</Term>
          </Unit>
        )}
      </Fact>
      <Fact label="Offered">
        {offered === COPY.notOfferedYear
          ? `Not in ${meta.catalogueYear}`
          : offered}
      </Fact>
      <RatingFacts
        key={course.code}
        code={course.parts?.[0]?.code ?? course.code}
      />
    </dl>
  );
}

function Fact({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "border-line border-l px-5 py-4 first:border-l-0",
        className,
      )}
    >
      <dt className="text-fg-muted">{label}</dt>
      <dd className="mt-1 whitespace-nowrap font-semibold text-xl leading-7">
        {children}
      </dd>
    </div>
  );
}

/** "of 5" after a figure: muted, regular weight, body size. */
function Unit({ children }: { children: ReactNode }) {
  return (
    <span className="font-normal text-base text-fg-muted">{children}</span>
  );
}

function RatingFacts({ code }: { code: string }) {
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

  const href = `https://mcgill.courses/course/${courseSlug(code)}`;
  const label = "Reviews on mcgill.courses";
  if (ratings === null) {
    return ["Rating", "Difficulty", label].map((name) => (
      <Fact key={name} label={name}>
        <span
          aria-hidden
          className="inline-block h-5 w-12 rounded-md bg-tint align-middle motion-safe:animate-pulse"
        />
        <span className="sr-only">Loading</span>
      </Fact>
    ));
  }
  if (ratings === "unavailable" || ratings.reviews === 0) {
    return (
      <Fact label={label} className="col-span-3">
        <ExternalLink href={href}>
          {ratings === "unavailable" ? "See the site" : "None yet"}
        </ExternalLink>
      </Fact>
    );
  }
  const { rating, difficulty, reviews } = ratings;
  return (
    <>
      <Fact label="Rating">
        {rating.toFixed(1)} <Unit>of 5</Unit>
      </Fact>
      <Fact label="Difficulty">
        {difficulty.toFixed(1)} <Unit>of 5</Unit>
      </Fact>
      <Fact label={label}>
        <ExternalLink href={href}>
          {reviews.toLocaleString("en-CA")}
          <span className="sr-only"> reviews on mcgill.courses</span>
        </ExternalLink>
      </Fact>
    </>
  );
}
