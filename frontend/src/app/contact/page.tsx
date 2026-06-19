import type { Metadata } from "next";
import { ContactPageClient } from "@/components/sections/ContactPageClient";
import { buildMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";

export const metadata: Metadata = buildMetadata(seoData.contact, "/contact");

export default function ContactPage() {
  return <ContactPageClient />;
}
