"use client";

import { useEffect, useState } from "react";
import { Star } from "lucide-react";

interface ProductHeaderRatingProps {
  slug: string;
  initialRating?: number;
  initialCount?: number;
  liveRating?: number | null;
  liveCount?: number | null;
}

export function ProductHeaderRating({
  slug,
  initialRating = 0,
  initialCount = 0,
  liveRating,
  liveCount,
}: ProductHeaderRatingProps) {
  const [rating, setRating] = useState(initialRating);
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    if (liveRating !== undefined && liveRating !== null && liveCount !== undefined && liveCount !== null) {
      setRating(liveRating);
      setCount(liveCount);
      return;
    }

    // Fetch dynamic ratings from API
    async function fetchRatings() {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";
        const res = await fetch(`${API_BASE}/products/${slug}/reviews`);
        if (res.ok) {
          const json = await res.json();
          if (json.data?.averageRating !== undefined && json.data?.totalRatings !== undefined) {
            setRating(json.data.averageRating);
            setCount(json.data.totalRatings);
          }
        }
      } catch {
        // Fallback to default state on network fail
      }
    }

    fetchRatings();
  }, [slug, liveRating, liveCount]);

  if (count === 0) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-2.5 py-1 text-[13px]">
        <span className="text-[#6B7280] font-medium text-[12px]">No ratings yet</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-[#F3F4F6] bg-[#FAFAFA] px-2.5 py-1 text-[13px]">
      <span className="inline-flex items-center gap-1 rounded bg-[#16A34A] px-1.5 py-0.5 text-[11px] font-bold text-white">
        {rating.toFixed(1)} <Star size={11} className="fill-current" />
      </span>
      <span className="text-[#6B7280] font-medium">({count} {count === 1 ? "Rating" : "Ratings"})</span>
    </div>
  );
}
