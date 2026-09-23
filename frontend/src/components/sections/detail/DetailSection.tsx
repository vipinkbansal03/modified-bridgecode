import Link from "next/link";
import * as Icons from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { DetailPageContent } from "@/types/common.types";

type Section = DetailPageContent["sections"][number];

function Icon({ name, ...props }: { name: string; size?: number; className?: string }) {
  const LucideIcon = (Icons as unknown as Record<string, Icons.LucideIcon>)[name] ?? Icons.Circle;
  return <LucideIcon {...props} />;
}

export function DetailSection({ section }: { section: Section }) {
  return (
    <section id={section.id} className="scroll-mt-20 xl:scroll-mt-36 border-b border-line py-6 lg:py-[34px]">
      <Container>
        <Reveal>
          <h2 className="mb-2 md:mb-4 text-[clamp(24px,2.6vw,32px)] font-normal text-ink leading-none">{section.heading}</h2>

          {section.paragraphs?.map((p, i) => (
            <p key={i} className="mt-3.5 md:mt-4 max-w-[760px] text-[15.5px] leading-[1.8] text-steel first:mt-0">
              {p}
            </p>
          ))}

          {section.capabilityGrid && (
            <div className="mt-6 grid grid-cols-1 border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
              {section.capabilityGrid.map((box) => (
                <div key={box.title} className="border-b border-r border-line p-5 sm:p-8.5">
                  {box.image ? (
                    <div className="mb-4.5 h-40 sm:h-44 w-full overflow-hidden rounded-xl bg-gray-100 border border-gray-100 flex items-center justify-center">
                      <img src={box.image} alt={box.title} className="h-full w-full object-cover transition-transform duration-300 hover:scale-105" />
                    </div>
                  ) : box.icon && box.icon !== "none" ? (
                    <Icon name={box.icon} size={26} className="mb-4.5 text-brand" />
                  ) : null}
                  <h4 className="mb-2.5 text-[17.5px] font-semibold leading-snug text-ink">{box.title}</h4>
                  <p className="text-sm leading-relaxed text-steel">{box.description}</p>
                  {box.linkLabel && box.linkHref && (
                    <Link
                      href={box.linkHref}
                      target={box.linkHref.startsWith("http") || box.linkHref.endsWith(".pdf") || box.linkHref.includes("/uploads/") ? "_blank" : undefined}
                      rel={box.linkHref.startsWith("http") || box.linkHref.endsWith(".pdf") || box.linkHref.includes("/uploads/") ? "noopener noreferrer" : undefined}
                      className="mt-3.5 inline-block text-[13.5px] font-medium text-brand hover:underline"
                    >
                      {box.linkLabel}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {section.symbolGrid && (
            <div className="mt-9 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
              {section.symbolGrid.map((sym) => (
                <div key={sym.title} className="flex items-start gap-3.5">
                  <Icon name={sym.icon} size={18} className="mt-0.5 flex-none text-brand" />
                  <div>
                    <h5 className="mb-1 text-[14.5px] font-semibold text-ink">{sym.title}</h5>
                    <p className="text-[13px] leading-relaxed text-steel">{sym.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {section.callout && (
            <div className="mt-7.5 max-w-[640px] border-l-[3px] border-brand bg-offwhite px-6.5 py-4.5">
              <p className="text-[14.5px] leading-relaxed text-steel">{section.callout.text}</p>
            </div>
          )}
        </Reveal>
      </Container>
    </section>
  );
}
