"use client";

import { useState, useEffect, useMemo, type DragEvent } from "react";
import Link from "next/link";
import { ExternalLink, Info, RotateCcw } from "lucide-react";
import { CmsSectionCard } from "./CmsSectionCard";
import { CmsHeroForm, type CmsHeroValues } from "./CmsHeroForm";
import { CmsRichTextSectionForm, type CmsRichTextSectionValues } from "./CmsRichTextSectionForm";
import { CmsCardRepeater, type CmsCardsValues } from "./CmsCardRepeater";
import { CmsSymbolRepeater, type CmsSymbolsValues } from "./CmsSymbolRepeater";
import { CmsFaqRepeater, type CmsFaqsValues } from "./CmsFaqRepeater";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import { AdminStickySaveBar } from "@/components/admin/AdminStickySaveBar";
import { useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";
import { getDetailPageConfig, type DetailPageConfig, type DetailPageSectionDef } from "@/config/detailPageConfigs";

type Block = {
  id: string;
  blockType: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
  dataJson?: unknown;
};

type Section = {
  id: string;
  sectionKey: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  status: string;
  sortOrder: number;
  settingsJson?: unknown;
  blocks: Block[];
};

type Page = {
  id: string;
  title: string;
  slug: string;
  pageKey: string;
  status: string;
  sections: Section[];
};

interface DetailPageEditorProps {
  page: Page;
  onSaved: () => void;
  config?: DetailPageConfig;
}

export function DetailPageEditor({ page, onSaved, config: propConfig }: DetailPageEditorProps) {
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const config = useMemo(() => {
    return propConfig || getDetailPageConfig(page.pageKey);
  }, [propConfig, page.pageKey]);

  // Drag & drop state for sections
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  // Hero section
  const heroSectionKey = `${page.pageKey}.hero`;
  const heroSection = page.sections.find((s) => s.sectionKey === heroSectionKey || s.sectionKey.endsWith(".hero"));

  // Ordered content section keys based strictly on database sortOrder
  const initialOrder = useMemo(() => {
    if (!config) return [];
    const validSectionKeys = new Set(config.sections.map((s) => s.sectionKey));
    const sortedFromDb = [...page.sections]
      .filter((s) => validSectionKeys.has(s.sectionKey) && !s.sectionKey.endsWith(".hero"))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      .map((s) => s.sectionKey);

    // Append any config sections not yet in DB
    const missingKeys = config.sections
      .map((s) => s.sectionKey)
      .filter((k) => !sortedFromDb.includes(k));

    return [...sortedFromDb, ...missingKeys];
  }, [config, page.sections]);

  const [orderedKeys, setOrderedKeys] = useState<string[]>(initialOrder);

  // ── Hero State ──────────────────────────────────────────────────────────
  const [heroValues, setHeroValues] = useState<CmsHeroValues>(() => {
    const heroBlock = heroSection?.blocks[0];
    return {
      kicker: heroBlock?.subtitle || config?.defaultHero.kicker || page.title,
      title: heroBlock?.title || config?.defaultHero.title || page.title,
      description: heroBlock?.description || config?.defaultHero.description || "",
      image: heroBlock?.image || config?.defaultHero.image || "",
    };
  });

  // ── Dynamic Sections State Map ──────────────────────────────────────────
  const [sectionStates, setSectionStates] = useState<
    Record<
      string,
      {
        enabled: boolean;
        richText?: CmsRichTextSectionValues;
        cards?: CmsCardsValues;
        symbols?: CmsSymbolsValues;
        faqs?: CmsFaqsValues;
        callout?: string;
      }
    >
  >(() => {
    const states: Record<string, any> = {};
    if (!config) return states;

    for (const secDef of config.sections) {
      const dbSec = page.sections.find((s) => s.sectionKey === secDef.sectionKey);
      const isEnabled = (dbSec?.status || "ACTIVE") === "ACTIVE";

      switch (secDef.type) {
        case "rich_text": {
          const b0 = dbSec?.blocks[0];
          const b1 = dbSec?.blocks[1];
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            richText: {
              heading: b0?.title || dbSec?.title || secDef.title,
              paragraph1: b0?.description || "",
              paragraph2: b1?.description || "",
              linkLabel: b0?.linkLabel || "",
              linkUrl: b0?.linkUrl || "",
              image: b0?.image || "",
            },
          };
          break;
        }
        case "cards": {
          const introBlock = dbSec?.blocks.find((b) => b.blockType === "intro" || b.blockType === "rich_text");
          const cardBlocks = (dbSec?.blocks || []).filter(
            (b) => !["intro", "rich_text", "hero", "faq", "symbol"].includes(b.blockType)
          );
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            cards: {
              heading: dbSec?.title || introBlock?.title || secDef.title,
              introText: introBlock?.description || "",
              cards: cardBlocks.map((b) => ({
                id: b.id,
                icon: b.icon || secDef.cardConfig?.defaultIcon || "BadgeCheck",
                title: b.title || "",
                subtitle: b.subtitle || "",
                description: b.description || "",
                linkLabel: b.linkLabel || secDef.cardConfig?.linkLabelDefault || "",
                linkUrl: b.linkUrl || "",
              })),
            },
          };
          break;
        }
        case "symbols": {
          const introBlock = dbSec?.blocks.find((b) => b.blockType === "intro");
          const symbolBlocks = (dbSec?.blocks || []).filter((b) => b.blockType === "symbol");
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            symbols: {
              heading: introBlock?.title || dbSec?.title || secDef.title,
              introText:
                introBlock?.description ||
                "A quick reference for the most common symbols you'll find on Modern Orthodontics product labels and packaging.",
              symbols: symbolBlocks.map((b) => ({
                id: b.id,
                icon: b.icon || "Hash",
                title: b.title || "",
                description: b.description || "",
              })),
            },
          };
          break;
        }
        case "faqs": {
          const faqBlocks = (dbSec?.blocks || []).filter((b) => b.blockType === "faq");
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            faqs: {
              heading: dbSec?.title || "FAQs",
              items: faqBlocks.map((b) => ({
                id: b.id,
                question: b.title || "",
                answer: b.description || "",
              })),
            },
          };
          break;
        }
        case "rich_text_callout": {
          const b0 = dbSec?.blocks[0];
          const b1 = dbSec?.blocks[1];
          const settings = (dbSec?.settingsJson as Record<string, any>) || {};
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            richText: {
              heading: b0?.title || dbSec?.title || secDef.title,
              paragraph1: b0?.description || "",
              paragraph2: b1?.description || "",
            },
            callout: settings?.calloutText || secDef.calloutDefault || "",
          };
          break;
        }
      }
    }
    return states;
  });

  // Re-sync when page prop updates
  const resetToLoaded = () => {
    setOrderedKeys(initialOrder);

    const hBlock = heroSection?.blocks[0];
    setHeroValues({
      kicker: hBlock?.subtitle || config?.defaultHero.kicker || page.title,
      title: hBlock?.title || config?.defaultHero.title || page.title,
      description: hBlock?.description || config?.defaultHero.description || "",
      image: hBlock?.image || config?.defaultHero.image || "",
    });

    if (!config) return;
    const states: Record<string, any> = {};
    for (const secDef of config.sections) {
      const dbSec = page.sections.find((s) => s.sectionKey === secDef.sectionKey);
      const isEnabled = (dbSec?.status || "ACTIVE") === "ACTIVE";

      switch (secDef.type) {
        case "rich_text": {
          const b0 = dbSec?.blocks[0];
          const b1 = dbSec?.blocks[1];
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            richText: {
              heading: b0?.title || dbSec?.title || secDef.title,
              paragraph1: b0?.description || "",
              paragraph2: b1?.description || "",
              linkLabel: b0?.linkLabel || "",
              linkUrl: b0?.linkUrl || "",
              image: b0?.image || "",
            },
          };
          break;
        }
        case "cards": {
          const introBlock = dbSec?.blocks.find((b) => b.blockType === "intro" || b.blockType === "rich_text");
          const cardBlocks = (dbSec?.blocks || []).filter(
            (b) => !["intro", "rich_text", "hero", "faq", "symbol"].includes(b.blockType)
          );
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            cards: {
              heading: dbSec?.title || introBlock?.title || secDef.title,
              introText: introBlock?.description || "",
              cards: cardBlocks.map((b) => ({
                id: b.id,
                icon: b.icon || secDef.cardConfig?.defaultIcon || "BadgeCheck",
                title: b.title || "",
                subtitle: b.subtitle || "",
                description: b.description || "",
                linkLabel: b.linkLabel || secDef.cardConfig?.linkLabelDefault || "",
                linkUrl: b.linkUrl || "",
              })),
            },
          };
          break;
        }
        case "symbols": {
          const introBlock = dbSec?.blocks.find((b) => b.blockType === "intro");
          const symbolBlocks = (dbSec?.blocks || []).filter((b) => b.blockType === "symbol");
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            symbols: {
              heading: introBlock?.title || dbSec?.title || secDef.title,
              introText:
                introBlock?.description ||
                "A quick reference for the most common symbols you'll find on Modern Orthodontics product labels and packaging.",
              symbols: symbolBlocks.map((b) => ({
                id: b.id,
                icon: b.icon || "Hash",
                title: b.title || "",
                description: b.description || "",
              })),
            },
          };
          break;
        }
        case "faqs": {
          const faqBlocks = (dbSec?.blocks || []).filter((b) => b.blockType === "faq");
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            faqs: {
              heading: dbSec?.title || "FAQs",
              items: faqBlocks.map((b) => ({
                id: b.id,
                question: b.title || "",
                answer: b.description || "",
              })),
            },
          };
          break;
        }
        case "rich_text_callout": {
          const b0 = dbSec?.blocks[0];
          const b1 = dbSec?.blocks[1];
          const settings = (dbSec?.settingsJson as Record<string, any>) || {};
          states[secDef.sectionKey] = {
            enabled: isEnabled,
            richText: {
              heading: b0?.title || dbSec?.title || secDef.title,
              paragraph1: b0?.description || "",
              paragraph2: b1?.description || "",
            },
            callout: settings?.calloutText || secDef.calloutDefault || "",
          };
          break;
        }
      }
    }
    setSectionStates(states);
  };

  useEffect(() => {
    resetToLoaded();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, config]);

  // Section reordering helpers
  const moveSection = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) return;
    const fromIndex = orderedKeys.indexOf(fromKey);
    const toIndex = orderedKeys.indexOf(toKey);
    if (fromIndex < 0 || toIndex < 0) return;

    const next = [...orderedKeys];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedKeys(next);
  };

  const moveSectionByStep = (key: string, step: number) => {
    const fromIndex = orderedKeys.indexOf(key);
    const toIndex = fromIndex + step;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= orderedKeys.length) return;
    const next = [...orderedKeys];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setOrderedKeys(next);
  };

  const setSectionEnabled = (sectionKey: string, enabled: boolean) => {
    setSectionStates((prev) => ({
      ...prev,
      [sectionKey]: {
        ...prev[sectionKey],
        enabled,
      },
    }));
  };

  // Helper to sync blocks for a section cleanly
  const syncSectionBlocks = async (
    sectionId: string,
    existingBlocks: Block[],
    targetBlocks: Array<{
      id?: string;
      blockType: string;
      title?: string | null;
      subtitle?: string | null;
      description?: string | null;
      image?: string | null;
      icon?: string | null;
      linkLabel?: string | null;
      linkUrl?: string | null;
      sortOrder: number;
      dataJson?: object;
    }>
  ) => {
    const existingMap = new Map(existingBlocks.map((b) => [b.id, b]));
    const targetIds = new Set(targetBlocks.map((b) => b.id).filter(Boolean));

    // 1. Delete removed blocks
    for (const eb of existingBlocks) {
      if (!targetIds.has(eb.id)) {
        await adminApi.delete(`/cms/blocks/${eb.id}`);
      }
    }

    // 2. Update or create blocks
    for (const tb of targetBlocks) {
      const payload = {
        blockType: tb.blockType,
        title: tb.title ?? undefined,
        subtitle: tb.subtitle ?? undefined,
        description: tb.description ?? undefined,
        image: tb.image ?? undefined,
        icon: tb.icon ?? undefined,
        linkLabel: tb.linkLabel ?? undefined,
        linkUrl: tb.linkUrl ?? undefined,
        sortOrder: tb.sortOrder,
        status: "ACTIVE",
        dataJson: tb.dataJson ?? undefined,
      };

      if (tb.id && existingMap.has(tb.id)) {
        await adminApi.put(`/cms/blocks/${tb.id}`, payload);
      } else {
        await adminApi.post(`/cms/sections/${sectionId}/blocks`, payload);
      }
    }
  };

  // Helper to get or create section in DB
  const ensureSection = async (sectionKey: string, defaultTitle: string, sortOrder: number) => {
    let sec = page.sections.find((s) => s.sectionKey === sectionKey);
    if (!sec) {
      const res = await adminApi.post(`/cms/pages/${page.id}/sections`, {
        sectionKey,
        title: defaultTitle,
        sortOrder,
        status: "ACTIVE",
      });
      sec = res.data?.data || res.data;
    }
    return sec as Section;
  };

  const handleSave = async () => {
    if (!config) return;
    try {
      setIsSaving(true);

      // Section order map: Hero is 0, others follow orderedKeys
      const sectionOrderMap: Record<string, number> = {
        [heroSectionKey]: 0,
      };
      orderedKeys.forEach((key, idx) => {
        sectionOrderMap[key] = idx + 1;
      });

      // ── 1. Hero Section ────────────────────────────────────────────────
      const activeHeroSec = await ensureSection(heroSectionKey, `${config.title} Hero`, 0);
      if (activeHeroSec) {
        await adminApi.put(`/cms/sections/${activeHeroSec.id}`, {
          title: `${config.title} Hero`,
          status: "ACTIVE",
          sortOrder: 0,
        });
        await syncSectionBlocks(activeHeroSec.id, activeHeroSec.blocks || [], [
          {
            id: activeHeroSec.blocks?.[0]?.id,
            blockType: "hero",
            title: heroValues.title,
            subtitle: heroValues.kicker,
            description: heroValues.description,
            image: heroValues.image,
            sortOrder: 0,
          },
        ]);
      }

      // ── 2. Content Sections ────────────────────────────────────────────
      for (const secDef of config.sections) {
        const secState = sectionStates[secDef.sectionKey];
        if (!secState) continue;

        const dbSec = await ensureSection(
          secDef.sectionKey,
          secDef.title,
          sectionOrderMap[secDef.sectionKey] ?? 1
        );

        if (!dbSec) continue;

        const status = secState.enabled ? "ACTIVE" : "INACTIVE";
        const sortOrder = sectionOrderMap[secDef.sectionKey] ?? 1;

        switch (secDef.type) {
          case "rich_text": {
            const rt = secState.richText || { heading: secDef.title, paragraph1: "" };
            await adminApi.put(`/cms/sections/${dbSec.id}`, {
              title: rt.heading || secDef.title,
              status,
              sortOrder,
            });

            const blocks: Array<any> = [
              {
                id: dbSec.blocks?.[0]?.id,
                blockType: "rich_text",
                title: rt.heading,
                description: rt.paragraph1,
                linkLabel: rt.linkLabel?.trim() || null,
                linkUrl: rt.linkUrl?.trim() || null,
                image: rt.image?.trim() || null,
                sortOrder: 0,
              },
            ];

            if (rt.paragraph2?.trim()) {
              blocks.push({
                id: dbSec.blocks?.[1]?.id,
                blockType: "rich_text",
                title: null,
                description: rt.paragraph2,
                sortOrder: 1,
              });
            }

            await syncSectionBlocks(dbSec.id, dbSec.blocks || [], blocks);
            break;
          }

          case "cards": {
            const cd = secState.cards || { heading: secDef.title, cards: [] };
            await adminApi.put(`/cms/sections/${dbSec.id}`, {
              title: cd.heading || secDef.title,
              status,
              sortOrder,
            });

            const blocks: Array<any> = [];
            let currentOrder = 0;

            if (cd.introText?.trim()) {
              const existingIntro = dbSec.blocks?.find((b) => b.blockType === "intro");
              blocks.push({
                id: existingIntro?.id,
                blockType: "intro",
                title: cd.heading,
                description: cd.introText,
                sortOrder: currentOrder++,
              });
            }

            const itemLbl = (secDef.cardConfig?.itemLabel || "").toLowerCase();
            const blockType = itemLbl.includes("stat")
              ? "stat"
              : itemLbl.includes("cert")
              ? "certification"
              : itemLbl.includes("office")
              ? "office"
              : itemLbl === "benefit"
              ? "benefit"
              : itemLbl === "process step"
              ? "step"
              : "capability";

            cd.cards.forEach((c) => {
              blocks.push({
                id: c.id,
                blockType,
                icon: c.icon,
                title: c.title,
                subtitle: c.subtitle?.trim() || null,
                description: c.description,
                linkLabel: c.linkLabel?.trim() || null,
                linkUrl: c.linkUrl?.trim() || null,
                sortOrder: currentOrder++,
              });
            });

            await syncSectionBlocks(dbSec.id, dbSec.blocks || [], blocks);
            break;
          }

          case "symbols": {
            const sym = secState.symbols || { heading: secDef.title, introText: "", symbols: [] };
            await adminApi.put(`/cms/sections/${dbSec.id}`, {
              title: sym.heading || secDef.title,
              status,
              sortOrder,
            });

            const existingIntro = dbSec.blocks?.find((b) => b.blockType === "intro");
            const blocks: Array<any> = [
              {
                id: existingIntro?.id,
                blockType: "intro",
                title: sym.heading,
                description: sym.introText,
                sortOrder: 0,
              },
            ];

            sym.symbols.forEach((s, idx) => {
              blocks.push({
                id: s.id,
                blockType: "symbol",
                icon: s.icon,
                title: s.title,
                description: s.description,
                sortOrder: idx + 1,
              });
            });

            await syncSectionBlocks(dbSec.id, dbSec.blocks || [], blocks);
            break;
          }

          case "faqs": {
            const fq = secState.faqs || { heading: "FAQs", items: [] };
            await adminApi.put(`/cms/sections/${dbSec.id}`, {
              title: fq.heading || "FAQs",
              status,
              sortOrder,
            });

            const blocks = fq.items.map((item, idx) => ({
              id: item.id,
              blockType: "faq",
              title: item.question,
              description: item.answer,
              sortOrder: idx,
            }));

            await syncSectionBlocks(dbSec.id, dbSec.blocks || [], blocks);
            break;
          }

          case "rich_text_callout": {
            const rt = secState.richText || { heading: secDef.title, paragraph1: "" };
            await adminApi.put(`/cms/sections/${dbSec.id}`, {
              title: rt.heading || secDef.title,
              status,
              sortOrder,
              settingsJson: {
                calloutText: secState.callout || "",
              },
            });

            const blocks: Array<any> = [
              {
                id: dbSec.blocks?.[0]?.id,
                blockType: "rich_text",
                title: rt.heading,
                description: rt.paragraph1,
                sortOrder: 0,
              },
            ];

            if (rt.paragraph2?.trim()) {
              blocks.push({
                id: dbSec.blocks?.[1]?.id,
                blockType: "rich_text",
                title: null,
                description: rt.paragraph2,
                sortOrder: 1,
              });
            }

            await syncSectionBlocks(dbSec.id, dbSec.blocks || [], blocks);
            break;
          }
        }
      }

      // ── 3. Reorder All Sections ────────────────────────────────────────
      const allUpdatedSections = await adminApi.get(`/cms/pages/${page.id}`);
      const freshSections: Section[] = allUpdatedSections.data?.data?.sections || [];
      const heroSecObj = freshSections.find((s) => s.sectionKey === heroSectionKey || s.sectionKey.endsWith(".hero"));
      const orderedObjects = [
        heroSecObj,
        ...orderedKeys.map((k) => freshSections.find((s) => s.sectionKey === k)),
      ].filter(Boolean);

      const orderedIds = orderedObjects.map((s) => s!.id);
      if (orderedIds.length > 0) {
        await adminApi.put(`/cms/pages/${page.id}/sections/reorder`, { orderedIds });
      }

      showToast(`${config.title} page updated and published successfully!`, "success");
      onSaved();
    } catch (err) {
      console.error(`Failed to save ${config.title} CMS content:`, err);
      showToast("Failed to save changes. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  // Compute dirty state
  const currentStateJson = JSON.stringify({
    orderedKeys,
    heroValues,
    sectionStates,
  });

  const [initialStateJson, setInitialStateJson] = useState(currentStateJson);

  useEffect(() => {
    setInitialStateJson(currentStateJson);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const isDirty = currentStateJson !== initialStateJson;

  if (!config) {
    return (
      <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-8 text-center text-sm text-[#8B8B8B]">
        No detail page configuration found for &quot;{page.pageKey}&quot;.
      </div>
    );
  }

  // Render individual content section card
  const renderSectionCard = (key: string, index: number) => {
    const secDef = config.sections.find((s) => s.sectionKey === key);
    if (!secDef) return null;

    const secState = sectionStates[key] || { enabled: true };
    const sectionNumber = index + 2; // Hero is #1

    return (
      <CmsSectionCard
        key={key}
        number={sectionNumber}
        title={secDef.title}
        subtitle={secDef.subtitle}
        description={secDef.description}
        enabled={secState.enabled}
        onToggleEnabled={(en) => setSectionEnabled(key, en)}
        canReorder
        canMoveUp={index > 0}
        canMoveDown={index < orderedKeys.length - 1}
        onMoveUp={() => moveSectionByStep(key, -1)}
        onMoveDown={() => moveSectionByStep(key, 1)}
        isDraggable
        isDragging={draggingKey === key}
        isOver={overKey === key && draggingKey !== key}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", key);
          setDraggingKey(key);
        }}
        onDragEnd={() => {
          setDraggingKey(null);
          setOverKey(null);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (overKey !== key) setOverKey(key);
        }}
        onDrop={(e) => {
          e.preventDefault();
          const from = e.dataTransfer.getData("text/plain");
          if (from) moveSection(from, key);
          setDraggingKey(null);
          setOverKey(null);
        }}
      >
        {secDef.type === "rich_text" && secState.richText && (
          <CmsRichTextSectionForm
            values={secState.richText}
            onChange={(next) =>
              setSectionStates((prev) => ({
                ...prev,
                [key]: { ...prev[key], richText: next },
              }))
            }
            config={secDef.richTextConfig}
          />
        )}

        {secDef.type === "cards" && secState.cards && (
          <CmsCardRepeater
            values={secState.cards}
            onChange={(next) =>
              setSectionStates((prev) => ({
                ...prev,
                [key]: { ...prev[key], cards: next },
              }))
            }
            headingLabel="Section Heading"
            config={secDef.cardConfig}
          />
        )}

        {secDef.type === "symbols" && secState.symbols && (
          <CmsSymbolRepeater
            values={secState.symbols}
            onChange={(next) =>
              setSectionStates((prev) => ({
                ...prev,
                [key]: { ...prev[key], symbols: next },
              }))
            }
          />
        )}

        {secDef.type === "faqs" && secState.faqs && (
          <CmsFaqRepeater
            values={secState.faqs}
            onChange={(next) =>
              setSectionStates((prev) => ({
                ...prev,
                [key]: { ...prev[key], faqs: next },
              }))
            }
            showHeading
            headingLabel="FAQ Section Title"
          />
        )}

        {secDef.type === "rich_text_callout" && secState.richText && (
          <div className="space-y-4">
            <CmsRichTextSectionForm
              values={secState.richText}
              onChange={(next) =>
                setSectionStates((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], richText: next },
                }))
              }
              config={secDef.richTextConfig}
              headingLabel="Section Heading"
              paragraph1Label="Primary Paragraph"
              paragraph2Label="Secondary Paragraph"
            />
            <AdminTextarea
              label="Highlight Callout Box Text"
              placeholder="Enter highlighted quality inspection callout text..."
              rows={2}
              value={secState.callout || ""}
              onChange={(e) =>
                setSectionStates((prev) => ({
                  ...prev,
                  [key]: { ...prev[key], callout: e.target.value },
                }))
              }
            />
          </div>
        )}
      </CmsSectionCard>
    );
  };

  return (
    <div className="space-y-5 pb-16">
      {/* Sticky Save Bar */}
      <AdminStickySaveBar
        title={page.title || config.title}
        subtitle="Page Studio"
        saving={isSaving}
        isDirty={isDirty}
        onSave={handleSave}
        saveLabel="Save Changes"
        secondaryActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetToLoaded}
              disabled={!isDirty || isSaving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
            <Link
              href={config.slug ? `/${config.slug}` : "/"}
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <ExternalLink size={14} className="text-gray-500" />
              <span>View Live</span>
            </Link>
          </div>
        }
      />

      {/* Reordering Instructions Banner */}
      {orderedKeys.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-[13px] text-blue-900 leading-relaxed shadow-2xs">
          <Info size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <span>
            <strong>Section Layout:</strong> Drag cards using the handle icon (⠿) or use the <strong>▲ / ▼</strong> arrow buttons to rearrange sections. Click <strong>Save Changes</strong> on the sticky bar above to apply your layout and content edits to the live storefront.
          </span>
        </div>
      )}

      {/* Sections List */}
      <div className="space-y-3">
        {/* Section 1: Hero / Header */}
        <CmsSectionCard
          number={1}
          title={
            page.pageKey === "home"
              ? "Hero Slider Banner"
              : page.pageKey === "products"
              ? "Page Header Copy"
              : "Page Hero"
          }
          subtitle="#hero"
          description={
            page.pageKey === "home"
              ? "Homepage dynamic hero slider managed via the Banners module."
              : page.pageKey === "products"
              ? "Main catalog headline (H1) and introductory narrative text."
              : "Main title, lead narrative, and hero background visual."
          }
          isAlwaysActive
          defaultExpanded={page.pageKey !== "home"}
        >
          {page.pageKey === "home" ? (
            <div className="space-y-3">
              <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/80 p-4 text-[13px] text-blue-900 leading-relaxed">
                <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[14px] text-blue-950">Homepage Hero Slider is managed in the Banners module</p>
                  <p>
                    Hero slides, promotional images, headlines, and slide CTAs on the homepage are dynamically served by the <strong>Banners Module</strong> (Placement: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[12px]">HOMEPAGE_HERO</code>).
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/admin/banners"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs"
                    >
                      <span>Open Banners Module →</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : page.pageKey === "products" ? (
            <CmsHeroForm
              values={heroValues}
              onChange={setHeroValues}
              allowKicker={false}
              allowImage={false}
              titleLabel="Catalog Headline (H1, e.g. 'ALL PRODUCTS')"
              descriptionLabel="Introduction Narrative / Subtitle"
            />
          ) : page.pageKey === "about" ? (
            <div className="space-y-4">
              <CmsHeroForm
                values={heroValues}
                onChange={setHeroValues}
                allowImage={false}
                kickerLabel="Kicker / Subtitle"
                titleLabel="Hero Headline (H1)"
                descriptionLabel="Introduction Narrative"
              />
              <div className="space-y-1.5 pt-2 border-t border-gray-100">
                <label className="block text-[13px] font-medium text-[#1A1A1A]">Hero Banner Visual</label>
                <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/80 p-4 text-[13px] text-blue-900 leading-relaxed">
                  <Info size={20} className="text-blue-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-[14px] text-blue-950">About Us Hero Banner is managed in the Banners module</p>
                    <p>
                      Hero promotional imagery and visual media for the About Us page are dynamically served by the <strong>Banners Module</strong> (Placement: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[12px]">ABOUT_HERO</code>).
                    </p>
                    <div className="pt-2">
                      <Link
                        href="/admin/banners"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs"
                      >
                        <span>Open Banners Module →</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <CmsHeroForm
              values={heroValues}
              onChange={setHeroValues}
              allowImage={page.pageKey !== "contact"}
              kickerLabel="Kicker / Subtitle"
              titleLabel="Hero Headline (H1)"
              descriptionLabel="Introduction Narrative"
              imageLabel="Hero Background Image"
            />
          )}
        </CmsSectionCard>

        {page.pageKey === "products" && (
          <>
            {/* Section 2: Catalog & Inventory Management */}
            <CmsSectionCard
              number={2}
              title="Product Catalog, Filters & Inventory"
              subtitle="#catalog"
              description="Dynamic products, pricing, inventory, categories, and facet filters."
              isAlwaysActive
              defaultExpanded={false}
            >
              <div className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50/80 p-4 text-[13px] text-gray-800 leading-relaxed">
                <Info size={20} className="text-gray-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-[14px] text-gray-950">Product Catalog Management</p>
                  <p>
                    The product catalog, SKU variants, pricing tiers, inventory levels, category taxonomy, and faceted filters are managed dynamically through the dedicated <strong>Products & Catalog</strong> modules.
                  </p>
                  <div className="pt-2">
                    <Link
                      href="/admin/products"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs"
                    >
                      <span>Open Products Module →</span>
                    </Link>
                  </div>
                </div>
              </div>
            </CmsSectionCard>
          </>
        )}

        {/* Reorderable Content Sections */}
        {orderedKeys.map((key, idx) => renderSectionCard(key, idx))}
      </div>
    </div>
  );
}
