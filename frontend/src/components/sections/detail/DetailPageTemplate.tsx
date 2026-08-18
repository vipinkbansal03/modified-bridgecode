"use client";

import { PageHero } from "@/components/sections/detail/PageHero";
import { DetailSection } from "@/components/sections/detail/DetailSection";
import { FaqAccordion } from "@/components/sections/detail/FaqAccordion";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { DetailPageContent } from "@/types/common.types";
import type { StaticMessageKey } from "@/i18n/staticMessages";

interface DetailPageTemplateProps {
  content: DetailPageContent;
  breadcrumbLabel: string;
}

const detailTextKeys: Record<string, StaticMessageKey> = {
  Home: "ui.products.breadcrumbHome",
  "Quality Certifications": "ui.quality.kicker",
  "Certified to the standards global orthodontic brands require.": "ui.quality.heroTitle",
  "We aim to deliver a best-in-class experience — high-quality orthodontic appliances, on time, without defects and competitively priced — backed by a quality management system our team maintains and improves continuously.": "ui.quality.heroLede",
  "Quality Management": "ui.quality.subnavManagement",
  "Our Certifications": "ui.quality.subnavCertifications",
  "Product Label Symbols": "ui.quality.subnavSymbols",
  FAQs: "ui.quality.subnavFaqs",
  "Quality management system": "ui.quality.managementHeading",
  "Our dedicated team of professionals is trained to maintain and continually improve the effectiveness of our quality management system, while ensuring compliance with applicable standards, regulatory requirements and customer requirements. That gives our customer base the confidence that they'll receive consistently high-quality products, with individual needs and expectations met.": "ui.quality.managementParagraphOne",
  "MO's quality management system is certified by Underwriters Laboratories (UL) to ISO 13485:2016. ISO standards make the development, manufacturing and supply of products more efficient, safer and cleaner, ease trade between countries, and help safeguard consumers and users of medical devices everywhere.": "ui.quality.managementParagraphTwo",
  "Our certifications": "ui.quality.certificationsHeading",
  "ISO 13485:2016": "ui.quality.isoTitle",
  "The international standard recognised for medical device quality management systems, compatible with FDA QSR and a base for EU CE marking.": "ui.quality.isoDescription",
  "View certificate": "ui.quality.viewCertificate",
  "CE Mark": "ui.quality.ceTitle",
  "The official marking required across EU member countries, confirming our products meet essential European safety and environmental requirements.": "ui.quality.ceDescription",
  "US FDA Registered": "ui.quality.fdaTitle",
  "Compliant with FDA quality system regulation 21 CFR Parts 808, 812 and 820 (cGMP). Modern Orthodontics is registered with the FDA as a manufacturer.": "ui.quality.fdaDescription",
  "View FDA registration": "ui.quality.viewFdaRegistration",
  "Material Safety Data Sheets": "ui.quality.msdsTitle",
  "Full chemical identity and hazard information for every relevant material, in line with OSHA's Hazard Communication Standard.": "ui.quality.msdsDescription",
  "View MSDS": "ui.quality.viewMsds",
  "Product label symbols": "ui.quality.symbolsHeading",
  "A quick reference for the most common symbols you'll find on Modern Orthodontics product labels and packaging.": "ui.quality.symbolsIntro",
  "Catalog Number": "ui.quality.symbolCatalogNumber",
  "Precedes the part number of the product.": "ui.quality.symbolCatalogNumberDescription",
  "LOT / Batch Code": "ui.quality.symbolLotBatchCode",
  "Precedes the lot number — used by MO for part traceability.": "ui.quality.symbolLotBatchCodeDescription",
  Manufacturer: "ui.quality.symbolManufacturer",
  "Identifies the manufacturer, may include the date of manufacture (YYYY-MM).": "ui.quality.symbolManufacturerDescription",
  "Do Not Reuse": "ui.quality.symbolDoNotReuse",
  "Devices marked with this symbol are intended for single use only.": "ui.quality.symbolDoNotReuseDescription",
  "Use By": "ui.quality.symbolUseBy",
  "The part should be used before the date next to this symbol (YYYY-MM).": "ui.quality.symbolUseByDescription",
  "Consult Instructions for Use": "ui.quality.symbolConsultInstructions",
  "For products that include additional instructions inside the package.": "ui.quality.symbolConsultInstructionsDescription",
  "Keep Away From Sunlight": "ui.quality.symbolKeepAwaySunlight",
  "Used on elastics — performance may reduce with sunlight exposure.": "ui.quality.symbolKeepAwaySunlightDescription",
  "Nickel / Chromium Warning": "ui.quality.symbolNickelChromiumWarning",
  "Flags the potential for allergic reactions to these known allergens.": "ui.quality.symbolNickelChromiumWarningDescription",
  "Rx Only": "ui.quality.symbolRxOnly",
  "For use or distribution by orthodontic professionals only.": "ui.quality.symbolRxOnlyDescription",
  "Is Modern Orthodontics ISO certified?": "ui.quality.faqIsoQuestion",
  "Yes — our quality management system is certified to ISO 13485:2016 by Underwriters Laboratories (UL).": "ui.quality.faqIsoAnswer",
  "Are your products CE marked for the European market?": "ui.quality.faqCeQuestion",
  "Yes, our quality management has been certified to CE by UL, confirming compliance with European Medical Device Directives.": "ui.quality.faqCeAnswer",
  "Is Modern Orthodontics FDA registered?": "ui.quality.faqFdaQuestion",
  "Yes, we're registered with the FDA as a manufacturer and compliant with 21 CFR Parts 808, 812 and 820 (cGMP).": "ui.quality.faqFdaAnswer",
  "Where can I get your Material Safety Data Sheets?": "ui.quality.faqMsdsQuestion",
  "You can view them directly via the MSDS link above, or email orders@modortho.com for a specific sheet.": "ui.quality.faqMsdsAnswer",
  "How do I read the symbols on a product label?": "ui.quality.faqSymbolsQuestion",
  "See the Product Label Symbols reference above for the most common marks — catalogue number, lot code, use-by date and more.": "ui.quality.faqSymbolsAnswer",
};

