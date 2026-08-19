"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";
import { DealerInquiryForm } from "@/components/forms/DealerInquiryForm";
import { COMPANY_ADDRESS, INDIA_PHONE, ORDERS_EMAIL, USA_ADDRESS, USA_EMAIL, USA_PHONE } from "@/utils/constants";
import { cn } from "@/utils/cn";
import { useTrackingSettings } from "@/hooks/api/useTrackingSettings";
import type { CmsPage } from "@/hooks/api/useCmsContent";

interface ContactPageClientProps {
  cmsPage?: CmsPage | null;
}

export function ContactPageClient({ cmsPage }: ContactPageClientProps) {
  const { data: trackingSettings } = useTrackingSettings();
  const [tab, setTab] = useState<"general" | "dealer">("general");

  const indiaEmail = trackingSettings?.general?.email || ORDERS_EMAIL;
  const indiaPhone = trackingSettings?.general?.phone || INDIA_PHONE;
  const indiaAddress = trackingSettings?.general?.address || COMPANY_ADDRESS;

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
  const sectionHeading = officesSection?.title;
  const sectionSubtitle = officesSection?.subtitle;
  const officeBlocks = officesSection?.blocks?.filter((b) => b.blockType === "office" || b.blockType === "card") || [];

  // Filter out any manual "Corporate Office" / "India Office" block from CMS blocks since it is auto-populated live from Settings -> General
  const customDepartmentBlocks = officeBlocks.filter(
    (b) => !b.title?.toLowerCase().includes("corporate office") && !b.title?.toLowerCase().includes("india office")
  );

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

        <div className="border-t border-line pt-7 text-[14.5px] text-steel sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 space-y-6">
          {sectionHeading && (
            <div className="border-b border-line pb-3">
              <h2 className="text-[12.5px] font-bold uppercase tracking-wider text-steel">
                {sectionHeading}
              </h2>
              {sectionSubtitle && (
                <p className="mt-0.5 text-[12.5px] text-steel/80">
                  {sectionSubtitle}
                </p>
              )}
            </div>
          )}

          {/* Main Corporate Office (Auto-synchronized live from Settings → General) */}
          <div>
            <h3 className="mb-2 text-base font-semibold text-ink">
              Corporate Office
            </h3>
            {trackingSettings?.general?.companyName && (
              <p className="mb-1 font-medium text-ink">
                {trackingSettings.general.companyName}
              </p>
            )}
            {indiaEmail && (
              <p className="mb-1">
                <a href={`mailto:${indiaEmail}`} className="text-brand hover:underline">
                  {indiaEmail}
                </a>
              </p>
            )}
            {indiaPhone && (
              <p className="mb-1 text-ink font-medium">
                {indiaPhone}
              </p>
            )}
            {indiaAddress && (
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed text-steel">
                {indiaAddress}
              </p>
            )}
          </div>

          {/* Secondary CMS Department Blocks (e.g. Export Support, Regional Branches) */}
          {customDepartmentBlocks.map((office, idx) => (
            <div key={office.id || idx}>
              <h3 className="mb-2 text-base font-semibold text-ink">{office.title}</h3>
              {office.linkLabel && (
                <p className="mb-1">
                  <a
                    href={office.linkUrl?.startsWith("mailto:") ? office.linkUrl : `mailto:${office.linkLabel}`}
                    className="text-brand hover:underline"
                  >
                    {office.linkLabel}
                  </a>
                </p>
              )}
              {office.subtitle && <p className="mb-1 text-ink font-medium">{office.subtitle}</p>}
              {office.description && (
                <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{office.description}</p>
              )}
            </div>
          ))}

          {/* Standard USA Office fallback if no other department blocks configured */}
          {customDepartmentBlocks.length === 0 && (
            <div>
              <h3 className="mb-2 text-base font-semibold text-ink">USA Office</h3>
              <p className="mb-1">
                <a href={`mailto:${USA_EMAIL}`} className="text-brand hover:underline">
                  {USA_EMAIL}
                </a>
              </p>
              <p className="mb-1">{USA_PHONE}</p>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{USA_ADDRESS}</p>
            </div>
          )}
        </div>
      </div>
    </Container>
  );
}
