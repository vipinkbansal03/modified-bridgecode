import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { StatItem } from "@/types/common.types";

interface StatsSectionProps {
  data: StatItem[];
}

export function StatsSection({ data }: StatsSectionProps) {
  return (
    <section className="bg-brand text-white">
      <Container className="py-20">
        <Reveal>
          <div className="grid grid-cols-2 gap-7.5 sm:grid-cols-4">
            {data.map((stat, i) => (
              <div key={stat.label} className={`border-l border-white/28 pl-6 ${i === 0 ? "border-l-0 pl-0" : ""} sm:[&:nth-child(odd)]:border-l-0 sm:[&:nth-child(odd)]:pl-0 sm:border-l sm:pl-6 sm:[&:first-child]:border-l-0 sm:[&:first-child]:pl-0`}>
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white/72">{stat.label}</span>
                <p className="my-2.5 max-w-[200px] text-[14.5px] text-white/85">{stat.description}</p>
                <p className="text-[clamp(42px,5.4vw,64px)] font-light text-white">{stat.value}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
