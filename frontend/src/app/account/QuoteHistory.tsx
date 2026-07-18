"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import Link from "next/link";
import type { CustomerQuoteSummary } from "@/services/customerApi";
import QuoteHistoryItem from "./QuoteHistoryItem";

interface QuoteHistoryProps {
  quotes: CustomerQuoteSummary[];
  isFetching: boolean;
}

export default function QuoteHistory({
  quotes,
  isFetching,
}: QuoteHistoryProps) {
  const [expandedQuoteId, setExpandedQuoteId] = useState<string | null>(null);

  const handleToggle = (quoteId: string) => {
    setExpandedQuoteId((current) => (current === quoteId ? null : quoteId));
  };

  return (
    <section className="rounded-md border border-line bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.06)]">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-brand" />
          <h2 className="text-[20px] font-semibold text-ink">Quote History</h2>
        </div>

        <span className="text-[13px] text-steel">
          {quotes.length} {quotes.length === 1 ? "quote" : "quotes"}
        </span>
      </div>

      {isFetching ? (
        <div className="rounded-md bg-grey p-8 text-center text-[14px] text-steel">
          Loading quotes...
        </div>
      ) : quotes.length ? (
        <div className="divide-y divide-line">
          {quotes.map((quote) => (
            <QuoteHistoryItem
              key={quote.id}
              quote={quote}
              expanded={expandedQuoteId === quote.id}
              onToggle={() => handleToggle(quote.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-md bg-grey p-8 text-center">
          <p className="text-[15px] font-medium text-ink">No quotes yet</p>

          <p className="mt-1 text-[13.5px] text-steel">
            Quote requests submitted through the website will appear here.
          </p>

          <Link
            href="/products"
            className="mt-4 inline-flex text-[13.5px] font-medium text-brand hover:underline"
          >
            Browse products
          </Link>
        </div>
      )}
    </section>
  );
}