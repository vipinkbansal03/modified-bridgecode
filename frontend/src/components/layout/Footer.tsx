"use client";

import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { Container } from "@/components/ui/Container";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { COMPANY_ADDRESS, INFO_EMAIL, ORDERS_EMAIL, USA_ADDRESS, USA_EMAIL, USA_PHONE, INDIA_PHONE, SOCIAL_LINKS } from "@/utils/constants";
import type { StaticMessageKey } from "@/i18n/staticMessages";

function SocialIcon({ label }: { label: "Facebook" | "LinkedIn" | "X" | "Instagram" }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "currentColor", "aria-hidden": true as const };

  switch (label) {
    case "Facebook":
      return (
        <svg {...common}>
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6H16.7V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H7.7v3h2.6v8h3.2Z" />
        </svg>
      );
    case "LinkedIn":
      return (
        <svg {...common}>
          <path d="M6.9 8.7a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8ZM5.3 19V10h3.2v9H5.3Zm5 0V10h3.1v1.3h.1c.4-.8 1.5-1.6 3-1.6 3.2 0 3.8 2.1 3.8 4.8V19H17v-3.9c0-.9 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V19h-3.7Z" />
        </svg>
      );
    case "X":
      return (
        <svg {...common}>
          <path d="M18.9 3H21l-4.6 5.3L21.8 21h-4.5l-3.5-4.6L9.8 21H7.7l4.9-5.7L2.2 3h4.6l3.2 4.2L13.7 3h5.2Zm-1.6 15.3h1.2L7.4 5.6H6.1l11.2 12.7Z" />
        </svg>
      );
    case "Instagram":
      return (
        <svg {...common}>
          <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM18.4 6.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0ZM21 18.5c-.1 1.3-.4 2.5-1.4 3.5s-2.2 1.3-3.5 1.4c-1.4.1-5.7.1-8.1 0-1.3-.1-2.5-.4-3.5-1.4s-1.3-2.2-1.4-3.5c-.1-1.4-.1-5.7 0-8.1.1-1.3.4-2.5 1.4-3.5S6.7 2.6 8 2.5c1.4-.1 5.7-.1 8.1 0 1.3.1 2.5.4 3.5 1.4s1.3 2.2 1.4 3.5c.1 1.4.1 5.7 0 8.1ZM19 7.7c-.1-.9-.2-1.4-.5-1.8-.4-.4-.9-.5-1.8-.5-1.3-.1-5.2-.1-6.5 0-.9 0-1.4.2-1.8.5-.4.4-.5.9-.5 1.8-.1 1.3-.1 5.2 0 6.5 0 .9.2 1.4.5 1.8.4.4.9.5 1.8.5 1.3.1 5.2.1 6.5 0 .9 0 1.4-.2 1.8-.5.4-.4.5-.9.5-1.8.1-1.3.1-5.2 0-6.5Z" />
        </svg>
      );
  }
}

const footerColumns = [
  {
    heading: "About Us",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Manufacturing", href: "/manufacturing-services" },
      { label: "Quality Certifications", href: "/quality-certifications" },
      { label: "Mission", href: "/about#mission" },
    ],
  },
  {
    heading: "Products",
    links: [
      { label: "Aesthetic Brackets", href: "/products?category=aesthetic-brackets" },
      { label: "Metal Brackets", href: "/products?category=metal-brackets" },
      { label: "NiTi & SS Wires", href: "/products?category=niti-wires" },
      { label: "Molar Bands & Tubes", href: "/products?category=molar-bands" },
    ],
  },
  {
    heading: "Capabilities",
    links: [
      { label: "Design & Engineering", href: "/design-and-engineering" },
      { label: "OEM Services", href: "/oem-services" },
      { label: "Custom Packaging", href: "/custom-packaging" },
      { label: "Quality Control", href: "/quality-certifications" },
    ],
  },
  {
    heading: "Dealers & Bulk Orders",
    links: [
      { label: "Become a Dealer", href: "/contact" },
      { label: "Bulk & RFQ Pricing", href: "/products" },
      { label: "Product Catalogue", href: "https://www.modortho.com/public/catalog/Modern-Catalog.zip" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "https://www.modortho.com/blog" },
      { label: "Terms & Conditions", href: "https://www.modortho.com/page/terms-and-conditions" },
      { label: "Privacy Policy", href: "https://www.modortho.com/page/privacy-policy" },
    ],
  },
];

const socialIcons = [
  { href: SOCIAL_LINKS.facebook, label: "Facebook" as const },
  { href: SOCIAL_LINKS.linkedin, label: "LinkedIn" as const },
  { href: SOCIAL_LINKS.twitter, label: "X" as const },
  { href: SOCIAL_LINKS.instagram, label: "Instagram" as const },
];

