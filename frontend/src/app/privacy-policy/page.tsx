import type { Metadata } from "next";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ORDERS_EMAIL } from "@/utils/constants";
import { PrivacyAccordion } from "./PrivacyAccordion";
import { PrivacyPageNav } from "./PrivacyPageNav";

export const metadata: Metadata = {
  title: "Privacy Policy | Modern Orthodontics",
  description:
    "Learn how Modern Orthodontics collects, uses, and protects customer information.",
};

const updatedAt = "June 2026";

const sections = [
  {
    title: "Our privacy commitment",
    items: [
      "Modern Orthodontics is committed to protecting your privacy.",
      "Modern Orthodontics will not sell customer information to third-party vendors.",
    ],
  },
  {
    title: "Collection of personal information",
    items: [
      "Modern Orthodontics may collect personally identifiable information such as your email address, name, address, or telephone number.",
      "Modern Orthodontics may also collect anonymous demographic information that is not unique to you, such as ZIP code, age, gender, preferences, interests, and favourites.",
    ],
  },
  {
    title: "User accounts",
    items: [
      "You may need to create an account and provide certain information about yourself to use some features offered through the site.",
      "You are responsible for maintaining the confidentiality of your account password.",
      "You are responsible for all activities that occur in connection with your account.",
      "You agree to notify us immediately of any unauthorized use of your account.",
      "Modern Orthodontics reserves the right to close your account at any time for any or no reason.",
    ],
  },
  {
    title: "Terms of use",
    items: [
      "To access or use the site, you must be 18 years or older.",
      "You must have the required power and authority to enter into these terms.",
      "You may not access or use the site if you are a competitor of Modern Orthodontics.",
      "You may not access or use the site if Modern Orthodontics has previously banned you from the site or closed your account.",
    ],
  },
  {
    title: "Use of cookies",
    items: [
      "The website may use cookies to help personalize your online experience.",
      "A cookie is a text file placed on your hard disk by a web page server.",
      "Cookies cannot be used to run programs or deliver viruses to your computer.",
      "Cookies are uniquely assigned to you and can only be read by a web server in the domain that issued the cookie.",
    ],
  },
  {
    title: "Site availability",
    items: [
      "The website may be modified, updated, interrupted, suspended, or discontinued at any time.",
      "Such changes may happen without notice or liability.",
    ],
  },
];

const quickLinks = sections.map((section) => ({
  id: section.title.toLowerCase().replace(/\s+/g, "-"),
  label: section.title,
  href: `#${section.title.toLowerCase().replace(/\s+/g, "-")}`,
}));

export default function PrivacyPolicyPage() {
  return (
    <main className="bg-white">
      <section className="border-b border-line bg-white">
        <Container className="py-6 lg:py-[34px]">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
            <div>
              <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">
                PRIVACY INFORMATION
              </span>
              <h1 className="max-w-[640px] text-[clamp(30px,4vw,44px)] font-light leading-tight text-ink">
                Privacy Policy
              </h1>
              <p className="mt-4 max-w-[560px] text-[15.5px] leading-relaxed text-steel">
                Learn how Modern Orthodontics collects, uses, and protects
                information shared through this website.
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
                For privacy-related questions, contact our support team.
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
          <PrivacyAccordion sections={sections} />

          <div className="grid gap-10 lg:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="hidden lg:sticky lg:top-28 lg:block lg:self-start">
              <PrivacyPageNav links={quickLinks} />
            </aside>

            <div className="hidden space-y-5 lg:block">
              {sections.map((section, index) => (
                <section
                  key={section.title}
                  id={section.title.toLowerCase().replace(/\s+/g, "-")}
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
                  Need privacy support?
                </h2>
                <p className="mt-3 max-w-[720px] text-[15px] leading-7 text-white/70">
                  If you have questions about how your information is handled,
                  contact the Modern Orthodontics team.
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
              Need privacy support?
            </h2>
            <p className="mt-3 text-[14px] leading-6 text-white/70">
              If you have questions about how your information is handled,
              contact the Modern Orthodontics team.
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
