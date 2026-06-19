"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { WORLD_MAP_PATH } from "@/data/worldMapPath";
import type { LocationPin } from "@/types/common.types";

interface LocationsSectionProps {
  data: { subtitle: string; pins: LocationPin[] };
}

const pinColor: Record<LocationPin["category"], string> = {
  hq: "#E31E24",
  export: "#1A1A1A",
  dealer: "#9A9A9A",
};

export function LocationsSection({ data }: LocationsSectionProps) {
  const [active, setActive] = useState<LocationPin | null>(null);

  return (
    <section className="border-t border-line py-24 sm:py-32">
      <Container>
        <Reveal>
          <div className="mb-9 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-7">
            <h2 className="text-[clamp(28px,3.4vw,40px)] font-light text-ink">Our Locations</h2>
            <span className="text-sm text-steel">{data.subtitle}</span>
          </div>

          <div className="relative mt-2.5 w-full">
            <svg viewBox="0 0 1010 666" className="block w-full" preserveAspectRatio="xMidYMid meet">
              <path d={WORLD_MAP_PATH} fill="#F2F2F2" stroke="#F2F2F2" strokeWidth={0.8} strokeLinejoin="round" />
            </svg>

            {data.pins.map((pin) => (
              <button
                key={pin.id}
                aria-label={pin.label}
                onMouseEnter={() => setActive(pin)}
                onMouseLeave={() => setActive(null)}
                className="absolute -translate-x-1/2 -translate-y-full cursor-pointer border-none bg-transparent p-0 transition-transform hover:scale-[1.18]"
                style={{
                  left: `${pin.xPct}%`,
                  top: `${pin.yPct}%`,
                  fontSize: pin.category === "hq" ? 26 : 18,
                  color: pinColor[pin.category],
                  zIndex: pin.category === "hq" ? 3 : 2,
                }}
              >
                ●
              </button>
            ))}

            {active && (
              <div
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-[120%] rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-md"
                style={{ left: `${active.xPct}%`, top: `${active.yPct}%` }}
              >
                {active.label}
              </div>
            )}
          </div>

          <div className="mt-9 flex flex-wrap gap-7.5 border-t border-line pt-6.5 text-[13.5px] text-steel">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" /> Manufacturing HQ
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" /> Direct Export
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-steel-2" /> Dealer Network
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
