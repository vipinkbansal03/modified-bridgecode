import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export interface AboutCardItem {
  title: string;
  image: string;
  description: string;
  linkText?: string;
  linkHref: string;
}

export interface AboutSectionData {
  cards?: AboutCardItem[];
  heading?: string;
  lede?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

interface AboutSectionProps {
  data?: AboutSectionData;
}

const defaultCards: AboutCardItem[] = [
  {
    title: "About Us",
    image: "/images/home/about-us.png",
    description:
      "Modern Orthodontics is a leading manufacturer of high quality, competitively priced orthodontic products. Founded in 1994, we have been doing OEM for many orthodontic companies. We are one of the very few companies in the orthodontic industry having in-house manufacturing of complete range of products...",
    linkText: "Read more »",
    linkHref: "/about",
  },
  {
    title: "Our Mission",
    image: "/images/home/mission.png",
    description:
      "Our mission is to provide high quality orthodontic products throughout the world, on time, competitively priced and with unparalleled customer support. In doing so, we will continue to forge new relationships within our growing customer base and distribution network, while spreading our reputation as a trusted source of quality...",
    linkText: "Read more »",
    linkHref: "/about",
  },
  {
    title: "Quality",
    image: "/images/home/quality.png",
    description:
      "Our dedicated team of professionals are trained to maintain and continually improve the effectiveness of our quality management system while ensuring compliance with applicable standards, regulatory requirements and customer requirements....",
    linkText: "Read more »",
    linkHref: "/quality-certifications",
  },
];

const defaultImages = [
  "/images/home/about-us.png",
  "/images/home/mission.png",
  "/images/home/quality.png",
];

export function AboutSection({ data }: AboutSectionProps) {
  const cards = data?.cards && data.cards.length > 0 ? data.cards : defaultCards;

  const gridColsClass =
    cards.length === 1
      ? "grid-cols-1 max-w-2xl mx-auto"
      : cards.length === 2
      ? "grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto"
      : cards.length === 4
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : cards.length % 4 === 0
      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
      : "grid-cols-1 md:grid-cols-3";

  return (
    <section className="py-8 sm:py-10 lg:py-12">
      <Container>
        <Reveal>
          <div className={`grid ${gridColsClass} gap-6 lg:gap-8`}>
            {cards.map((card, idx) => {
              const imageSrc = card.image?.trim() || defaultImages[idx % defaultImages.length];
              const linkHref = card.linkHref?.trim() || (idx === 2 ? "/quality-certifications" : "/about");
              const linkText = card.linkText?.trim() || "Read more »";

              return (
                <div
                  key={idx}
                  className="group flex flex-col justify-between rounded-xl sm:rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-gray-300 transition-all duration-300"
                >
                  <div>
                    <h2 className="text-[17px] sm:text-[18px] font-bold text-gray-900 mb-3 tracking-tight truncate" title={card.title}>
                      {card.title}
                    </h2>
                    <div className="relative h-44 sm:h-48 w-full overflow-hidden rounded-xl border border-gray-100 bg-gray-50">
                      <Image
                        src={imageSrc}
                        alt={card.title}
                        fill
                        sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                        className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                    <p className="mt-4 text-[13px] sm:text-[13.5px] leading-relaxed text-gray-600 line-clamp-4">
                      {card.description}
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
