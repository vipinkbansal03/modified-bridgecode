// components/ui/PillCTA.tsx

import { ArrowRight } from "lucide-react";

interface PillCTAProps {
  href: string;
  label: string;
  className?: string;
}

export function PillCTA({ href, label, className = "" }: PillCTAProps) {
  return (
    <a href={href} className={`pill-cta group ${className}`}>
      <span>{label}</span>

      <span className="arrow overflow-hidden">
        <span className="relative block h-4 w-4">
          <ArrowRight
            size={16}
            className="absolute inset-0 text-white transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-8"
          />

          <ArrowRight
            size={16}
            className="absolute inset-0 -translate-x-8 text-white transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-0"
          />
        </span>
      </span>
    </a>
  );
}