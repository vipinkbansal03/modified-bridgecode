import type { Metadata } from "next";
import { ContactPageClient } from "@/components/sections/ContactPageClient";
import { buildCmsMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("contact", seoData.contact, "/contact");
}

export default function ContactPage() {
  return <ContactPageClient />;
}
