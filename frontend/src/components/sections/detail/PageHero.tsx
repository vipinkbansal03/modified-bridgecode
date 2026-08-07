import Link from "next/link";
import Image from "next/image";
import { Container } from "@/components/ui/Container";

interface PageHeroProps {
  kicker: string;
  title: string;
  lede: string;
  heroImage: string;
  breadcrumb: { label: string; href?: string }[];
}

export function PageHero({ kicker, title, lede, heroImage, breadcrumb }: PageHeroProps) {
  return (
    <section className="pt-6 lg:pt-[34px]">
      <Container>
        <nav className="text-[13px] text-steel-2">
          {breadcrumb.map((b, i) => (
            <span key={b.label}>
              {b.href ? (
                <Link href={b.href} className="hover:text-brand">
                  {b.label}
                </Link>
              ) : (
                <span>{b.label}</span>
              )}
              {i < breadcrumb.length - 1 && " / "}
            </span>
          ))}
        </nav>

        <div className="pt-5">
          <span className="mb-4 block text-[12.5px] font-semibold uppercase tracking-wide text-brand">{kicker}</span>
          <h1 className="max-w-[760px] text-[clamp(32px,4.4vw,50px)] font-light leading-[1.18] tracking-tight text-ink">
            {title}
          </h1>
          <p className="mt-4.5 max-w-[640px] text-base leading-relaxed text-steel">{lede}</p>
        </div>

        <div className="relative mt-5.5 h-[240px] w-full overflow-hidden sm:h-[420px]">
          <Image src={heroImage} alt={title} fill className="object-cover" sizes="100vw" />
        </div>
      </Container>
    </section>
  );
}
