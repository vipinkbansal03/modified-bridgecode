import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export interface AboutSectionData {
  heading: string;
  lede: string;
  ctaLabel: string;
  ctaHref: string;
}

interface AboutSectionProps {
  data: AboutSectionData;
}

export function AboutSection({ data }: AboutSectionProps) {
  return (
    <section className="py-24 sm:py-32">
      <Container>
        <Reveal>
          <div className="grid gap-12 sm:grid-cols-[0.9fr_1.1fr]">
            <h2 className="text-[clamp(28px,3.6vw,46px)] font-light leading-[1.22] text-ink">{data.heading}</h2>
            <div>
              <p className="max-w-[520px] text-[16.5px] text-steel">{data.lede}</p>
              <a href={data.ctaHref} className="pill-cta mt-8">
                <span>{data.ctaLabel}</span>
                <span className="arrow">
                  <ArrowRight size={16} color="#fff" />
                </span>
              </a>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
