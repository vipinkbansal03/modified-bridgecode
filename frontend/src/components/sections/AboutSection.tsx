import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { PillCTA } from "../ui/PillCTA";

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
    <section className="pt-6 pb-6 lg:pt-8 lg:pb-8">
      <Container>
        <Reveal>
          <div className="grid gap-12 sm:grid-cols-[0.9fr_1.1fr]">
            <div aria-hidden="true" className="hidden sm: block" />
            <div>
              <h2 className="text-[clamp(28px,3.6vw,46px)] font-light leading-[1.22] text-ink">{data.heading}</h2>
              <p className="mt-4 max-w-[520px] text-[16.5px] text-steel">{data.lede}</p>
              <PillCTA href={data.ctaHref} label={data.ctaLabel} className="mt-5" />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