/** Shared template for the About / Manufacturing Services / Quality Certifications pages. */
export function DetailPageTemplate({ content, breadcrumbLabel }: DetailPageTemplateProps) {
  const { t } = useStaticTranslations();
  const translate = (value: string) => {
    const key = detailTextKeys[value];
    return key ? t(key) : value;
  };
  const translatedContent: DetailPageContent = {
    ...content,
    kicker: translate(content.kicker),
    title: translate(content.title),
    lede: translate(content.lede),
    subnav: content.subnav.map((item) => ({ ...item, label: translate(item.label) })),
    sections: content.sections.map((section) => ({
      ...section,
      heading: translate(section.heading),
      paragraphs: section.paragraphs?.map(translate),
      capabilityGrid: section.capabilityGrid?.map((box) => ({
        ...box,
        title: translate(box.title),
        description: translate(box.description),
        linkLabel: box.linkLabel ? translate(box.linkLabel) : box.linkLabel,
      })),
      symbolGrid: section.symbolGrid?.map((symbol) => ({
        ...symbol,
        title: translate(symbol.title),
        description: translate(symbol.description),
      })),
      callout: section.callout ? { text: translate(section.callout.text) } : section.callout,
    })),
    faqs: content.faqs.map((faq) => ({
      question: translate(faq.question),
      answer: translate(faq.answer),
    })),
  };

  return (
    <>
      <PageHero
        kicker={translatedContent.kicker}
        title={translatedContent.title}
        lede={translatedContent.lede}
        heroImage={translatedContent.heroImage}
        breadcrumb={[{ label: translate("Home"), href: "/" }, { label: translate(breadcrumbLabel) }]}
      />
      {translatedContent.sections.map((section) => (
        <DetailSection key={section.id} section={section} />
      ))}
      <FaqAccordion items={translatedContent.faqs} />
    </>
  );
}
