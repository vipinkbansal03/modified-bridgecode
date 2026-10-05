import type { Metadata } from "next";
import Link from "next/link";
import { Truck, Clock, ShieldCheck, Mail, Phone, MapPin, PackageCheck, AlertCircle } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ORDERS_EMAIL, INDIA_PHONE, COMPANY_ADDRESS } from "@/utils/constants";

export const metadata: Metadata = {
  title: "Shipping & Delivery Policy | Modern Orthodontics",
  description:
    "Review Modern Orthodontics shipping timelines, delivery coverage, dispatch procedures, and transit policies.",
};

const shippingHighlights = [
  {
    icon: Truck,
    title: "Free Shipping",
    description: "Available on domestic orders meeting minimum order values (e.g. Above INR 3,000).",
  },
  {
    icon: Clock,
    title: "Fast Delivery",
    description: "Standard delivery within 4 to 8 business days across serviceable domestic locations.",
  },
  {
    icon: ShieldCheck,
    title: "Insured & Tracked",
    description: "All consignments are packed under strict quality control and dispatched via reputed courier partners.",
  },
  {
    icon: PackageCheck,
    title: "Direct Facility Dispatch",
    description: "Dispatched directly from our primary manufacturing & fulfillment facility in Ludhiana, Punjab.",
  },
];

const shippingSections = [
  {
    title: "1. Order Processing & Dispatch",
    content: [
      "All orders are processed and prepared for shipment upon successful receipt and verification of advance payment.",
      "Standard stocked items are typically processed and handed over to courier carriers within 1 to 2 business days.",
      "Custom-manufactured products, specialized weldments, or high-volume custom bracket configurations may require additional production lead time, which will be communicated by your account representative.",
    ],
  },
  {
    title: "2. Shipping Timelines & Estimated Delivery",
    content: [
      "Domestic Indian shipments usually arrive within 4 to 8 working days from dispatch, depending on courier serviceability in your PIN code.",
      "Transit times are estimates provided by freight and courier partners and may occasionally be influenced by unforeseen logistics, weather conditions, or local holidays.",
      "Customers receive dispatch notifications along with a consignment tracking number as soon as the package leaves our warehouse.",
    ],
  },
  {
    title: "3. Shipping Charges & Free Delivery Threshold",
    content: [
      "Free standard shipping applies automatically on qualifying domestic orders above the configured threshold (e.g. INR 3,000) at checkout.",
      "For orders below the free delivery threshold or for express / specialized air cargo, actual freight charges calculated based on order weight, volume, and destination will apply.",
      "Export trade shipments and overseas logistics are governed by agreed Incoterms (e.g. FOB, CIF, or Ex-Works) and invoiced accordingly.",
    ],
  },
  {
    title: "4. Inspection & Transit Damage",
    content: [
      "Please inspect all packages carefully upon delivery before signing the courier acknowledgment.",
      "If the external packaging appears significantly crushed, tampered with, or damaged, note the damage on the delivery receipt and notify customer support immediately.",
      "Shortage, damage, or discrepancy claims must be reported to our customer support within 7 days of receiving the delivery, accompanied by photographs of the damaged outer box and product packaging.",
    ],
  },
  {
    title: "5. Address Accuracy & Re-Delivery",
    content: [
      "Customers are requested to provide complete, accurate clinic/hospital delivery addresses including PIN code and contact phone number.",
      "In the event of an undeliverable address or non-availability of the recipient, courier re-attempt charges or return freight may apply.",
    ],
  },
];

export default function ShippingPolicyPage() {
  return (
    <main className="bg-white">
      {/* Hero Section */}
      <section className="border-b border-[#E5E7EB] bg-[#FAFAFA]">
        <Container className="py-8 sm:py-12">
          <div className="max-w-[760px]">
            <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#E31E24]/20 bg-red-50/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#E31E24]">
              <Truck size={13} />
              Delivery & Logistics
            </span>
            <h1 className="text-[clamp(28px,3.5vw,42px)] font-bold leading-tight tracking-tight text-[#111827]">
              Shipping & Delivery Policy
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-[#4B5563]">
              At Modern Orthodontics, we strive to deliver precision clinical products safely and promptly to orthodontists, dealers, and hospitals worldwide.
            </p>
          </div>
        </Container>
      </section>

      {/* Highlights Bar */}
      <section className="border-b border-[#E5E7EB] bg-white">
        <Container className="py-6 sm:py-8">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {shippingHighlights.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="flex items-start gap-3.5 rounded-xl border border-gray-100 bg-[#FAFAFA] p-4 shadow-2xs">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-[#E31E24] border border-[#E31E24]/20">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#111827]">{item.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-[#4B5563]">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Detailed Policies Content */}
      <section className="py-10 sm:py-14">
        <Container>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            {/* Policy Articles */}
            <div className="space-y-8">
              {shippingSections.map((section, idx) => (
                <div key={idx} className="rounded-xl border border-gray-200 bg-white p-6 shadow-2xs">
                  <h2 className="text-[17px] font-bold text-[#111827]">{section.title}</h2>
                  <div className="mt-3.5 space-y-2.5">
                    {section.content.map((point, pIdx) => (
                      <div key={pIdx} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-[#374151]">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E31E24]" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-[13px] text-amber-900 flex items-start gap-3">
                <AlertCircle size={18} className="shrink-0 text-amber-700 mt-0.5" />
                <p className="leading-relaxed">
                  For policies regarding returns, credits, or defective product exchanges, please refer to our dedicated{" "}
                  <Link href="/return-policy" className="font-bold underline text-[#E31E24] hover:text-[#B5151B]">
                    Return &amp; Refund Policy
                  </Link>
                  .
                </p>
              </div>
            </div>

            {/* Sidebar / Support Card */}
            <div className="space-y-5">
              <div className="rounded-xl border border-[#E31E24]/30 bg-[#FFF5F5] p-6 shadow-2xs">
                <h3 className="text-[15px] font-bold text-[#111827]">Order &amp; Shipping Inquiries</h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-[#4B5563]">
                  Have questions about an existing consignment or need expedited air freight? Our logistics team is ready to help.
                </p>

                <div className="mt-5 space-y-3">
                  <a
                    href={`tel:${INDIA_PHONE}`}
                    className="flex items-center gap-2.5 rounded-lg border border-[#E31E24]/20 bg-white p-3 text-[13px] font-semibold text-[#111827] hover:border-[#E31E24] transition-colors"
                  >
                    <Phone size={15} className="text-[#E31E24]" />
                    <span>{INDIA_PHONE} (Toll Free)</span>
                  </a>

                  <a
                    href={`mailto:${ORDERS_EMAIL}`}
                    className="flex items-center gap-2.5 rounded-lg border border-[#E31E24]/20 bg-white p-3 text-[13px] font-semibold text-[#111827] hover:border-[#E31E24] transition-colors"
                  >
                    <Mail size={15} className="text-[#E31E24]" />
                    <span>{ORDERS_EMAIL}</span>
                  </a>

                  <div className="flex items-start gap-2.5 rounded-lg border border-gray-200 bg-white p-3 text-[12.5px] text-[#4B5563]">
                    <MapPin size={15} className="text-[#E31E24] shrink-0 mt-0.5" />
                    <span>{COMPANY_ADDRESS}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
