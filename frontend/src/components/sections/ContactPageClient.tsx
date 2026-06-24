"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { ContactForm } from "@/components/forms/ContactForm";
import { DealerInquiryForm } from "@/components/forms/DealerInquiryForm";
import { COMPANY_ADDRESS, INDIA_PHONE, ORDERS_EMAIL, USA_ADDRESS, USA_EMAIL, USA_PHONE } from "@/utils/constants";
import { cn } from "@/utils/cn";

export function ContactPageClient() {
  const [tab, setTab] = useState<"general" | "dealer">("general");

  return (
    <Container className="py-16 lg:py-20">
      <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">Contact</span>
      <h1 className="max-w-[640px] text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
        Get in touch with our team
      </h1>
      <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
        For product enquiries, bulk orders or dealer applications — send us a message and our team will respond
        directly.
      </p>

      <div className="mt-11 grid grid-cols-1 gap-14 sm:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-7 flex gap-2.5">
            <button
              onClick={() => setTab("general")}
              className={cn(
                "rounded-pill px-5 py-2.5 text-[14.5px] font-medium transition-colors",
                tab === "general" ? "bg-ink text-white" : "bg-grey text-steel"
              )}
            >
              General Inquiry
            </button>
            <button
              onClick={() => setTab("dealer")}
              className={cn(
                "rounded-pill px-5 py-2.5 text-[14.5px] font-medium transition-colors",
                tab === "dealer" ? "bg-ink text-white" : "bg-grey text-steel"
              )}
            >
              Become a Dealer
            </button>
          </div>
          {tab === "general" ? <ContactForm /> : <DealerInquiryForm />}
        </div>

        <div className="border-t border-line pt-7 text-[14.5px] text-steel sm:border-t-0 sm:border-l sm:pt-0 sm:pl-9">
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
        </div>
      </div>
    </Container>
  );
}
