import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Compass, ShoppingBag, Landmark, UserCheck, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Sitemap | Modern Orthodontics",
  description: "Navigate the pages and sections of the Modern Orthodontics storefront.",
};

const sitemapGroups = [
  {
    title: "Shop & Products",
    icon: <ShoppingBag size={20} className="text-[#E31E24]" />,
    links: [
      { label: "Product Catalog", href: "/products" },
      { label: "Quick Order Grid", href: "/quick-order" },
      { label: "Metal Brackets", href: "/products?category=metal-brackets" },
      { label: "Aesthetic Brackets", href: "/products?category=aesthetic-brackets" },
      { label: "Molar Bands & Tubes", href: "/products?category=molar-bands" },
      { label: "NiTi & SS Wires", href: "/products?category=niti-wires" },
    ],
  },
  {
    title: "Services & Capabilities",
    icon: <Compass size={20} className="text-[#E31E24]" />,
    links: [
      { label: "Design & Engineering", href: "/design-and-engineering" },
      { label: "OEM Services", href: "/oem-services" },
      { label: "Custom Packaging", href: "/custom-packaging" },
      { label: "Manufacturing Services", href: "/manufacturing-services" },
    ],
  },
  {
    title: "Company",
    icon: <Landmark size={20} className="text-[#E31E24]" />,
    links: [
      { label: "About Us", href: "/about" },
      { label: "Quality Certifications", href: "/quality-certifications" },
      { label: "Contact Us", href: "/contact" },
      { label: "Blog & Updates", href: "/blog" },
    ],
  },
  {
    title: "Legal & Policies",
    icon: <ShieldCheck size={20} className="text-[#E31E24]" />,
    links: [
      { label: "Terms & Conditions", href: "/terms-and-conditions" },
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Return & Refund Policy", href: "/return-policy" },
    ],
  },
  {
    title: "Account & Portal",
    icon: <UserCheck size={20} className="text-[#E31E24]" />,
    links: [
      { label: "My Account Dashboard", href: "/account" },
      { label: "Customer Sign In", href: "/login" },
      { label: "Customer Registration", href: "/register" },
      { label: "Forgot Password", href: "/forgot-password" },
      { label: "My Wishlist", href: "/wishlist" },
    ],
  },
];

export default function SitemapPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-line bg-[#FAFAFA] py-16 sm:py-20">
        <Container className="px-4 sm:px-6 lg:px-10">
          <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
            NAVIGATION
          </span>
          <h1 className="text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
            Sitemap
          </h1>
          <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
            Use the index below to easily locate and navigate to the different sections and pages of our platform.
          </p>
        </Container>
      </section>

      <section className="py-16 lg:py-20">
        <Container className="px-4 sm:px-6 lg:px-10">
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3">
            {sitemapGroups.map((group) => (
              <div
                key={group.title}
                className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"
              >
                <div className="mb-6 flex items-center gap-3 border-b border-line pb-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#FFF1F1]">
                    {group.icon}
                  </span>
                  <h2 className="text-[18px] font-bold text-ink">
                    {group.title}
                  </h2>
                </div>
                <ul className="space-y-3.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-[14.5px] text-steel hover:text-[#E31E24] hover:underline transition-colors block"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Container>
      </section>
    </main>
  );
}
