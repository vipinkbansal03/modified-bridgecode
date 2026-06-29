import type { Metadata } from "next";
import { ArrowRight, FileText, Mail, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ORDERS_EMAIL } from "@/utils/constants";
import { TermsAccordion } from "./TermsAccordion";
import { TermsPageNav } from "./TermsPageNav";

export const metadata: Metadata = {
  title: "Terms & Conditions | Modern Orthodontics",
  description: "Review Modern Orthodontics terms, policies, shipping, returns, payments, and ordering conditions.",
};

const updatedAt = "June 2026";

const sections = [
  {
    title: "Pricing and policies",
    items: [
      "Modern Orthodontics continuously works on improving product quality, design, and manufacturing standards.",
      "The company may improve, modify, discontinue, or change product design and prices without prior notice.",
      "Customers are responsible for product selection and use. For any accepted product defect claim, the company responsibility is limited to replacement or credit for the purchase price.",
      "Written notice for claimed defects should be submitted within 30 days from the date of delivery.",
    ],
  },
  {
    title: "Return and credit policy",
    items: [
      "All return requests must be approved by the Modern Orthodontics customer service team before processing.",
      "Returned items must be unused, clean, saleable, and packed in their original container or packaging.",
      "A copy of the invoice or invoice number, along with a clear description of the issue, must be included with returns.",
      "Eligible products may be returned for credit within 30 days from the shipment date.",
      "Returns due to change of mind, incorrect ordering, or wrong specification selection may not be accepted.",
      "All approved returns must be shipped prepaid and insured.",
      "Shipment shortages or order errors should be reported within 7 days from the invoice date.",
      "Modern Orthodontics reserves the right to accept or decline any return request.",
    ],
  },
  {
    title: "Non-returnable products",
    items: [
      "Custom-made products and products produced on special order are not returnable.",
      "Pre-welded attachments, including standard, special placement, angulation, modified, or incomplete materials, are not returnable.",
      "Hazardous items and chemical products are not returnable.",
      "Products requiring refrigeration are not returnable.",
      "Expired items, close-out items, and selected sale merchandise are not returnable.",
    ],
  },
  {
    title: "Ordering and payment",
    items: [
      "Please specify the required quantity, shape, number, size, and colour where applicable for each item ordered.",
      "Wire transfer or payment details may be shared by the customer service team after order confirmation.",
      "Orders are processed after advance receipt of the full invoice payment, unless separately agreed by the company.",
    ],
  },
  {
    title: "Shipping and damage policies",
    items: [
      "Shipments are processed from Ludhiana, and freight or handling charges may apply as per actuals.",
      "Modern Orthodontics is not responsible for loss or damage of merchandise while in transit.",
      "Customers should inspect shipments and report any loss or damage directly to the courier service.",
      "The Modern Orthodontics customer service team may assist with required shipment damage documentation where possible.",
    ],
  },
  {
    title: "Guarantee of satisfaction",
    items: [
      "If a product is defective or does not perform satisfactorily after use, Modern Orthodontics may provide credit or exchange after review.",
      "The customer may be offered either credit or replacement, based on the approved case and company policy.",
    ],
  },
  {
    title: "Marketing information",
    items: [
      "Registered users may receive marketing campaigns, newsletters, product updates, and event information from Modern Orthodontics.",
      "Users may contact the company at any time if they wish to unsubscribe from marketing mailing lists.",
    ],
  },
];

const quickLinks = sections.map((section) => ({
  id: section.title.toLowerCase().replace(/\s+/g, "-"),
  label: section.title,
  href: `#${section.title.toLowerCase().replace(/\s+/g, "-")}`,
}));

export default function TermsAndConditionsPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-line bg-[#FAFAFA] py-16 sm:py-20 lg:py-24">
        <Container className="px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_360px] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-[12px] font-semibold text-steel shadow-sm sm:text-[13px]">
                <FileText size={15} className="text-[#E31E24]" />
                Legal information
              </div>
              <h1 className="max-w-[820px] text-[38px] font-black leading-[0.98] tracking-[-0.04em] text-ink sm:text-[54px] lg:text-[74px]">
                Terms & Conditions
              </h1>
              <p className="mt-5 max-w-[720px] text-[15px] leading-7 text-steel sm:text-[16px] sm:leading-8 lg:text-[17px]">
                Please read these terms carefully before using the Modern Orthodontics website or placing an order.
              </p>
            </div>

            <aside className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E31E24] text-white">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-[13px] text-steel">Last updated</p>
                  <p className="text-[17px] font-semibold text-ink">{updatedAt}</p>
                </div>
              </div>
              <p className="mt-5 text-[14px] leading-6 text-steel">
                For order-specific queries, contact our support team with your order details.
              </p>
              <a
                href={`mailto:${ORDERS_EMAIL}`}
                className="mt-5 inline-flex items-center gap-2 text-[14px] font-semibold text-[#E31E24] hover:underline"
              >
                <Mail size={15} />
                {ORDERS_EMAIL}
              </a>
            </aside>
          </div>
        </Container>
      </section>

      <section className="py-10 sm:py-12 lg:py-20">
        <Container className="px-4 sm:px-6 lg:px-10">
          <TermsAccordion sections={sections} />

          <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
              <TermsPageNav links={quickLinks} />
            </aside>

            <div className="hidden space-y-5 lg:block">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={section.title.toLowerCase().replace(/\s+/g, "-")}
                  className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F1] text-[14px] font-bold text-[#E31E24]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[30px]">
                      {section.title}
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-[15px] leading-7 text-steel">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E31E24]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <section className="rounded-3xl bg-[#1A1A1A] p-6 text-white sm:p-8">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">Need help with an order?</h2>
                <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-white/70">
                  If you have questions about these terms, delivery, returns, or payments, please contact the Modern Orthodontics team before placing your order.
                </p>
                <a
                  href={`mailto:${ORDERS_EMAIL}`}
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E31E24] px-5 py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B]"
                >
                  Contact support
                  <ArrowRight size={16} />
                </a>
              </section>
            </div>
          </div>

          <section className="mt-4 rounded-2xl bg-[#1A1A1A] p-5 text-white sm:mt-5 sm:p-6 lg:hidden">
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">Need help with an order?</h2>
            <p className="mt-3 text-[14px] leading-6 text-white/70">
              If you have questions about these terms, delivery, returns, or payments, please contact the Modern Orthodontics team before placing your order.
            </p>
            <a
              href={`mailto:${ORDERS_EMAIL}`}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B]"
            >
              Contact support
              <ArrowRight size={15} />
            </a>
          </section>
        </Container>
      </section>
    </main>
  );
}
