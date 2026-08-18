"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";
import { DealerInquiryForm } from "@/components/forms/DealerInquiryForm";
import { COMPANY_ADDRESS, INDIA_PHONE, ORDERS_EMAIL, USA_ADDRESS, USA_EMAIL, USA_PHONE } from "@/utils/constants";
import { cn } from "@/utils/cn";
import type { CmsPage } from "@/hooks/api/useCmsContent";

interface ContactPageClientProps {
  cmsPage?: CmsPage | null;
}

export function ContactPageClient({ cmsPage }: ContactPageClientProps) {
  const [tab, setTab] = useState<"general" | "dealer">("general");

  // Dynamic CMS copy
  const heroSection = cmsPage?.sections?.find(
    (s) => s.sectionKey === "contact.hero" || s.sectionKey.endsWith(".hero")
  );
  const heroBlock = heroSection?.blocks?.[0];
  const kicker = heroBlock?.subtitle || "Contact";
  const heading = heroBlock?.title || "Get in touch with our team";
  const intro =
    heroBlock?.description ||
    "For product enquiries, bulk orders or dealer applications — send us a message and our team will respond directly.";

  const officesSection = cmsPage?.sections?.find((s) => s.sectionKey === "contact.offices");
  const officeBlocks = officesSection?.blocks?.filter((b) => b.blockType === "office" || b.blockType === "card") || [];

  return (
    <Container className="py-6 lg:py-[34px]">
      <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
        {kicker}
      </span>
      <h1 className="max-w-[640px] text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
        {heading}
      </h1>
      <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
        {intro}
      </p>

      <div className="mt-11 grid grid-cols-1 gap-6 lg:gap-14 sm:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-7 flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => setTab("general")}
              className={cn(
                "rounded-pill px-3.5 py-2 text-[13px] sm:px-5 sm:py-2.5 sm:text-[14.5px] font-medium transition-colors whitespace-nowrap",
                tab === "general" ? "bg-ink text-white" : "bg-grey text-steel"
              )}
            >
              General Inquiry
            </button>
            <button
              onClick={() => setTab("dealer")}
              className={cn(
                "rounded-pill px-3.5 py-2 text-[13px] sm:px-5 sm:py-2.5 sm:text-[14.5px] font-medium transition-colors whitespace-nowrap",
                tab === "dealer" ? "bg-ink text-white" : "bg-grey text-steel"
              )}
            >
              Become a Dealer
            </button>
          </div>
          {tab === "general" ? <ContactForm /> : <DealerInquiryForm />}
        </div>

        <div className="border-t border-line pt-7 text-[14.5px] text-steel sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
          {officeBlocks.length > 0 ? (
            <div className="space-y-6">
              {officeBlocks.map((office, idx) => (
                <div key={office.id || idx}>
                  <h3 className="mb-2 text-base font-semibold text-ink">{office.title}</h3>
                  {office.linkLabel && (
                    <p className="mb-1">
                      <a href={office.linkUrl?.startsWith("mailto:") ? office.linkUrl : `mailto:${office.linkLabel}`} className="text-brand">
                        {office.linkLabel}
                      </a>
                    </p>
                  )}
                  {office.subtitle && <p className="mb-1">{office.subtitle}</p>}
                  {office.description && <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{office.description}</p>}
                </div>
              ))}
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-base font-medium text-ink">India Office</h3>
              <p className="mb-1.5">
                <a href={`mailto:${ORDERS_EMAIL}`} className="text-brand">
                  {ORDERS_EMAIL}
                </a>
              </p>
              <p className="mb-1.5">{INDIA_PHONE}</p>
              <p className="mb-7">{COMPANY_ADDRESS}</p>
              <h3 className="mb-3 text-base font-medium text-ink">USA Office</h3>
              <p className="mb-1.5">
                <a href={`mailto:${USA_EMAIL}`} className="text-brand">
                  {USA_EMAIL}
                </a>
              </p>
              <p className="mb-1.5">{USA_PHONE}</p>
              <p>{USA_ADDRESS}</p>
            </>
          )}
        </div>
      </div>
    </Container>
  );
}
