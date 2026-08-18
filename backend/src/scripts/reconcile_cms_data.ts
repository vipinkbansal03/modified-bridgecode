import { prisma } from "../config/database";
import { Prisma } from "@prisma/client";

async function upsertPageHelper(pageData: {
  title: string;
  slug: string;
  pageKey: string;
  seoTitle?: string;
  seoDescription?: string;
  robotsTag?: string;
}) {
  return prisma.cMSPage.upsert({
    where: { pageKey: pageData.pageKey },
    update: {
      title: pageData.title,
      slug: pageData.slug,
      seoTitle: pageData.seoTitle,
      seoDescription: pageData.seoDescription,
      robotsTag: pageData.robotsTag || "index,follow",
      status: "ACTIVE",
    },
    create: {
      title: pageData.title,
      slug: pageData.slug,
      pageKey: pageData.pageKey,
      seoTitle: pageData.seoTitle,
      seoDescription: pageData.seoDescription,
      robotsTag: pageData.robotsTag || "index,follow",
      status: "ACTIVE",
    },
  });
}

async function upsertSectionHelper(pageId: string, sectionKey: string, title: string, sortOrder: number, settingsJson?: Prisma.InputJsonValue) {
  const existing = await prisma.cMSSection.findFirst({
    where: { pageId, sectionKey },
  });
  if (existing) {
    return prisma.cMSSection.update({
      where: { id: existing.id },
      data: { title, sortOrder, status: "ACTIVE", settingsJson: settingsJson ?? existing.settingsJson ?? Prisma.JsonNull },
    });
  }
  return prisma.cMSSection.create({
    data: {
      pageId,
      sectionKey,
      title,
      sortOrder,
      status: "ACTIVE",
      settingsJson: settingsJson ?? Prisma.JsonNull,
    },
  });
}

async function syncBlocksHelper(
  sectionId: string,
  blocks: Array<{
    blockType: string;
    title?: string | null;
    subtitle?: string | null;
    description?: string | null;
    image?: string | null;
    icon?: string | null;
    linkLabel?: string | null;
    linkUrl?: string | null;
    sortOrder: number;
    dataJson?: Prisma.InputJsonValue;
  }>
) {
  await prisma.cMSBlock.deleteMany({ where: { sectionId } });
  for (const b of blocks) {
    await prisma.cMSBlock.create({
      data: {
        sectionId,
        blockType: b.blockType,
        title: b.title ?? null,
        subtitle: b.subtitle ?? null,
        description: b.description ?? null,
        image: b.image ?? null,
        icon: b.icon ?? null,
        linkLabel: b.linkLabel ?? null,
        linkUrl: b.linkUrl ?? null,
        sortOrder: b.sortOrder,
        status: "ACTIVE",
        dataJson: b.dataJson ?? Prisma.JsonNull,
      },
    });
  }
}

