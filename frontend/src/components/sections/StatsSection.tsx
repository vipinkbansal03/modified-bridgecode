import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { StatItem } from "@/types/common.types";

interface StatsSectionProps {
  data: StatItem[];
}

export function StatsSection({ data }: StatsSectionProps) {
  return (
    <section className="bg-brand text-white">
      <Container className="py-5 lg:py-7">
        <Reveal>
          <div className="grid grid-cols-2 gap-y-10 sm:grid-cols-4 sm:gap-y-0">
            {data.map((stat, i) => (
              <div
                key={stat.label}
                className={`pl-5 sm:pl-8 ${
                  i % 2 === 0 ? "border-l-0 pl-0" : "border-l border-white/28"
                } ${
                  i === 0
                    ? "sm:border-l-0 sm:pl-0"
                    : "sm:border-l sm:border-white/28"
                }`}
              >
                <span className="text-[11.5px] font-semibold uppercase tracking-wide text-white/72">
                  {stat.label}
                </span>
                <p className="my-2.5 max-w-[200px] text-[14.5px] text-white/85">
                  {stat.description}
                </p>
                <p className="text-[clamp(38px,5vw,64px)] font-light text-white">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
