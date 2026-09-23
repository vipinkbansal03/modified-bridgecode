import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export interface CapabilityItem {
  title: string;
  image: string;
  description: string;
  linkHref: string;
  linkText?: string;
}

export interface CapabilitiesSectionProps {
  items?: CapabilityItem[];
}
const DEFAULT_CAPABILITIES: CapabilityItem[] = [
  {
    title: "Design & Engineering",
    image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?fm=jpg&q=80&w=400&auto=format&fit=crop",
    description: "Modern Orthodontics has a complete in-house product design and engineering team to ensure direct supervision over the design, prototyping and continuous innovation.",
    linkHref: "/design-and-engineering",
    linkText: "Read more »",
  },
  {
    title: "Manufacturing Services",
    image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?fm=jpg&q=80&w=400&auto=format&fit=crop",
    description: "Having served the OEM market for many years, Modern Orthodontics is a leading manufacturer of all orthodontic parts with world-class SNC, MIM and robotic polishing.",
    linkHref: "/manufacturing-services",
    linkText: "Read more »",
  },
  {
    title: "OEM Services",
    image: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?fm=jpg&q=80&w=400&auto=format&fit=crop",
    description: "Modern Orthodontics takes pride in its history as a preferred OEM for orthodontic industry giants over the last 20 years, ensuring complete IP protection and high precision.",
    linkHref: "/oem-services",
    linkText: "Read more »",
  },
  {
    title: "Custom Packaging",
    image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?fm=jpg&q=80&w=400&auto=format&fit=crop",
    description: "Modern Orthodontics is a full service assembly facility, offering complete and partial product assembly, sterile blisters, private labelling and specialized custom kits.",
    linkHref: "/custom-packaging",
    linkText: "Read more »",
  },
];

export function CapabilitiesSection({ items }: CapabilitiesSectionProps) {
  const capabilities = items && items.length > 0 ? items : DEFAULT_CAPABILITIES;

  return (
    <section className="py-8 sm:py-10 lg:py-12 bg-gray-50/50 border-t border-gray-100">
      <Container>
        <Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 lg:gap-7">
            {capabilities.map((item, idx) => {
              const linkHref = item.linkHref?.trim() || "/";
              const linkText = item.linkText?.trim() || "Read more »";

              return (
                <div
                  key={idx}
                  className="group flex flex-col justify-between rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 lg:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-gray-300 transition-all duration-300 relative overflow-hidden border-b-4 border-b-red-600"
                >
                  <div>
                    <Link href={linkHref} className="block group/title">
                      <h3
                        className="text-[17px] sm:text-[18px] font-bold text-red-600 mb-4 tracking-tight group-hover/title:text-red-700 transition-colors truncate"
                        title={item.title}
                      >
                        {item.title}
                      </h3>
                    </Link>

                    <Link href={linkHref} className="block">
                      <div className="relative mx-auto my-3 h-28 w-28 sm:h-32 sm:w-32 overflow-hidden rounded-full border-4 border-gray-100 shadow-sm bg-gray-50">
                        <Image
                          src={item.image}
                          alt={item.title}
                          fill
                          sizes="128px"
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    </Link>

                    <p className="mt-4 text-[13px] sm:text-[13.5px] leading-relaxed text-gray-600">
                      {item.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 flex justify-end border-t border-gray-100">
                    <Link
                      href={linkHref}
                      className="inline-flex items-center text-[13px] sm:text-[13.5px] font-semibold text-[#0066cc] hover:text-[#004d99] hover:underline transition-colors"
                    >
                      {linkText}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