async function reconcileQualityCertifications() {
  console.log("🔄 Reconciling Quality & Certifications CMS data...");
  const page = await upsertPageHelper({
    title: "Quality & Certifications",
    slug: "quality-certifications",
    pageKey: "quality-certifications",
    seoTitle: "Quality Certifications — Modern Orthodontics",
    seoDescription: "ISO 13485:2016, CE marking, FDA registration and Material Safety Data Sheets for Modern Orthodontics products.",
  });

  const heroSec = await upsertSectionHelper(page.id, "quality.hero", "Quality Hero", 0);
  await syncBlocksHelper(heroSec.id, [
    {
      blockType: "hero",
      title: "Certified to the standards global orthodontic brands require.",
      subtitle: "Quality Certifications",
      description: "We aim to deliver a best-in-class experience — high-quality orthodontic appliances, on time, without defects and competitively priced — backed by a quality management system our team maintains and improves continuously.",
      image: "https://images.unsplash.com/photo-1758873263563-5ba4aa330799?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      sortOrder: 0,
    },
  ]);

  const mgmtSec = await upsertSectionHelper(page.id, "quality.management", "Quality Management", 1);
  await syncBlocksHelper(mgmtSec.id, [
    {
      blockType: "rich_text",
      title: "Quality management system",
      description: "Our dedicated team of professionals is trained to maintain and continually improve the effectiveness of our quality management system, while ensuring compliance with applicable standards, regulatory requirements and customer requirements. That gives our customer base the confidence that they'll receive consistently high-quality products, with individual needs and expectations met.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "MO's quality management system is certified by Underwriters Laboratories (UL) to ISO 13485:2016. ISO standards make the development, manufacturing and supply of products more efficient, safer and cleaner, ease trade between countries, and help safeguard consumers and users of medical devices everywhere.",
      sortOrder: 1,
    },
  ]);

  const certsSec = await upsertSectionHelper(page.id, "quality.certifications", "Certifications", 2);
  await syncBlocksHelper(certsSec.id, [
    { blockType: "certification", icon: "BadgeCheck", title: "ISO 13485:2016", description: "The international standard recognised for medical device quality management systems, compatible with FDA QSR and a base for EU CE marking.", linkLabel: "View certificate", linkUrl: "https://www.modortho.com/public/img/iso-13485-latest.pdf", sortOrder: 0 },
    { blockType: "certification", icon: "ShieldCheck", title: "CE Mark", description: "The official marking required across EU member countries, confirming our products meet essential European safety and environmental requirements.", linkLabel: "View certificate", linkUrl: "https://www.modortho.com/public/img/ce-certificate-latest.pdf", sortOrder: 1 },
    { blockType: "certification", icon: "Stamp", title: "US FDA Registered", description: "Compliant with FDA quality system regulation 21 CFR Parts 808, 812 and 820 (cGMP). Modern Orthodontics is registered with the FDA as a manufacturer.", linkLabel: "View FDA registration", linkUrl: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRL/rl.cfm?rid=73615", sortOrder: 2 },
    { blockType: "certification", icon: "FlaskConical", title: "Material Safety Data Sheets", description: "Full chemical identity and hazard information for every relevant material, in line with OSHA's Hazard Communication Standard.", linkLabel: "View MSDS", linkUrl: "https://www.modortho.com/material-safety-sheets", sortOrder: 3 },
  ]);

  const symSec = await upsertSectionHelper(page.id, "quality.symbols", "Product Label Symbols", 3);
  await syncBlocksHelper(symSec.id, [
    { blockType: "intro", title: "Product label symbols", description: "A quick reference for the most common symbols you'll find on Modern Orthodontics product labels and packaging.", sortOrder: 0 },
    { blockType: "symbol", icon: "Hash", title: "Catalog Number", description: "Precedes the part number of the product.", sortOrder: 1 },
    { blockType: "symbol", icon: "Layers", title: "LOT / Batch Code", description: "Precedes the lot number — used by MO for part traceability.", sortOrder: 2 },
    { blockType: "symbol", icon: "Factory", title: "Manufacturer", description: "Identifies the manufacturer, may include the date of manufacture (YYYY-MM).", sortOrder: 3 },
    { blockType: "symbol", icon: "Ban", title: "Do Not Reuse", description: "Devices marked with this symbol are intended for single use only.", sortOrder: 4 },
    { blockType: "symbol", icon: "Hourglass", title: "Use By", description: "The part should be used before the date next to this symbol (YYYY-MM).", sortOrder: 5 },
    { blockType: "symbol", icon: "BookOpen", title: "Consult Instructions for Use", description: "For products that include additional instructions inside the package.", sortOrder: 6 },
    { blockType: "symbol", icon: "Sun", title: "Keep Away From Sunlight", description: "Used on elastics — performance may reduce with sunlight exposure.", sortOrder: 7 },
    { blockType: "symbol", icon: "TriangleAlert", title: "Nickel / Chromium Warning", description: "Flags the potential for allergic reactions to these known allergens.", sortOrder: 8 },
    { blockType: "symbol", icon: "Stethoscope", title: "Rx Only", description: "For use or distribution by orthodontic professionals only.", sortOrder: 9 },
  ]);

  const faqSec = await upsertSectionHelper(page.id, "quality.faqs", "FAQs", 4);
  await syncBlocksHelper(faqSec.id, [
    { blockType: "faq", title: "Is Modern Orthodontics ISO certified?", description: "Yes — our quality management system is certified to ISO 13485:2016 by Underwriters Laboratories (UL).", sortOrder: 0 },
    { blockType: "faq", title: "Are your products CE marked for the European market?", description: "Yes, our quality management has been certified to CE by UL, confirming compliance with European Medical Device Directives.", sortOrder: 1 },
    { blockType: "faq", title: "Is Modern Orthodontics FDA registered?", description: "Yes, we're registered with the FDA as a manufacturer and compliant with 21 CFR Parts 808, 812 and 820 (cGMP).", sortOrder: 2 },
    { blockType: "faq", title: "Where can I get your Material Safety Data Sheets?", description: "You can view them directly via the MSDS link above, or email orders@modortho.com for a specific sheet.", sortOrder: 3 },
    { blockType: "faq", title: "How do I read the symbols on a product label?", description: "See the Product Label Symbols reference above for the most common marks — catalogue number, lot code, use-by date and more.", sortOrder: 4 },
  ]);
  console.log("  ✅ Quality & Certifications reconciled.");
}

async function reconcileManufacturingServices() {
  console.log("🔄 Reconciling Manufacturing Services CMS data...");
  const page = await upsertPageHelper({
    title: "Manufacturing Services",
    slug: "manufacturing-services",
    pageKey: "manufacturing",
    seoTitle: "Manufacturing Services — Modern Orthodontics",
    seoDescription: "MIM, sheet metal and in-house NiTi wire drawing capabilities for OEM and private-label orthodontic manufacturing partners.",
  });

  const heroSec = await upsertSectionHelper(page.id, "manufacturing.hero", "Manufacturing Hero", 0);
  await syncBlocksHelper(heroSec.id, [
    {
      blockType: "hero",
      title: "Manufacturing services built for OEM partners.",
      subtitle: "Capabilities",
      description: "Having served the OEM market for many years, we manufacture orthodontic parts of every kind — MIM components, sheet metal parts and the full range of wires — for some of the industry's most prestigious brands.",
      image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      sortOrder: 0,
    },
  ]);

  const expSec = await upsertSectionHelper(page.id, "manufacturing.expertise", "Manufacturing Expertise", 1);
  await syncBlocksHelper(expSec.id, [
    {
      blockType: "rich_text",
      title: "Manufacturing expertise",
      description: "By partnering with MO, you get access to expert engineering and design assistance, with the peace of mind that the job will be done right at a price you can afford. Our lead times are among the shortest in the industry, so your project turns around as quickly as possible.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "Our management team has extensive experience in mould making, MIM manufacturing, sheet metal components and wire products — experience that benefits you through higher-quality parts produced on time. We operate under a single-tier management system, giving customers a quick response to their needs, with no hidden adaptation costs.",
      sortOrder: 1,
    },
  ]);

  const mimSec = await upsertSectionHelper(page.id, "manufacturing.mim", "What is Metal Injection Molding?", 2);
  await syncBlocksHelper(mimSec.id, [
    {
      blockType: "rich_text",
      title: "What is Metal Injection Molding?",
      description: "Metal Injection Molding (MIM) is a specialised process that combines plastic injection moulding with powder metallurgy to produce the intricately-shaped, highly accurate orthodontic parts MO is known for.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "Fine metal powders are mixed with thermoplastic binders to form a feedstock, which is injection moulded. The binders are then chemically or thermally extracted so the part can be sintered to high density — the individual particles metallurgically bond together as material diffusion removes most of the porosity left behind. Sintering shrinks the part to a net shape that can be used as-is or worked further, resulting in a near-full-density, high-strength metal component.",
      sortOrder: 1,
    },
  ]);

  const benSec = await upsertSectionHelper(page.id, "manufacturing.benefits", "Benefits of the MIM Process", 3);
  await syncBlocksHelper(benSec.id, [
    { blockType: "intro", title: "Benefits of the MIM process", description: "MIM offers mechanical properties that exceed plastic injection moulded or die-cast materials, at a cost-effective, automated alternative to labour-intensive investment casting — especially for the small, complex components common in orthodontic hardware.", sortOrder: 0 },
    { blockType: "benefit", icon: "Shapes", title: "Design Flexibility", description: "Geometrically complex parts that conventional powder metal processes can't produce without secondary machining.", sortOrder: 1 },
    { blockType: "benefit", icon: "Gem", title: "Intricate Details", description: "Dovetails, slots, undercuts, threads and complex curved surfaces, including high length-to-diameter cylindrical parts.", sortOrder: 2 },
    { blockType: "benefit", icon: "Layers", title: "Reduced Assemblies", description: "Two or more simpler shapes combined into a single, more complex component to cut assembly costs.", sortOrder: 3 },
    { blockType: "benefit", icon: "Recycle", title: "Reduced Waste & Machining", description: "Net-shape components that eliminate many secondary machining operations.", sortOrder: 4 },
    { blockType: "benefit", icon: "TrendingUp", title: "Improved Physical Properties", description: "95–98% density, approaching wrought material strength, corrosion resistance and magnetic properties.", sortOrder: 5 },
  ]);

  const procSec = await upsertSectionHelper(page.id, "manufacturing.process", "The MIM Process", 4);
  await syncBlocksHelper(procSec.id, [
    { blockType: "step", icon: "FlaskConical", title: "1. Mixing", description: "Micron-sized metal powders are hot-mixed with thermoplastics chosen for moulding, handling and binder-removal properties.", sortOrder: 0 },
    { blockType: "step", icon: "Factory", title: "2. Molding", description: "The feedstock is heated to a toothpaste consistency, injected into a closed mould, cooled and ejected — typically with robotic pick-off.", sortOrder: 1 },
    { blockType: "step", icon: "Wind", title: "3. Debinding", description: "Thermoplastic binders are removed in two stages, opening a pore network without creating internal cracks or voids.", sortOrder: 2 },
    { blockType: "step", icon: "Flame", title: "4. Sintering", description: "Parts are heated to 2200–2550°F (1200–1400°C), shrinking 15–20% to reach 96–98% of full density.", sortOrder: 3 },
  ]);

  const nitiSec = await upsertSectionHelper(page.id, "manufacturing.niti", "Nickel Titanium Wire Drawing", 5, {
    calloutText: "100% final inspection. Every NiTi archwire undergoes intense scientific testing during manufacturing and a full final inspection before packaging.",
  });
  await syncBlocksHelper(nitiSec.id, [
    {
      blockType: "rich_text",
      title: "Nickel Titanium wire drawing",
      description: "We're one of the few orthodontic manufacturers with an in-house wire drawing facility, drawing all Nitinol and stainless-steel wires ourselves. Our NiTi archwire is the result of years of research into the material science, with manufacturing processes refined to deliver consistent force, elasticity and memory in every wire.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "NiTi wire provides lower initial load forces and increased residual forces as full shape recovery progresses — easier wire deflection and delivery to the bracket, less stress on bonds, and increased patient comfort, while staying active through complete archform development.",
      sortOrder: 1,
    },
  ]);

  const faqSec = await upsertSectionHelper(page.id, "manufacturing.faqs", "Manufacturing FAQs", 6);
  await syncBlocksHelper(faqSec.id, [
    { blockType: "faq", title: "What is Metal Injection Molding, and why does MO use it?", description: "MIM combines plastic injection moulding with powder metallurgy to produce small, intricately-shaped, high-strength parts — ideal for the complex geometries common in orthodontic hardware.", sortOrder: 0 },
    { blockType: "faq", title: "Do you manufacture NiTi and stainless-steel wires in-house?", description: "Yes. We operate our own wire drawing facility and draw all Nitinol and stainless-steel wires ourselves, with 100% final inspection before packaging.", sortOrder: 1 },
    { blockType: "faq", title: "What lead times can OEM partners expect?", description: "Our lead times are among the shortest in the industry, supported by a single-tier management structure built for quick response.", sortOrder: 2 },
    { blockType: "faq", title: "Can you manufacture against our own design, or only catalogue parts?", description: "Both. Our team provides engineering and design assistance from the earliest stage, factoring MIM manufacturing into the design itself for the best result.", sortOrder: 3 },
    { blockType: "faq", title: "Is there a minimum order quantity for OEM or private-label work?", description: "MIM economics favour higher annual volumes, but we work with OEM partners individually — email orders@modortho.com with your requirement and we'll advise on the best fit.", sortOrder: 4 },
  ]);
  console.log("  ✅ Manufacturing Services reconciled.");
}

async function reconcileDesignAndEngineering() {
  console.log("🔄 Reconciling Design & Engineering CMS data...");
  const page = await upsertPageHelper({
    title: "Design & Engineering",
    slug: "design-and-engineering",
    pageKey: "design-and-engineering",
    seoTitle: "Design & Engineering — Modern Orthodontics",
    seoDescription: "In-house product design, CAD modelling and tooling capabilities behind every Modern Orthodontics product.",
  });

  const heroSec = await upsertSectionHelper(page.id, "design.hero", "Design Hero", 0);
  await syncBlocksHelper(heroSec.id, [
    {
      blockType: "hero",
      title: "A complete in-house design and engineering team.",
      subtitle: "Capabilities",
      description: "Direct supervision over product quality and functionality starts at the design stage. Our team brings over 20 years of collective orthodontic design experience across multiple 3D modelling platforms, working under the guidance of our founder, an orthodontist with more than two decades of clinical practice.",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      sortOrder: 0,
    },
  ]);

  const toolSec = await upsertSectionHelper(page.id, "design.tooling", "In-House Tooling", 1);
  await syncBlocksHelper(toolSec.id, [
    {
      blockType: "rich_text",
      title: "In-house tooling, start to finish",
      description: "Design and engineering is the foundation every later manufacturing step builds on. Our tool room is equipped to design and manufacture our own molds and sheet metal tools using multiple CAD platforms, so we never depend on outside vendors for mold design or tooling.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "That in-house control is what lets a product move from paper to market quickly and at a competitive price, without losing precision along the way.",
      sortOrder: 1,
    },
  ]);

  const cadSec = await upsertSectionHelper(page.id, "design.cad", "CAD & Mold Design", 2);
  await syncBlocksHelper(cadSec.id, [
    { blockType: "intro", title: "What modern CAD catches before a tool is cut", description: "Current-generation 3D modelling software does more than draw a part — draft analysis, wall-thickness checks, undercut detection, geometry verification and parting-line recognition all happen before any metal is machined. The same software can flag sink marks, knit lines and other cosmetic defects in advance, which saves both time and tooling cost.", sortOrder: 0 },
    { blockType: "capability", icon: "Ruler", title: "Draft & Thickness Analysis", description: "Wall thickness and draft angles checked before a mold is ever cut.", sortOrder: 1 },
    { blockType: "capability", icon: "ScanSearch", title: "Undercut Detection", description: "Geometry and parting-line issues caught at the design stage, not during a failed first run.", sortOrder: 2 },
    { blockType: "capability", icon: "Gauge", title: "Moldability Forecasting", description: "Sink marks, knit lines and cosmetic defects predicted and designed around in advance.", sortOrder: 3 },
  ]);

  const whySec = await upsertSectionHelper(page.id, "design.why", "Why This Shortens Lead Time", 3);
  await syncBlocksHelper(whySec.id, [
    {
      blockType: "rich_text",
      title: "Why this shortens your lead time",
      description: "The mold design stage is usually the most time-consuming and costly part of bringing a plastic or metal-injection-molded part to production. By forecasting problems and confirming moldability upfront, revisions happen on screen instead of on a finished tool — which is a large part of why our lead times run shorter than most of the industry.",
      sortOrder: 0,
    },
  ]);

  const faqSec = await upsertSectionHelper(page.id, "design.faqs", "Design & Engineering FAQs", 4);
  await syncBlocksHelper(faqSec.id, [
    { blockType: "faq", title: "Does Modern Orthodontics design tools and molds in-house, or outsource them?", description: "Fully in-house. Our tool room designs and manufactures its own molds and sheet metal tools using multiple CAD platforms, so we don't depend on outside vendors for tooling.", sortOrder: 0 },
    { blockType: "faq", title: "Who leads the design team?", description: "The design team works under the direct guidance of our founder, an orthodontist with more than two decades of clinical practice, alongside a design team with 20+ years of combined orthodontic design experience.", sortOrder: 1 },
    { blockType: "faq", title: "How does CAD software reduce project risk before tooling starts?", description: "Modern 3D modelling tools check draft angles, wall thickness, undercuts and parting lines, and can forecast tooling problems like sink marks before a mold is cut — catching issues on screen instead of on a finished tool.", sortOrder: 2 },
    { blockType: "faq", title: "Can your design team work from our own product concept?", description: "Yes — we offer concurrent engineering and design assistance from the earliest stage, which is part of why our lead times are among the shortest in the industry.", sortOrder: 3 },
  ]);
  console.log("  ✅ Design & Engineering reconciled.");
}

async function reconcileOemServices() {
  console.log("🔄 Reconciling OEM Services CMS data...");
  const page = await upsertPageHelper({
    title: "OEM Services",
    slug: "oem-services",
    pageKey: "oem-services",
    seoTitle: "OEM Services — Modern Orthodontics",
    seoDescription: "OEM manufacturing, assembly, inspection, custom labelling and packaging for orthodontic industry partners worldwide.",
  });

  const heroSec = await upsertSectionHelper(page.id, "oem.hero", "OEM Hero", 0);
  await syncBlocksHelper(heroSec.id, [
    {
      blockType: "hero",
      title: "A preferred OEM partner for orthodontic brands worldwide.",
      subtitle: "Capabilities",
      description: "We've built our OEM business on the same things our own product line is judged on: product quality, end-to-end production control, and the ability to customise to a partner's exact specification — backed by an in-house tooling facility that keeps every step under one roof.",
      image: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      sortOrder: 0,
    },
  ]);

  const offerSec = await upsertSectionHelper(page.id, "oem.offer", "What Our OEM Service Covers", 1);
  await syncBlocksHelper(offerSec.id, [
    {
      blockType: "rich_text",
      title: "What our OEM service covers",
      description: "Our OEM work specialises in high-volume, labour-intensive operations: assembly line production, inspection, final packaging, custom labelling and shipping, all under the same roof as our own tooling facility. That single-site setup is what lets us hold consistent quality across every product we manufacture, for our own catalogue and for partner brands alike.",
      sortOrder: 0,
    },
    {
      blockType: "rich_text",
      title: null,
      description: "Orthodontist feedback from across the more than 40 countries we ship to has shaped that production discipline over time, and our R&D team continues working to shorten turnaround on every new OEM project.",
      sortOrder: 1,
    },
  ]);

  const whySec = await upsertSectionHelper(page.id, "oem.why", "Why Partner With Us", 2);
  await syncBlocksHelper(whySec.id, [
    { blockType: "capability", icon: "SlidersHorizontal", title: "Production Flexibility", description: "Direct input into production design rather than a fixed catalogue of options.", sortOrder: 0 },
    { blockType: "capability", icon: "Users", title: "Direct Access to Leadership", description: "Communication with senior management, not layers of account management.", sortOrder: 1 },
    { blockType: "capability", icon: "Clock", title: "Real-Time Schedule Visibility", description: "Live updates on where your production run actually stands.", sortOrder: 2 },
    { blockType: "capability", icon: "PackageOpen", title: "Packaging Freedom", description: "Custom labelling and packaging built around your brand, not ours.", sortOrder: 3 },
  ]);

  const benSec = await upsertSectionHelper(page.id, "oem.benefits", "The Cost Case for Partnering", 3);
  await syncBlocksHelper(benSec.id, [
    { blockType: "intro", title: "The cost case for partnering with us", description: "Beyond product quality, OEM partners typically see savings across several parts of their operation at once:", sortOrder: 0 },
    { blockType: "capability", icon: "Building2", title: "Lower In-House Overhead", description: "Reduced or eliminated need for your own assembly and packaging staff.", sortOrder: 1 },
    { blockType: "capability", icon: "Warehouse", title: "Lower Warehousing Cost", description: "Less inventory sitting in your own facility waiting to be assembled.", sortOrder: 2 },
    { blockType: "capability", icon: "Truck", title: "Lower Transport Cost", description: "Fewer shipping legs between raw material, assembly and final delivery.", sortOrder: 3 },
    { blockType: "capability", icon: "ClipboardCheck", title: "Centralised Control", description: "One manufacturing location accountable for the full production run.", sortOrder: 4 },
  ]);

  const faqSec = await upsertSectionHelper(page.id, "oem.faqs", "OEM Services FAQs", 4);
  await syncBlocksHelper(faqSec.id, [
    { blockType: "faq", title: "How long has Modern Orthodontics worked as an OEM manufacturer?", description: "Over 20 years, alongside our own product line, specialising in high-volume orthodontic hardware production.", sortOrder: 0 },
    { blockType: "faq", title: "Can OEM partners customise packaging and labelling?", description: "Yes — custom labelling, packaging and assembly are part of the core OEM service, not an add-on.", sortOrder: 1 },
    { blockType: "faq", title: "Will I have a single point of contact for an OEM project?", description: "Partnering with us means direct communication with senior management and real-time visibility into your production schedule, rather than working through multiple account layers.", sortOrder: 2 },
    { blockType: "faq", title: "What cost savings can an OEM partner expect?", description: "Most partners see reduced in-house assembly and warehouse staffing needs, lower transport costs from centralised production, and tighter inventory control overall.", sortOrder: 3 },
  ]);
  console.log("  ✅ OEM Services reconciled.");
}

async function reconcileCustomPackaging() {
  console.log("🔄 Reconciling Custom Packaging CMS data...");
  const page = await upsertPageHelper({
    title: "Custom Packaging",
    slug: "custom-packaging",
    pageKey: "custom-packaging",
    seoTitle: "Custom Packaging — Modern Orthodontics",
    seoDescription: "Full and partial product assembly, welding, finishing, laser etching and custom packaging services.",
  });

  const heroSec = await upsertSectionHelper(page.id, "packaging.hero", "Packaging Hero", 0);
  await syncBlocksHelper(heroSec.id, [
    {
      blockType: "hero",
      title: "A full-service assembly and packaging facility.",
      subtitle: "Capabilities",
      description: "From raw material coordination through final packaging and shipping, we run complete and partial product assembly under one roof — built for high-volume, labour-intensive work with assured on-time delivery.",
      image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      sortOrder: 0,
    },
  ]);

  const handleSec = await upsertSectionHelper(page.id, "packaging.handle", "What We Handle", 1);
  await syncBlocksHelper(handleSec.id, [
    {
      blockType: "rich_text",
      title: "What we handle",
      description: "Our packaging and assembly capability covers raw material coordination, inventory management, assembly line production, inspection, final packaging and shipping — combining modern equipment with staff attention to detail to keep both cost and turnaround predictable.",
      sortOrder: 0,
    },
  ]);

  const finishSec = await upsertSectionHelper(page.id, "packaging.finishing", "Assembly & Finishing Services", 2);
  await syncBlocksHelper(finishSec.id, [
    { blockType: "capability", icon: "Flame", title: "Tack & Custom Welding", description: "Precision welding for component assembly, including custom configurations.", sortOrder: 0 },
    { blockType: "capability", icon: "Beaker", title: "Brazing", description: "Joining processes for components that need a stronger bond than welding alone.", sortOrder: 1 },
    { blockType: "capability", icon: "Palette", title: "Color Coding", description: "Visual identification systems applied across product lines.", sortOrder: 2 },
    { blockType: "capability", icon: "Sparkles", title: "Finishing", description: "Surface finishing for a consistent final appearance.", sortOrder: 3 },
    { blockType: "capability", icon: "Zap", title: "Laser Etching & Engraving", description: "Permanent marking for traceability and branding.", sortOrder: 4 },
    { blockType: "capability", icon: "SearchCheck", title: "Inspection, Sorting & Rework", description: "Detailed process analysis to catch and correct non-conforming parts before they ship.", sortOrder: 5 },
  ]);

  const benSec = await upsertSectionHelper(page.id, "packaging.benefits", "What Partnering Saves You", 3);
  await syncBlocksHelper(benSec.id, [
    { blockType: "capability", icon: "Building2", title: "Lower Staffing Overhead", description: "Reduced need for in-house assembly and packaging teams.", sortOrder: 0 },
    { blockType: "capability", icon: "Warehouse", title: "Lower Warehousing Cost", description: "Less space tied up holding partially assembled inventory.", sortOrder: 1 },
    { blockType: "capability", icon: "Truck", title: "Lower Transport Cost", description: "Fewer shipping legs between assembly and final delivery.", sortOrder: 2 },
    { blockType: "capability", icon: "ClipboardCheck", title: "Centralised Control", description: "One location accountable for the full assembly and packaging run.", sortOrder: 3 },
  ]);

  const faqSec = await upsertSectionHelper(page.id, "packaging.faqs", "Custom Packaging FAQs", 4);
  await syncBlocksHelper(faqSec.id, [
    { blockType: "faq", title: "Does Modern Orthodontics offer full or partial product assembly?", description: "Both — our facility is built for complete and partial product assembly depending on what a project needs.", sortOrder: 0 },
    { blockType: "faq", title: "What finishing services are available alongside packaging?", description: "Tack and custom welding, brazing, colour coding, surface finishing, laser etching and engraving, plus inspection, sorting and rework.", sortOrder: 1 },
    { blockType: "faq", title: "Can packaging be customised for our brand?", description: "Yes, custom labelling and packaging are part of the standard assembly and packaging service.", sortOrder: 2 },
    { blockType: "faq", title: "What cost savings come from outsourcing assembly and packaging to MO?", description: "Most partners reduce in-house assembly and packaging staffing, cut warehousing and transport costs, and gain centralised inventory control.", sortOrder: 3 },
  ]);
  console.log("  ✅ Custom Packaging reconciled.");
}

async function verifyAllPages() {
  console.log("\n📊 Verification of All CMS Pages in PostgreSQL:");
  const pages = await prisma.cMSPage.findMany({
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          blocks: {
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
  });

  for (const page of pages) {
    console.log(`\n📄 Page: ${page.title} (key: ${page.pageKey}, slug: ${page.slug})`);
    console.log(`   SEO: "${page.seoTitle}" | Robots: "${page.robotsTag}"`);
    console.log(`   Sections (${page.sections.length}):`);
    for (const section of page.sections) {
      console.log(`     🔹 Section [${section.sortOrder}] "${section.title}" (key: ${section.sectionKey}) - ${section.blocks.length} blocks`);
    }
  }
}

async function main() {
  await reconcileQualityCertifications();
  await reconcileManufacturingServices();
  await reconcileDesignAndEngineering();
  await reconcileOemServices();
  await reconcileCustomPackaging();
  await verifyAllPages();
}

main()
  .catch((e) => {
    console.error("❌ Reconciliation failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
