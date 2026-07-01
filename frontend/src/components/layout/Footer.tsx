"use client";

import Link from "next/link";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { Container } from "@/components/ui/Container";
import { Logo } from "@/components/ui/Logo";
import { useCmsFooter, useCmsMenu } from "@/hooks/api/useCmsContent";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { StaticMessageKey } from "@/i18n/staticMessages";
import {
  buildFooterContactFallback,
  buildFooterCopyright,
  buildFooterNewsletterText,
  cmsMenuToFooterColumns,
  parseFooterSocialLinks,
} from "@/lib/cmsNavigation";
import { COMPANY_ADDRESS, INDIA_PHONE, INFO_EMAIL, ORDERS_EMAIL, SOCIAL_LINKS, USA_ADDRESS, USA_EMAIL, USA_PHONE } from "@/utils/constants";

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
      { label: "About Us", href: "/about", openInNewTab: false },
      { label: "Manufacturing", href: "/manufacturing-services", openInNewTab: false },
      { label: "Quality Certifications", href: "/quality-certifications", openInNewTab: false },
      { label: "Mission", href: "/about#mission", openInNewTab: false },
    ],
  },
  {
    heading: "Products",
    links: [
      { label: "Aesthetic Brackets", href: "/products?category=aesthetic-brackets", openInNewTab: false },
      { label: "Metal Brackets", href: "/products?category=metal-brackets", openInNewTab: false },
      { label: "NiTi & SS Wires", href: "/products?category=niti-wires", openInNewTab: false },
      { label: "Molar Bands & Tubes", href: "/products?category=molar-bands", openInNewTab: false },
    ],
  },
  {
    heading: "Capabilities",
    links: [
      { label: "Design & Engineering", href: "/design-and-engineering", openInNewTab: false },
      { label: "OEM Services", href: "/oem-services", openInNewTab: false },
      { label: "Custom Packaging", href: "/custom-packaging", openInNewTab: false },
      { label: "Quality Control", href: "/quality-certifications", openInNewTab: false },
    ],
  },
  {
    heading: "Dealers & Bulk Orders",
    links: [
      { label: "Become a Dealer", href: "/contact", openInNewTab: false },
      { label: "Bulk & RFQ Pricing", href: "/products", openInNewTab: false },
      { label: "Product Catalogue", href: "https://www.modortho.com/public/catalog/Modern-Catalog.zip", openInNewTab: true },
    ],
  },
  {
    heading: "Resources",
    links: [
      { label: "Blog", href: "/blog", openInNewTab: false },
      { label: "Terms & Conditions", href: "/terms-and-conditions", openInNewTab: false },
      { label: "Privacy Policy", href: "/privacy-policy", openInNewTab: false },
    ],
  },
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

type FooterLink = { label: string; href: string; openInNewTab?: boolean };

