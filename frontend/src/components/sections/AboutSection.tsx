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
    <section className="py-6 lg:py-[34px]">
      <Container>
        <Reveal>
          <div>
            <h2 className="text-[clamp(28px,3.6vw,46px)] font-light text-ink leading-[1.2]">
              {data.heading}
            </h2>
            <p className="mt-4 max-w-[520px] text-[16.5px] text-steel">
              {data.lede}
            </p>
            <PillCTA
              href={data.ctaHref}
              label={data.ctaLabel}
              className="mt-5"
            />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
