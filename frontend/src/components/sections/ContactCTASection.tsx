import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { PillCTA } from "../ui/PillCTA";

export interface ContactCtaData {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
}

interface ContactCTASectionProps {
  data: ContactCtaData;
}

export function ContactCTASection({ data }: ContactCTASectionProps) {
  return (
    <section
      id="contact"
      className="relative flex min-h-[400px] items-center overflow-hidden bg-brand text-white"
    >
      <div className="absolute inset-0">
        <Image
          src={data.image}
          alt=""
          fill
          className="object-cover"
          style={{ filter: "grayscale(100%) contrast(1.08) brightness(0.6)" }}
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 80% 25%, rgba(227,30,36,.28), transparent 55%), linear-gradient(100deg, rgba(0,0,0,.78) 0%, rgba(0,0,0,.2) 60%)",
        }}
      />
      <Container className="relative w-full py-16">
        <h2 className="text-[clamp(34px,5vw,52px)] font-light text-white">
          {data.heading}
        </h2>
        <p className="mt-4 max-w-[380px] text-[15.5px] text-white/82">
          {data.body}
        </p>
        <PillCTA href={data.ctaHref} label={data.ctaLabel} className="mt-8" />
      </Container>
    </section>
  );
}
