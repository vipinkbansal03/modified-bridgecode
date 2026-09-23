"use client";

import Link from "next/link";
import { BadgeCheck, ShieldCheck, Stamp, Globe, Award, CheckCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { CertificationItem } from "@/types/common.types";

const iconMap: Record<string, typeof BadgeCheck> = {
  BadgeCheck,
  ShieldCheck,
  Stamp,
  Globe,
  Award,
  CheckCircle,
};

interface CertificationsSectionProps {
  data: CertificationItem[];
}

export function CertificationsSection({ data }: CertificationsSectionProps) {
  if (!data || data.length === 0) return null;

  return (
    <section className="py-8 sm:py-10 lg:py-12 border-t border-gray-100 bg-white">
      <Container>
        <Reveal>
          <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                Certifications
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                International quality management and medical device regulatory standards
              </p>
            </div>
            <Link
              href="/quality-certifications"
              className="hidden sm:inline-flex items-center text-[13.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors"
            >
              View all certifications »
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-7">
            {data.map((cert, idx) => {
              const Icon = (cert.icon ? iconMap[cert.icon] : null) ?? ShieldCheck;
              const linkHref = cert.href?.trim() || "/quality-certifications";
              const isPdfOrDoc = linkHref.startsWith("http") || linkHref.endsWith(".pdf") || linkHref.includes("/uploads/");
              const linkLabel = cert.linkLabel?.trim() || "View certificate »";

              return (
                <Link
                  key={cert.title + idx}
                  href={linkHref}
                  target={isPdfOrDoc ? "_blank" : undefined}
                  rel={isPdfOrDoc ? "noopener noreferrer" : undefined}
                  className="group relative flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-4 sm:p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_32px_rgba(227,30,36,0.08)] hover:border-red-200 transition-all duration-300 overflow-hidden cursor-pointer"
                >
                  {/* Subtle top active indicator bar on hover */}
                  <div className="absolute inset-x-0 top-0 h-1 bg-transparent group-hover:bg-gradient-to-r group-hover:from-[#E31E24] group-hover:to-red-400 transition-all duration-300" />

                  <div>
                    {/* Large Image / Seal Container */}
                    <div className="relative mb-3.5 h-40 sm:h-44 w-full overflow-hidden rounded-xl bg-gray-100 border border-gray-100 flex items-center justify-center">
                      {cert.image ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={cert.image}
                          alt={cert.title}
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-red-50 text-[#E31E24] group-hover:bg-[#E31E24] group-hover:text-white transition-colors duration-300">
                          <Icon size={36} className="group-hover:scale-110 transition-transform duration-300" />
                        </div>
                      )}

                      {/* Top Right Verified Status Badge */}
                      <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/95 backdrop-blur-xs text-gray-700 border border-gray-200/80 shadow-xs">
                        <CheckCircle size={11} className="text-emerald-500" />
                        Verified
                      </span>
                    </div>

                    <h3
                      className="text-[16px] sm:text-[17px] font-bold text-gray-900 group-hover:text-[#E31E24] transition-colors tracking-tight line-clamp-1"
                      title={cert.title}
                    >
                      {cert.title}
                    </h3>

                    <p className="mt-1.5 text-[12.5px] sm:text-[13px] leading-relaxed text-gray-600 group-hover:text-gray-700 transition-colors line-clamp-3">
                      {cert.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 flex items-center justify-between border-t border-gray-100 text-[12.5px] font-semibold">
                    <span className="text-[#0066cc] group-hover:text-[#004d99] group-hover:underline transition-colors flex items-center gap-1">
                      {linkLabel}
                    </span>
                    {isPdfOrDoc && (
                      <span className="text-[10.5px] font-medium text-gray-400 uppercase tracking-wider bg-gray-50 border border-gray-200/60 px-1.5 py-0.5 rounded">
                        Document
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