export function Footer() {
  const { t } = useStaticTranslations();
  const label = (value: string) => (footerLabelKeys[value] ? t(footerLabelKeys[value]) : value);
  const { data: cmsFooter } = useCmsFooter();
  const { data: footerAboutMenu } = useCmsMenu("footer-about");
  const { data: footerProductsMenu } = useCmsMenu("footer-products");
  const { data: footerCapabilitiesMenu } = useCmsMenu("footer-capabilities");
  const { data: footerDealersMenu } = useCmsMenu("footer-dealers");
  const { data: footerResourcesMenu } = useCmsMenu("footer-resources");
  const { data: footerExportMenu } = useCmsMenu("footer-export");
  const { data: footerIndiaOfficeMenu } = useCmsMenu("footer-india-office");
  const { data: footerUsaOfficeMenu } = useCmsMenu("footer-usa-office");
  const { data: footerLegalMenu } = useCmsMenu("footer-legal");

  const cmsFooterColumns = [
    cmsMenuToFooterColumns(footerAboutMenu),
    cmsMenuToFooterColumns(footerProductsMenu),
    cmsMenuToFooterColumns(footerCapabilitiesMenu),
    cmsMenuToFooterColumns(footerDealersMenu),
    cmsMenuToFooterColumns(footerResourcesMenu),
  ].filter((column) => column.heading && column.links.length > 0);

  const cmsExportColumn = cmsMenuToFooterColumns(footerExportMenu);
  const cmsIndiaOfficeColumn = cmsMenuToFooterColumns(footerIndiaOfficeMenu);
  const cmsUsaOfficeColumn = cmsMenuToFooterColumns(footerUsaOfficeMenu);
  const cmsLegalColumn = cmsMenuToFooterColumns(footerLegalMenu);

  const footerColumnsToRender = cmsFooterColumns.length > 0 ? cmsFooterColumns : footerColumns;
  const footerSocialLinks = parseFooterSocialLinks(cmsFooter?.socialLinksJson);
  const footerContactFallback = buildFooterContactFallback(cmsFooter);
  const footerCopyright = buildFooterCopyright(cmsFooter, t("ui.footer.copyright"));
  const footerNewsletterText = buildFooterNewsletterText(cmsFooter, t("ui.footer.newsletter"));
  const shouldShowNewsletter = cmsFooter?.newsletterEnabled ?? true;

  const socialLinks = [
    { href: footerSocialLinks.facebook || SOCIAL_LINKS.facebook, label: "Facebook" as const },
    { href: footerSocialLinks.linkedin || SOCIAL_LINKS.linkedin, label: "LinkedIn" as const },
    { href: footerSocialLinks.twitter || SOCIAL_LINKS.twitter, label: "X" as const },
    { href: footerSocialLinks.instagram || SOCIAL_LINKS.instagram, label: "Instagram" as const },
  ].filter((item) => item.href);

  const exportLinks: FooterLink[] = cmsExportColumn.links.length > 0
    ? cmsExportColumn.links
    : [
        { label: "Export Enquiries", href: "/contact" },
        { label: "Global Distributors", href: "/contact" },
        { label: "Shipping & Logistics", href: "/contact" },
        { label: "Compliance Documents", href: "/quality-certifications" },
      ];

  const indiaOfficeLinks: FooterLink[] = cmsIndiaOfficeColumn.links.length > 0
    ? cmsIndiaOfficeColumn.links
    : [
        { label: ORDERS_EMAIL, href: `mailto:${ORDERS_EMAIL}` },
        { label: INFO_EMAIL, href: `mailto:${INFO_EMAIL}` },
        { label: INDIA_PHONE, href: "" },
        { label: COMPANY_ADDRESS, href: "" },
      ];

  const usaOfficeLinks: FooterLink[] = cmsUsaOfficeColumn.links.length > 0
    ? cmsUsaOfficeColumn.links
    : [
        { label: USA_EMAIL, href: `mailto:${USA_EMAIL}` },
        { label: USA_PHONE, href: "" },
        { label: USA_ADDRESS, href: "" },
      ];

  const legalLinks: FooterLink[] = cmsLegalColumn.links.length > 0
    ? cmsLegalColumn.links
    : [
        { label: "Terms & Conditions", href: "/terms-and-conditions" },
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Sitemap", href: "/sitemap.xml" },
      ];

  function renderFooterItem(item: FooterLink, key: string) {
    const href = item.href.trim();
    const isExternal = href.startsWith("http") || href.startsWith("mailto:");

    if (!href) {
      return (
        <span key={key} className="block break-words py-1.5 text-[13.5px] text-white/70">
          {label(item.label)}
        </span>
      );
    }

    return (
      <Link
        key={key}
        href={href}
        target={item.openInNewTab || isExternal ? "_blank" : undefined}
        rel={item.openInNewTab || isExternal ? "noopener noreferrer" : undefined}
        className="block break-words py-1.5 text-[13.5px] text-white/80 hover:text-white"
      >
        {label(item.label)}
      </Link>
    );
  }

  return (
    <footer className="bg-brand text-white">
      <Container className="border-t border-white/20 pt-16">
        <div className="mb-14 flex items-center gap-2.5">
          {cmsFooter?.logo?.trim() ? (
            <img
              src={cmsFooter.logo.trim()}
              alt="Modern Orthodontics"
              className="h-11 w-auto max-w-[280px] object-contain"
            />
          ) : (
            <Logo variant="light" />
          )}
        </div>

        <div className="mb-14 grid grid-cols-2 gap-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {footerColumnsToRender.map((col) => (
            <div key={col.heading} className="min-w-0">
              <h6 className="mb-4.5 text-[14.5px] font-semibold text-white">{label(col.heading)}</h6>
              {col.links.map((link) => renderFooterItem(link, `${col.heading}-${link.label}`))}
            </div>
          ))}

          <div className="min-w-0">
            <h6 className="mb-4.5 text-[14.5px] font-semibold text-white">{label(cmsExportColumn.heading || "Export & Trade")}</h6>
            {exportLinks.map((item, index) => renderFooterItem(item, `footer-export-${index}`))}
          </div>

          <div className="min-w-0">
            <h6 className="mb-4.5 text-[14.5px] font-semibold text-white">{label(cmsIndiaOfficeColumn.heading || "India Office")}</h6>
            {indiaOfficeLinks.map((item, index) => renderFooterItem(item, `footer-india-${index}`))}
            {!cmsIndiaOfficeColumn.links.length && footerContactFallback.email && footerContactFallback.email !== ORDERS_EMAIL && (
              renderFooterItem({ label: footerContactFallback.email, href: `mailto:${footerContactFallback.email}` }, "footer-india-fallback-email")
            )}
            {!cmsIndiaOfficeColumn.links.length && footerContactFallback.phone && footerContactFallback.phone !== INDIA_PHONE && (
              renderFooterItem({ label: footerContactFallback.phone, href: "" }, "footer-india-fallback-phone")
            )}
            {!cmsIndiaOfficeColumn.links.length && footerContactFallback.address && footerContactFallback.address !== COMPANY_ADDRESS && (
              renderFooterItem({ label: footerContactFallback.address, href: "" }, "footer-india-fallback-address")
            )}
          </div>

          <div className="min-w-0">
            <h6 className="mb-4.5 text-[14.5px] font-semibold text-white">{label(cmsUsaOfficeColumn.heading || "USA Office")}</h6>
            {usaOfficeLinks.map((item, index) => renderFooterItem(item, `footer-usa-${index}`))}
          </div>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-9 border-t border-white/20 py-8">
          <div>
            <div className="mb-5 flex gap-5">
              {socialLinks.map(({ href, label: socialLabel }) => (
                <a key={socialLabel} href={href} aria-label={socialLabel} target="_blank" rel="noopener noreferrer" className="text-white">
                  <SocialIcon label={socialLabel} />
                </a>
              ))}
            </div>
            <div className="mb-2.5 text-[13px] text-white/80">© {new Date().getFullYear()} {footerCopyright}</div>
            <div className="flex flex-wrap gap-2 text-[13px] text-white/80">
              {legalLinks.map((item, index) => (
                <div key={`footer-legal-${index}`} className="contents">
                  {index > 0 && <span>|</span>}
                  <Link
                    href={item.href || "#"}
                    target={item.openInNewTab ? "_blank" : undefined}
                    rel={item.openInNewTab ? "noopener noreferrer" : undefined}
                  >
                    {label(item.label)}
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {shouldShowNewsletter && (
            <div className="sm:text-right">
              <p className="mb-3.5 text-[13px] text-white sm:text-sm">{footerNewsletterText}</p>
              <NewsletterForm tone="light" />
            </div>
          )}
        </div>
      </Container>
    </footer>
  );
}
