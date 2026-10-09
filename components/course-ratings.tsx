"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "@/components/external-link";
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

/** Student ratings from mcgill.courses as one facts-line link (D32). Only the course code leaves the browser, and review text is never shown, only linked. */
export function CourseRatings({ code }: { code: string }) {
  return <RatingsLink key={code} code={code} />;
}

function RatingsLink({ code }: { code: string }) {
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

  if (ratings === null) return null;
  const href = `https://mcgill.courses/course/${courseSlug(code)}`;
  if (ratings === "unavailable") {
    return <ExternalLink href={href}>Reviews on mcgill.courses</ExternalLink>;
  }
  const { rating, difficulty, reviews } = ratings;
  return (
    <ExternalLink href={href}>
      {reviews === 0
        ? "No reviews yet"
        : `Rating ${rating.toFixed(1)}, difficulty ${difficulty.toFixed(1)}, ${reviews.toLocaleString("en-CA")} ${reviews === 1 ? "review" : "reviews"}`}
      <span className="sr-only"> on mcgill.courses</span>
    </ExternalLink>
  );
}