const footerLabelKeys: Record<string, StaticMessageKey> = {
  "About Us": "ui.footer.about",
  Manufacturing: "ui.footer.manufacturing",
  "Quality Certifications": "ui.footer.qualityCertifications",
  Mission: "ui.footer.mission",
  Products: "ui.footer.products",
  "Aesthetic Brackets": "ui.footer.aestheticBrackets",
  "Metal Brackets": "ui.footer.metalBrackets",
  "NiTi & SS Wires": "ui.footer.nitiSsWires",
  "Molar Bands & Tubes": "ui.footer.molarBandsTubes",
  Capabilities: "ui.footer.capabilities",
  "Design & Engineering": "ui.footer.designEngineering",
  "OEM Services": "ui.footer.oemServices",
  "Custom Packaging": "ui.footer.customPackaging",
  "Quality Control": "ui.footer.qualityControl",
  "Dealers & Bulk Orders": "ui.footer.dealersBulkOrders",
  "Become a Dealer": "ui.footer.becomeDealer",
  "Bulk & RFQ Pricing": "ui.footer.bulkRfqPricing",
  "Product Catalogue": "ui.footer.productCatalogue",
  Resources: "ui.footer.resources",
  Blog: "ui.footer.blog",
  "Terms & Conditions": "ui.footer.termsConditions",
  "Export & Trade": "ui.footer.exportTrade",
  "Export Enquiries": "ui.footer.exportEnquiries",
  "Global Distributors": "ui.footer.globalDistributors",
  "Shipping & Logistics": "ui.footer.shippingLogistics",
  "Compliance Documents": "ui.footer.complianceDocuments",
  "India Office": "ui.footer.indiaOffice",
  "USA Office": "ui.footer.usaOffice",
  Legal: "ui.footer.legal",
  "Privacy Policy": "ui.footer.privacyPolicy",
  Sitemap: "ui.footer.sitemap",
};

export function Footer() {
  const { t } = useStaticTranslations();
  const label = (value: string) => footerLabelKeys[value] ? t(footerLabelKeys[value]) : value;

  return (
    <footer className="bg-brand text-white">
  <Container className="border-t border-white/20 pt-10 sm:pt-12 lg:pt-12">
    <div className="mb-8 flex items-center gap-2.5 sm:mb-10">
      <Logo variant="light" />
    </div>

    <div className="mb-9 grid grid-cols-1 gap-7 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-8 lg:mb-10 lg:grid-cols-5 lg:gap-5 xl:gap-6">
      {footerColumns.map((col) => (
        <div key={col.heading} className="min-w-0">
          <h6 className="mb-2.5 text-[13.5px] font-semibold text-white sm:text-[14px]">
            {label(col.heading)}
          </h6>

          {col.links.map((link) => {
            const isExternal = link.href.startsWith("http");

            return (
              <Link
                key={link.label}
                href={link.href}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white"
              >
                {label(link.label)}
              </Link>
            );
          })}
        </div>
      ))}

      <div className="min-w-0">
        <h6 className="mb-2.5 text-[13.5px] font-semibold text-white sm:text-[14px]">
          {label("Export & Trade")}
        </h6>

        <Link href="/contact" className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {label("Export Enquiries")}
        </Link>
        <Link href="/contact" className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {label("Global Distributors")}
        </Link>
        <Link href="/contact" className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {label("Shipping & Logistics")}
        </Link>
        <Link href="/quality-certifications" className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {label("Compliance Documents")}
        </Link>
      </div>

      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <h6 className="mb-2.5 text-[13.5px] font-semibold text-white sm:text-[14px]">
          {label("India Office")}
        </h6>

        <a href={`mailto:${ORDERS_EMAIL}`} className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {ORDERS_EMAIL}
        </a>
        <a href={`mailto:${INFO_EMAIL}`} className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {INFO_EMAIL}
        </a>
        <span className="block break-words py-1 text-[13px] leading-relaxed text-white/70">
          {INDIA_PHONE}
        </span>
        <span className="block break-words py-1 text-[13px] leading-relaxed text-white/70">
          {COMPANY_ADDRESS}
        </span>
      </div>

      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        <h6 className="mb-2.5 text-[13.5px] font-semibold text-white sm:text-[14px]">
          {label("USA Office")}
        </h6>

        <a href={`mailto:${USA_EMAIL}`} className="block break-words py-1 text-[13px] leading-relaxed text-white/80 hover:text-white">
          {USA_EMAIL}
        </a>
        <span className="block break-words py-1 text-[13px] leading-relaxed text-white/70">
          {USA_PHONE}
        </span>
        <span className="block break-words py-1 text-[13px] leading-relaxed text-white/70">
          {USA_ADDRESS}
        </span>
      </div>
    </div>

    <div className="flex flex-col gap-5 border-t border-white/20 py-6 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <div className="mb-3.5 flex gap-4">
          {socialIcons.map(({ href, label: socialLabel }) => (
            <a
              key={socialLabel}
              href={href}
              aria-label={socialLabel}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white"
            >
              <SocialIcon label={socialLabel} />
            </a>
          ))}
        </div>

        <div className="mb-2 text-[12.5px] leading-relaxed text-white/80">
          © {new Date().getFullYear()} {t("ui.footer.copyright")}
        </div>

        <div className="flex flex-wrap gap-x-2 gap-y-1 text-[12.5px] leading-relaxed text-white/80">
          <Link href="/contact">{label("Legal")}</Link>
          <span>|</span>
          <Link href="/contact">{label("Privacy Policy")}</Link>
          <span>|</span>
          <Link href="/contact">{label("Sitemap")}</Link>
        </div>
      </div>

      <div className="w-full sm:max-w-[340px] sm:text-right">
        <p className="mb-2.5 text-[12.5px] leading-relaxed text-white sm:text-[13px]">
          {t("ui.footer.newsletter")}
        </p>
        <NewsletterForm tone="light" />
      </div>
    </div>
  </Container>
</footer>
  );
}
