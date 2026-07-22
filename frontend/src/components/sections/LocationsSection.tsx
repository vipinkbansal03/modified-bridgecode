"use client";

import { useMemo, useState } from "react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { WORLD_MAP_PATH } from "@/data/worldMapPath";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { LocationPin } from "@/types/common.types";
import type { StaticMessageKey } from "@/i18n/staticMessages";

interface LocationsSectionProps {
  data: { subtitle: string; pins: LocationPin[] };
}

const pinColor: Record<LocationPin["category"], string> = {
  hq: "#E31E24",
  export: "#1A1A1A",
  dealer: "#9A9A9A",
};

const locationNameKeys: Record<string, StaticMessageKey> = {
  hq: "ui.location.ludhianaIndia",
  us: "ui.location.unitedStates",
  de: "ui.location.germany",
  gb: "ui.location.unitedKingdom",
  za: "ui.location.southAfrica",
  au: "ui.location.australia",
  br: "ui.location.brazil",
  mx: "ui.location.mexico",
  ae: "ui.location.unitedArabEmirates",
  ke: "ui.location.kenya",
  id: "ui.location.indonesia",
  vn: "ui.location.vietnam",
};

export function LocationsSection({ data }: LocationsSectionProps) {
  const { t } = useStaticTranslations();
  const [activeId, setActiveId] = useState<string | null>(null);
  const categoryLabel: Record<LocationPin["category"], string> = {
    hq: t("ui.home.manufacturingHq"),
    export: t("ui.home.directExport"),
    dealer: t("ui.home.dealerNetwork"),
  };
  const locationLabel = (pin: LocationPin) => {
    const placeKey = locationNameKeys[pin.id];
    const place = placeKey ? t(placeKey) : pin.label.split("—").pop()?.trim() ?? pin.label;
    const prefix = pin.category === "hq" ? t("ui.home.manufacturingFacility") : categoryLabel[pin.category];
    return `${prefix} — ${place}`;
  };
  const active = useMemo(() => data.pins.find((pin) => pin.id === activeId) ?? data.pins[0] ?? null, [activeId, data.pins]);
  const groupedPins = useMemo(
    () => ({
      hq: data.pins.filter((pin) => pin.category === "hq"),
      export: data.pins.filter((pin) => pin.category === "export"),
      dealer: data.pins.filter((pin) => pin.category === "dealer"),
    }),
    [data.pins]
  );

  return (
    <section className="border-t border-line pt-4 pb-3 lg:pt-5 lg:pb-4">
      <Container>
        <Reveal>
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
            <h2 className="text-[clamp(28px,3.4vw,40px)] font-light text-ink">{t("ui.home.ourLocations")}</h2>
            <span className="text-sm text-steel">
              {data.subtitle === "Find us around the globe" ? t("ui.home.findUsAroundGlobe") : data.subtitle}
            </span>
          </div>

          <div className="relative mt-2.5 w-full max-w-[760px] mx-auto">
            <svg viewBox="0 0 1010 666" className="block w-full" preserveAspectRatio="xMidYMid meet">
              <path d={WORLD_MAP_PATH} fill="#F2F2F2" stroke="#F2F2F2" strokeWidth={0.8} strokeLinejoin="round" />
            </svg>

            {data.pins.map((pin) => (
              <button
                key={pin.id}
                aria-label={locationLabel(pin)}
                onMouseEnter={() => setActiveId(pin.id)}
                onFocus={() => setActiveId(pin.id)}
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
                {locationLabel(active)}
              </div>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-7.5 border-t border-line pt-4 text-[13.5px] text-steel">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-brand" /> {categoryLabel.hq}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-ink" /> {categoryLabel.export}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-steel-2" /> {categoryLabel.dealer}
            </span>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {(["hq", "export", "dealer"] as const).map((category) => (
              <div key={category} className="rounded-md border border-line bg-white p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: pinColor[category] }} />
                  <h3 className="text-[15px] font-medium text-ink">{categoryLabel[category]}</h3>
                </div>
                <div className="space-y-1.5">
                  {groupedPins[category].map((pin) => (
                    <button
                      key={pin.id}
                      type="button"
                      onMouseEnter={() => setActiveId(pin.id)}
                      onFocus={() => setActiveId(pin.id)}
                      onClick={() => setActiveId(pin.id)}
                      className={`w-full rounded-md border px-3 py-2 text-left text-[13.5px] transition-colors ${
                        active?.id === pin.id
                          ? "border-[#E31E24] bg-red-50 text-ink"
                          : "border-line bg-offwhite text-steel hover:border-steel-2 hover:bg-white"
                      }`}
                    >
                      {locationLabel(pin)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
