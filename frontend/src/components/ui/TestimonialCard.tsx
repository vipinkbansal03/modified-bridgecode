"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export interface TestimonialCardProps {
  name: string;
  quote: string;
  image?: string;
}

const DOCTOR_AVATARS: Record<string, string> = {
  "Dr. Mathew P. Sunny": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?fm=jpg&q=80&w=200&auto=format&fit=crop",
  "Dr. Mathew P Sunny": "https://images.unsplash.com/photo-1622253692010-333f2da6031d?fm=jpg&q=80&w=200&auto=format&fit=crop",
  "Dr. Neil David Andrade": "https://images.unsplash.com/photo-1537368910025-700350fe46c7?fm=jpg&q=80&w=200&auto=format&fit=crop",
  "Dr. Shiv Priya Aher": "https://images.unsplash.com/photo-1651008376811-b90baee60c1f?fm=jpg&q=80&w=200&auto=format&fit=crop",
  "Dr. Aby Augustine": "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?fm=jpg&q=80&w=200&auto=format&fit=crop",
  "Rohit Jain": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?fm=jpg&q=80&w=200&auto=format&fit=crop",
};

export function TestimonialCard({ name, quote, image }: TestimonialCardProps) {
  const [imgError, setImgError] = useState(false);
  const avatarSrc = (!imgError && (image || DOCTOR_AVATARS[name] || DOCTOR_AVATARS[name.replace(/\./g, "")])) || null;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group relative flex h-full w-full flex-col justify-between rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] hover:border-gray-300 transition-all duration-300"
    >
      {/* Testimonial Quote Text with red quotation marks */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-[13px] sm:text-[13.5px] lg:text-[14px] leading-relaxed text-gray-700 text-center">
          <span className="font-serif font-bold text-red-600 text-base sm:text-lg mr-1 select-none">“</span>
          {quote}
          <span className="font-serif font-bold text-red-600 text-base sm:text-lg ml-1 select-none">”</span>
        </p>
      </div>

      {/* Doctor Avatar and Name */}
      <div className="mt-6 flex flex-col items-center justify-center">
        <div className="relative h-16 w-16 sm:h-18 sm:w-18 overflow-hidden rounded-full border-2 border-gray-100 shadow-sm bg-gray-50 shrink-0">
          {avatarSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={avatarSrc}
              alt={name}
              onError={() => setImgError(true)}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-red-50 text-[#E31E24] font-bold text-lg">
              {name.charAt(0)}
            </div>
          )}
        </div>
        <h4 className="mt-3 text-center text-[15px] sm:text-[16px] font-bold text-gray-900 tracking-tight">
          {name}
        </h4>
      </div>
    </motion.div>
  );
}
