"use client";

import React, { useState, useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { FaqItem } from "@/types/common.types";

export interface AccordionItemData {
  id?: string;
  title: React.ReactNode;
  content: React.ReactNode;
  badge?: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItemData[];
  allowMultiple?: boolean;
  defaultOpenIndex?: number | number[] | null;
  variant?: "default" | "card" | "bordered" | "clean";
  className?: string;
  itemClassName?: string;
  headerClassName?: string;
  contentClassName?: string;
}

export function Accordion({
  items,
  allowMultiple = false,
  defaultOpenIndex = null,
  variant = "default",
  className = "",
  itemClassName = "",
  headerClassName = "",
  contentClassName = "",
}: AccordionProps) {
  const baseId = useId();
  const [openIndexes, setOpenIndexes] = useState<number[]>(() => {
    if (defaultOpenIndex === null || defaultOpenIndex === undefined) return [];
    return Array.isArray(defaultOpenIndex) ? defaultOpenIndex : [defaultOpenIndex];
  });

  if (!items || items.length === 0) return null;

  const toggle = (index: number) => {
    if (allowMultiple) {
      setOpenIndexes((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
      );
    } else {
      setOpenIndexes((prev) => (prev.includes(index) ? [] : [index]));
    }
  };

  const getVariantItemWrapperClass = (isOpen: boolean) => {
    switch (variant) {
      case "card":
        return "overflow-hidden rounded-2xl border border-line bg-white shadow-xs transition-shadow hover:shadow-sm";
      case "bordered":
        return "border border-line rounded-xl overflow-hidden bg-white mb-3";
      case "clean":
        return "border-b border-line";
      case "default":
      default:
        return "border-b border-line";
    }
  };

  const getContainerClass = () => {
    switch (variant) {
      case "card":
        return "space-y-3";
      case "bordered":
        return "space-y-3";
      case "clean":
        return "divide-y divide-line";
      case "default":
      default:
        return "divide-y divide-line border-t border-line";
    }
  };

  return (
    <div className={cn(getContainerClass(), className)}>
      {items.map((item, index) => {
        const isOpen = openIndexes.includes(index);
        const headerId = `${baseId}-header-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            key={item.id || `acc-item-${index}`}
            className={cn(getVariantItemWrapperClass(isOpen), itemClassName)}
          >
            <button
              type="button"
              id={headerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              disabled={item.disabled}
              onClick={() => toggle(index)}
              className={cn(
                "flex w-full items-center justify-between gap-4 text-left transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-brand/40",
                variant === "card"
                  ? isOpen
                    ? "px-4 pt-4 pb-3 sm:px-5 sm:pt-4.5 sm:pb-3.5"
                    : "px-4 py-4 sm:px-5 sm:py-4.5"
                  : isOpen
                    ? "pt-4.5 pb-2 sm:pt-5 sm:pb-2 hover:text-brand"
                    : "py-4.5 sm:py-5 hover:text-brand",
                headerClassName
              )}
            >
              <div className="flex min-w-0 items-center gap-3">
                {item.badge}
                <span
                  className={cn(
                    "text-[15px] sm:text-[16.5px] font-medium leading-snug tracking-tight text-ink transition-colors",
                    isOpen && "text-brand"
                  )}
                >
                  {item.title}
                </span>
              </div>
              <ChevronDown
                size={18}
                className={cn(
                  "shrink-0 text-steel transition-transform duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]",
                  isOpen && "rotate-180 text-brand"
                )}
              />
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={panelId}
                  role="region"
                  aria-labelledby={headerId}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{
                    height: { duration: 0.35, ease: [0.25, 1, 0.5, 1] },
                    opacity: { duration: 0.25, ease: "easeOut" },
                  }}
                  className="overflow-hidden"
                >
                  <div
                    className={cn(
                      variant === "card"
                        ? "px-4 pb-5 pt-3 sm:px-5 border-t border-line/60"
                        : "pb-5 pt-0 text-[14.5px] leading-relaxed text-steel",
                      contentClassName
                    )}
                  >
                    {item.content}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function isHtmlString(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export interface FaqAccordionProps {
  items: FaqItem[];
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  asSection?: boolean;
  allowMultiple?: boolean;
  defaultOpenIndex?: number | number[] | null;
  className?: string;
  itemClassName?: string;
  variant?: "default" | "card" | "bordered" | "clean";
}

export function FaqAccordion({
  items,
  title,
  subtitle,
  asSection = true,
  allowMultiple = false,
  defaultOpenIndex = null,
  className = "",
  itemClassName = "",
  variant = "default",
}: FaqAccordionProps) {
  const { t } = useStaticTranslations();

  if (!items || items.length === 0) {
    return null;
  }

  const accordionItems: AccordionItemData[] = items.map((item, idx) => {
    const hasHtml = typeof item.answer === "string" && isHtmlString(item.answer);
    return {
      id: item.id || `faq-${idx}`,
      title: item.question,
      content: hasHtml ? (
        <div
          dangerouslySetInnerHTML={{ __html: item.answer }}
          className="max-w-[850px] leading-relaxed text-steel [&_a]:text-brand [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_strong]:text-ink"
        />
      ) : (
        <p className="max-w-[850px] leading-relaxed text-steel">{item.answer}</p>
      ),
    };
  });

  const content = (
    <Reveal>
      {title !== null && (
        <h2 className="mb-2 text-[clamp(24px,2.6vw,32px)] font-normal text-ink leading-none">
          {title ?? t("ui.common.faqsTitle")}
        </h2>
      )}
      {subtitle && <p className="mb-4 text-[14.5px] text-steel">{subtitle}</p>}
      <Accordion
        items={accordionItems}
        allowMultiple={allowMultiple}
        defaultOpenIndex={defaultOpenIndex}
        variant={variant}
        className={cn("mt-2", className)}
        itemClassName={itemClassName}
      />
    </Reveal>
  );

  if (!asSection) {
    return content;
  }

  return (
    <section id="faqs" className="scroll-mt-20 xl:scroll-mt-36 py-6 lg:py-[34px]">
      <Container>{content}</Container>
    </section>
  );
}
