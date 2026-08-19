export type DetailPageSectionType =
  | "rich_text"
  | "cards"
  | "symbols"
  | "faqs"
  | "rich_text_callout";

export interface RichTextConfig {
  headingLabel?: string;
  paragraph1Label?: string;
  paragraph2Label?: string;
  allowCtaButton?: boolean;
  ctaLabelDefault?: string;
  ctaHrefDefault?: string;
  allowImage?: boolean;
}

export interface CardRepeaterConfig {
  itemLabel?: string;
  defaultIcon?: string;
  allowIcon?: boolean;
  allowLinks?: boolean;
  allowFileUpload?: boolean;
  linkLabelDefault?: string;
  allowParagraphs?: boolean;
  allowSubtitle?: boolean;
  subtitleLabel?: string;
}

export interface DetailPageSectionDef {
  key: string;
  sectionKey: string;
  title: string;
  subtitle: string;
  description: string;
  type: DetailPageSectionType;
  cardConfig?: CardRepeaterConfig;
  richTextConfig?: RichTextConfig;
  calloutDefault?: string;
}

export interface DetailPageConfig {
  pageKey: string;
  slug: string;
  title: string;
  breadcrumbLabel: string;
  defaultHero: {
    kicker: string;
    title: string;
    description: string;
    image: string;
  };
  sections: DetailPageSectionDef[];
}

