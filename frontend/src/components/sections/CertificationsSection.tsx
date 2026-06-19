"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BadgeCheck, ShieldCheck, Stamp, Globe } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { CertificationItem } from "@/types/common.types";

const iconMap: Record<string, typeof BadgeCheck> = { BadgeCheck, ShieldCheck, Stamp, Globe };

interface CertificationsSectionProps {
  data: CertificationItem[];
}

export function CertificationsSection({ data }: CertificationsSectionProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          title="Certifications"
          action={
            <div className="flex gap-2.5">
              <button
                aria-label="Previous"
                onClick={() => scrollBy(-300)}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                aria-label="Next"
                onClick={() => scrollBy(300)}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          }
        />
        <div ref={viewportRef} className="slider-viewport">
          <div className="flex gap-4.5">
            {data.map((cert) => {
              const Icon = iconMap[cert.icon] ?? BadgeCheck;
              return (
                <Link
                  key={cert.title}
                  href={cert.href ?? "#"}
                  className="group flex w-[280px] flex-none flex-col rounded-md border border-line bg-white px-6.5 pt-7.5 transition-[padding] duration-200 hover:pt-6 snap-start"
                  style={{ minHeight: 300 }}
                >
                  <h4 className="max-w-[200px] text-[19px] font-medium leading-snug text-ink">{cert.title}</h4>
                  <p className="mt-2 text-[13.5px] text-steel">{cert.description}</p>
                  <div className="mt-auto -mx-6.5 flex h-[140px] items-center justify-center rounded-b-[5px] bg-grey">
                    <Icon size={42} className="text-brand" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
