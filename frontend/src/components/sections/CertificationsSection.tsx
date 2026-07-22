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
    <section className="pt-1 pb-3 lg:pt-1 lg:pb-4">
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
                  className="group flex w-full sm:w-[320px] flex-none flex-row items-center gap-4 rounded-md border border-line bg-white p-4 transition snap-start hover:border-brand hover:shadow-2xs"
                >
                  <div className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-grey transition-colors group-hover:bg-red-50">
                    <Icon size={24} className="text-brand" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-[15px] font-semibold leading-snug text-ink">{cert.title}</h4>
                    <p className="mt-0.5 text-[12.5px] leading-normal text-steel">{cert.description}</p>
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