export const DETAIL_PAGE_CONFIGS: Record<string, DetailPageConfig> = {
  "quality-certifications": {
    pageKey: "quality-certifications",
    slug: "quality-certifications",
    title: "Quality & Certifications",
    breadcrumbLabel: "Quality Certifications",
    defaultHero: {
      kicker: "Quality Certifications",
      title: "Certified to the standards global orthodontic brands require.",
      description:
        "We aim to deliver a best-in-class experience — high-quality orthodontic appliances, on time, without defects and competitively priced — backed by a quality management system our team maintains and improves continuously.",
      image: "https://images.unsplash.com/photo-1758873263563-5ba4aa330799?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "management",
        sectionKey: "quality.management",
        title: "Quality Management System",
        subtitle: "#management",
        description: "Narrative detailing quality assurance protocols and ISO compliance.",
        type: "rich_text",
      },
      {
        key: "certifications",
        sectionKey: "quality.certifications",
        title: "Certifications & Accreditations",
        subtitle: "#certifications",
        description: "Regulatory certificates, ISO standards, CE markings, FDA clearances.",
        type: "cards",
        cardConfig: {
          itemLabel: "Certification",
          defaultIcon: "BadgeCheck",
          allowLinks: true,
          allowFileUpload: true,
          linkLabelDefault: "View certificate",
        },
      },
      {
        key: "symbols",
        sectionKey: "quality.symbols",
        title: "Product Label Symbols",
        subtitle: "#symbols",
        description: "Reference chart for symbols used on Modern Orthodontics product packaging.",
        type: "symbols",
      },
      {
        key: "faqs",
        sectionKey: "quality.faqs",
        title: "Frequently Asked Questions",
        subtitle: "#faqs",
        description: "Customer and distributor Q&A for quality compliance.",
        type: "faqs",
      },
    ],
  },

  manufacturing: {
    pageKey: "manufacturing",
    slug: "manufacturing-services",
    title: "Manufacturing Services",
    breadcrumbLabel: "Manufacturing Services",
    defaultHero: {
      kicker: "Capabilities",
      title: "Manufacturing services built for OEM partners.",
      description:
        "Having served the OEM market for many years, we manufacture orthodontic parts of every kind — MIM components, sheet metal parts and the full range of wires — for some of the industry's most prestigious brands.",
      image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "expertise",
        sectionKey: "manufacturing.expertise",
        title: "Manufacturing Expertise",
        subtitle: "#expertise",
        description: "Overview of engineering, mould making, sheet metal, and wire production.",
        type: "rich_text",
      },
      {
        key: "mim",
        sectionKey: "manufacturing.mim",
        title: "What is Metal Injection Molding?",
        subtitle: "#mim",
        description: "Detailed explanation of MIM powder metallurgy, binders, and sintering.",
        type: "rich_text",
      },
      {
        key: "benefits",
        sectionKey: "manufacturing.benefits",
        title: "Benefits of the MIM Process",
        subtitle: "#benefits",
        description: "Key advantages including design flexibility, intricate details, and strength.",
        type: "cards",
        cardConfig: {
          itemLabel: "Benefit",
          defaultIcon: "Shapes",
          allowLinks: false,
          allowFileUpload: false,
          allowParagraphs: true,
        },
      },
      {
        key: "process",
        sectionKey: "manufacturing.process",
        title: "The MIM Process",
        subtitle: "#process",
        description: "The 4-stage process: Mixing, Molding, Debinding, and Sintering.",
        type: "cards",
        cardConfig: {
          itemLabel: "Process Step",
          defaultIcon: "FlaskConical",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "niti",
        sectionKey: "manufacturing.niti",
        title: "Nickel Titanium Wire Drawing",
        subtitle: "#niti",
        description: "In-house Nitinol & stainless wire drawing facility with quality callout.",
        type: "rich_text_callout",
        calloutDefault:
          "100% final inspection. Every NiTi archwire undergoes intense scientific testing during manufacturing and a full final inspection before packaging.",
      },
      {
        key: "faqs",
        sectionKey: "manufacturing.faqs",
        title: "Manufacturing FAQs",
        subtitle: "#faqs",
        description: "Common questions regarding MIM capabilities, lead times, and MOQs.",
        type: "faqs",
      },
    ],
  },

  "design-and-engineering": {
    pageKey: "design-and-engineering",
    slug: "design-and-engineering",
    title: "Design & Engineering",
    breadcrumbLabel: "Design & Engineering",
    defaultHero: {
      kicker: "Capabilities",
      title: "A complete in-house design and engineering team.",
      description:
        "Direct supervision over product quality and functionality starts at the design stage. Our team brings over 20 years of collective orthodontic design experience across multiple 3D modelling platforms, working under the guidance of our founder, an orthodontist with more than two decades of clinical practice.",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "tooling",
        sectionKey: "design.tooling",
        title: "In-House Tooling",
        subtitle: "#tooling",
        description: "Tool room capabilities for designing molds and sheet metal tooling.",
        type: "rich_text",
      },
      {
        key: "cad",
        sectionKey: "design.cad",
        title: "CAD & Mold Design",
        subtitle: "#cad",
        description: "Draft analysis, undercut detection, and moldability forecasting.",
        type: "cards",
        cardConfig: {
          itemLabel: "CAD Capability",
          defaultIcon: "Ruler",
          allowLinks: false,
          allowFileUpload: false,
          allowParagraphs: true,
        },
      },
      {
        key: "why",
        sectionKey: "design.why",
        title: "Why This Shortens Lead Time",
        subtitle: "#why",
        description: "How upfront digital revision avoids costly tooling delays.",
        type: "rich_text",
      },
      {
        key: "faqs",
        sectionKey: "design.faqs",
        title: "Design & Engineering FAQs",
        subtitle: "#faqs",
        description: "Questions on in-house tool design, founder oversight, and CAD risk reduction.",
        type: "faqs",
      },
    ],
  },

  "oem-services": {
    pageKey: "oem-services",
    slug: "oem-services",
    title: "OEM Services",
    breadcrumbLabel: "OEM Services",
    defaultHero: {
      kicker: "Capabilities",
      title: "A preferred OEM partner for orthodontic brands worldwide.",
      description:
        "We've built our OEM business on the same things our own product line is judged on: product quality, end-to-end production control, and the ability to customise to a partner's exact specification — backed by an in-house tooling facility that keeps every step under one roof.",
      image: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "offer",
        sectionKey: "oem.offer",
        title: "What Our OEM Service Covers",
        subtitle: "#offer",
        description: "High-volume assembly, inspection, packaging, labelling, and shipping.",
        type: "rich_text",
      },
      {
        key: "why",
        sectionKey: "oem.why",
        title: "Why Partner With Us",
        subtitle: "#why",
        description: "Production flexibility, direct access to leadership, and schedule visibility.",
        type: "cards",
        cardConfig: {
          itemLabel: "Partner Benefit",
          defaultIcon: "SlidersHorizontal",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "benefits",
        sectionKey: "oem.benefits",
        title: "The Cost Case for Partnering",
        subtitle: "#benefits",
        description: "Lower overhead, warehousing costs, and streamlined logistics.",
        type: "cards",
        cardConfig: {
          itemLabel: "Cost Benefit",
          defaultIcon: "Building2",
          allowLinks: false,
          allowFileUpload: false,
          allowParagraphs: true,
        },
      },
      {
        key: "faqs",
        sectionKey: "oem.faqs",
        title: "OEM Services FAQs",
        subtitle: "#faqs",
        description: "Questions on OEM experience, packaging customization, and single points of contact.",
        type: "faqs",
      },
    ],
  },

  "custom-packaging": {
    pageKey: "custom-packaging",
    slug: "custom-packaging",
    title: "Custom Packaging",
    breadcrumbLabel: "Custom Packaging",
    defaultHero: {
      kicker: "Capabilities",
      title: "A full-service assembly and packaging facility.",
      description:
        "From raw material coordination through final packaging and shipping, we run complete and partial product assembly under one roof — built for high-volume, labour-intensive work with assured on-time delivery.",
      image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "handle",
        sectionKey: "packaging.handle",
        title: "What We Handle",
        subtitle: "#handle",
        description: "Raw material coordination, assembly line production, final packaging, and shipping.",
        type: "rich_text",
      },
      {
        key: "finishing",
        sectionKey: "packaging.finishing",
        title: "Assembly & Finishing Services",
        subtitle: "#finishing",
        description: "Tack welding, brazing, colour coding, surface finishing, and laser etching.",
        type: "cards",
        cardConfig: {
          itemLabel: "Finishing Service",
          defaultIcon: "Flame",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "benefits",
        sectionKey: "packaging.benefits",
        title: "What Partnering Saves You",
        subtitle: "#benefits",
        description: "Lower staffing overhead, lower warehousing, and centralised control.",
        type: "cards",
        cardConfig: {
          itemLabel: "Cost Benefit",
          defaultIcon: "Building2",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "faqs",
        sectionKey: "packaging.faqs",
        title: "Custom Packaging FAQs",
        subtitle: "#faqs",
        description: "Questions on full/partial assembly, custom branding, and quality inspection.",
        type: "faqs",
      },
    ],
  },

  about: {
    pageKey: "about",
    slug: "about",
    title: "About Us",
    breadcrumbLabel: "About Us",
    defaultHero: {
      kicker: "About Modern Orthodontics",
      title: "Engineering precision orthodontic hardware, since 1994.",
      description:
        "Our mission is to provide high-quality orthodontic products throughout the world — on time, competitively priced, and backed by support our customers can rely on.",
      image: "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
    sections: [
      {
        key: "mission",
        sectionKey: "about.mission",
        title: "Our Mission",
        subtitle: "#mission",
        description: "Company mission narrative, background, and manufacturing scope.",
        type: "rich_text",
      },
      {
        key: "manufacture",
        sectionKey: "about.manufacture",
        title: "What We Manufacture",
        subtitle: "#manufacture",
        description: "In-house manufacturing capabilities (brackets, molar bands, tubes, wires, springs).",
        type: "cards",
        cardConfig: {
          itemLabel: "Product Category",
          defaultIcon: "Pyramid",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "different",
        sectionKey: "about.different",
        title: "What Makes Us Different",
        subtitle: "#different",
        description: "Differentiators highlighting design software, machinery, and precision engineering.",
        type: "cards",
        cardConfig: {
          itemLabel: "Differentiator",
          defaultIcon: "PenTool",
          allowLinks: false,
          allowFileUpload: false,
        },
      },
      {
        key: "faqs",
        sectionKey: "about.faqs",
        title: "Frequently Asked Questions",
        subtitle: "#faqs",
        description: "Key questions and answers regarding company history, OEM, and global export.",
        type: "faqs",
      },
    ],
  },

  home: {
    pageKey: "home",
    slug: "",
    title: "Homepage",
    breadcrumbLabel: "Home",
    defaultHero: {
      kicker: "Modern Orthodontics",
      title: "Committed to precision.",
      description: "In-house manufacturing across orthodontic brackets, tubes, bands and wires.",
      image: "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=80&w=1920&auto=format&fit=crop",
    },
    sections: [
      {
        key: "about",
        sectionKey: "home.about",
        title: "About Section Intro",
        subtitle: "Introduction section below hero banner",
        description: "Introductory headline, mission statement paragraph, and 'Know More' CTA button.",
        type: "rich_text",
        richTextConfig: {
          headingLabel: "About Section Heading",
          paragraph1Label: "Mission & Background Narrative",
          allowCtaButton: true,
          ctaLabelDefault: "Know more",
          ctaHrefDefault: "/about",
        },
      },
      {
        key: "stats",
        sectionKey: "home.stats",
        title: "Key Performance Stats",
        subtitle: "4 key numbers (e.g. 30+ Years, 42 Countries)",
        description: "Numerical metrics highlighting company scale and track record.",
        type: "cards",
        cardConfig: {
          itemLabel: "Stat Card",
          allowIcon: false,
          allowLinks: false,
          allowFileUpload: false,
          allowSubtitle: true,
          subtitleLabel: "Metric Label (e.g. 'Since 1994' or 'Global Reach')",
        },
      },
      {
        key: "certifications",
        sectionKey: "home.certifications",
        title: "Featured Certifications",
        subtitle: "ISO, CE, FDA, MDSAP certification cards",
        description: "Quality badges and regulatory clearances displayed on the homepage.",
        type: "cards",
        cardConfig: {
          itemLabel: "Certification Badge",
          defaultIcon: "ShieldCheck",
          allowLinks: true,
          allowFileUpload: false,
          linkLabelDefault: "View certificate",
        },
      },
      {
        key: "contactCta",
        sectionKey: "home.contactCta",
        title: "Bottom Contact CTA Banner",
        subtitle: "Full-width call to action before footer",
        description: "Closing banner headline, description text, and contact button.",
        type: "rich_text",
        richTextConfig: {
          headingLabel: "CTA Banner Heading",
          paragraph1Label: "CTA Body Description",
          allowCtaButton: true,
          ctaLabelDefault: "Contact us",
          ctaHrefDefault: "/contact",
          allowImage: true,
        },
      },
    ],
  },

  contact: {
    pageKey: "contact",
    slug: "contact",
    title: "Contact",
    breadcrumbLabel: "Contact",
    defaultHero: {
      kicker: "Contact",
      title: "Get in touch with our team",
      description:
        "For product enquiries, bulk orders or dealer applications — send us a message and our team will respond directly.",
      image: "",
    },
    sections: [
      {
        key: "offices",
        sectionKey: "contact.offices",
        title: "Department & Regional Branch Locations",
        subtitle: "Secondary offices & support desks (Primary Corporate Office is auto-synced from Settings → General)",
        description: "Configure additional department cards like Export Support, USA Office, or Regional Distributorship contacts.",
        type: "cards",
        cardConfig: {
          itemLabel: "Department / Office",
          allowIcon: false,
          allowSubtitle: true,
          subtitleLabel: "Direct Phone Number (Optional)",
          allowLinks: true,
          linkLabelDefault: "Direct Email Address (Optional)",
          allowFileUpload: false,
        },
      },
    ],
  },

  products: {
    pageKey: "products",
    slug: "products",
    title: "Products",
    breadcrumbLabel: "Products",
    defaultHero: {
      kicker: "Products",
      title: "ALL PRODUCTS",
      description:
        "Precision orthodontic hardware manufactured in-house since 1994 — brackets, wires, bands and tubes, available as single packs or full dealer cases.",
      image: "",
    },
    sections: [],
  },
};

export function getDetailPageConfig(pageKey: string): DetailPageConfig | null {
  return DETAIL_PAGE_CONFIGS[pageKey] || null;
}
