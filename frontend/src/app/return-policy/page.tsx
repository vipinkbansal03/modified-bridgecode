import type { Metadata } from "next";
import { ArrowRight, FileText, Mail, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ORDERS_EMAIL } from "@/utils/constants";
import { ReturnAccordion } from "./ReturnAccordion";
import { ReturnPageNav } from "./ReturnPageNav";

export const metadata: Metadata = {
  title: "Return & Refund Policy | Modern Orthodontics",
  description:
    "Review Modern Orthodontics return, credit, refund, and shipping damage policies.",
};

const updatedAt = "June 2026";

const sections = [
  {
    title: "Pricing & Policies",
    items: [
      "Modern Orthodontics continuously works on improving product quality, design, and manufacturing standards.",
      "The company reserves the right to improve, modify, discontinue, or change product design and prices without prior notice.",
      "Customers are solely responsible for appropriate product selection, application, and use. For any accepted product defect claim, the company responsibility is limited strictly to replacement of the product or credit for the purchase price.",
      "Written notice for any claimed defects must be submitted to our customer support within 30 days from the date of delivery.",
    ],
  },
  {
    title: "Return & Credit Policy",
    items: [
      "All return requests must be reviewed and approved by the Modern Orthodontics customer service team before processing.",
      "Returned items must be unused, clean, in saleable condition, and packed securely in their original container or packaging.",
      "A copy of the original invoice or invoice number, along with a detailed description of the return reason, must be included with the package.",
      "Eligible products may be returned for credit within 30 days from the shipment date.",
      "Returns due to change of mind, incorrect ordering, or wrong specification selection are generally not accepted.",
      "All approved returns must be shipped prepaid and insured. Modern Orthodontics is not liable for return shipments lost in transit.",
      "Shipment shortages or order errors should be reported to our customer service team within 7 days from the invoice date.",
      "Modern Orthodontics reserves the final right to accept, adjust, or decline any return request.",
    ],
  },
  {
    title: "Non-Returnable Products",
    items: [
      "Custom-made products, personalized items, and products produced on special order are strictly non-returnable.",
      "Pre-welded attachments, including standard, special placement, angulation, modified, or incomplete materials, are not returnable.",
      "Hazardous items and chemical products are non-returnable due to safety regulations.",
      "Products requiring refrigeration or special storage controls are not returnable.",
      "Expired items, close-out items, clearance merchandise, and selected sale items are not returnable.",
    ],
  },
  {
    title: "Ordering & Payment",
    items: [
      "Please specify the required quantity, shape, number, size, and colour where applicable for each item ordered.",
      "Wire transfer or payment details will be shared by the customer service team after order confirmation.",
      "Orders are processed only after advance receipt of the full invoice payment, unless separately agreed in writing by the company.",
    ],
  },
  {
    title: "Shipping & Damage Policy",
    items: [
      "Shipments are processed from our facility in Ludhiana, and freight or handling charges may apply as per actual carrier rates.",
      "Modern Orthodontics is not responsible for loss, theft, or damage of merchandise while in transit.",
      "Customers must inspect all shipments upon delivery and report any loss or damage directly to the courier service.",
      "Our customer service team will assist with required shipment damage documentation where possible to support carrier claims.",
    ],
  },
  {
    title: "Guarantee of Satisfaction",
    items: [
      "If a product is defective or does not perform satisfactorily after use, Modern Orthodontics may provide credit or exchange after technical review.",
      "The customer may be offered either product replacement or account credit, based on the approved case and company policy.",
    ],
  },
  {
    title: "Marketing Information",
    items: [
      "Registered users may receive marketing campaigns, newsletters, product updates, and event information from Modern Orthodontics.",
      "Users may contact us at any time if they wish to unsubscribe from marketing mailing lists.",
    ],
  },
];

const quickLinks = sections.map((section) => ({
  id: section.title.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and"),
  label: section.title,
  href: `#${section.title.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}`,
}));

export default function ReturnPolicyPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-line bg-[#FAFAFA]">
        <Container className="py-6 lg:py-[34px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
                CUSTOMER SERVICE
              </span>
              <h1 className="max-w-[640px] text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
                Return & Refund Policy
              </h1>
              <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
                Please read our return and credit guidelines carefully. We aim to ensure maximum satisfaction with every order.
              </p>
            </div>

            <aside className="rounded-2xl border border-line bg-white p-5 shadow-sm sm:rounded-3xl sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E31E24] text-white">
                  <ShieldCheck size={20} />
                </span>
                <div>
                  <p className="text-[13px] text-steel">Last updated</p>
                  <p className="text-[17px] font-semibold text-ink">
                    {updatedAt}
                  </p>
                </div>
              </div>
              <p className="mt-5 text-[14px] leading-6 text-steel">
                For return authorization and claims, contact our service desk.
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

      <section className="py-6 lg:py-[34px]">
        <Container>
          <ReturnAccordion sections={sections} />

          <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
              <ReturnPageNav links={quickLinks} />
            </aside>

            <div className="hidden space-y-5 lg:block">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={section.title.toLowerCase().replace(/\s+/g, "-").replace(/&/g, "and")}
                  className="scroll-mt-28 rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"
                >
                  <div className="mb-5 flex items-center gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#FFF1F1] text-[14px] font-bold text-[#E31E24]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink sm:text-[28px]">
                      {section.title}
                    </h2>
                  </div>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex gap-3 text-[15px] leading-7 text-steel"
                      >
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E31E24]" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}

              <section className="rounded-3xl bg-[#1A1A1A] p-6 text-white sm:p-8">
                <h2 className="text-[26px] font-semibold tracking-[-0.02em]">
                  Need return support?
                </h2>
                <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-white/70">
                  If you have questions about returns or exchanges, contact the Modern Orthodontics team.
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
            <h2 className="text-[22px] font-semibold tracking-[-0.02em]">
              Need return support?
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-white/70">
              If you have questions about returns or exchanges, contact the Modern Orthodontics team.
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
