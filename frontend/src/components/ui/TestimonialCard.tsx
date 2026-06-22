"use client";

import { Quote } from "lucide-react";
import { motion } from "framer-motion";

export interface TestimonialCardProps {
  name: string;
  quote: string;
}

export function TestimonialCard({ name, quote }: TestimonialCardProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex h-full w-[320px] flex-none snap-start flex-col overflow-hidden rounded-md border border-line"
    >
      <div className="flex h-[240px] items-center justify-center bg-ink">
        <Quote size={48} className="text-white/45" />
      </div>
      <div className="flex flex-1 flex-col px-5.5 py-5">
        <p className="text-base font-semibold text-ink">{name}</p>
        <p className="mt-2 text-[14.5px] text-steel">{quote}</p>
      </div>
    </motion.div>
  );
}
