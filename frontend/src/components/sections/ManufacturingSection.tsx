import Image from "next/image";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";

export interface ManufacturingSectionData {
  kicker: string;
  heading: string;
  body: string;
  image: string;
}

interface ManufacturingSectionProps {
  data: ManufacturingSectionData;
}

/**
 * Capability teaser block. The original static homepage has no distinct
 * "Manufacturing" section of its own (the closest real content is the About
 * section's CTA, which already links to /manufacturing-services) — adding a
 * duplicate block there would change the design the brief asked to preserve.
 * This component is used instead as the intro teaser on the Manufacturing
 * Services page itself, ahead of its detailed capability content.
 */
export function ManufacturingSection({ data }: ManufacturingSectionProps) {
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <Reveal>
          <div className="grid items-center gap-12 sm:grid-cols-2">
            <div>
              <span className="mb-4 block text-[13px] font-medium uppercase tracking-wide text-brand">{data.kicker}</span>
              <h2 className="text-[clamp(26px,3.4vw,38px)] font-light leading-tight text-ink">{data.heading}</h2>
              <p className="mt-5 text-[15.5px] leading-relaxed text-steel">{data.body}</p>
            </div>
            <div className="relative h-[320px] w-full overflow-hidden rounded-md">
              <Image src={data.image} alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
