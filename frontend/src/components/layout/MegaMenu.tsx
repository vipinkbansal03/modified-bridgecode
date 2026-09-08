"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { NavMegaGroup } from "@/types/common.types";
import type { StaticMessageKey } from "@/i18n/staticMessages";

interface MegaMenuProps {
  open: boolean;
  groups: NavMegaGroup[];
}

const megaMenuLabelKeys: Record<string, StaticMessageKey> = {
  "Aesthetic Brackets": "ui.mega.aestheticBrackets",
  "Aesthetic Bracket": "ui.mega.aestheticBrackets",
  "Aesthetic Bracket1": "ui.mega.aestheticBrackets",
  "Aesthetic Brackets1": "ui.mega.aestheticBrackets",
  "Metal Brackets": "ui.mega.metalBrackets",
  "NiTi Wires": "ui.mega.nitiWires",
  "SS Wires": "ui.mega.ssWires",
  "Special Wires": "ui.mega.specialWires",
  "Molar Bands": "ui.mega.molarBands",
  "Molar Tubes": "ui.mega.molarTubes",
  Elastomerics: "ui.mega.elastomerics",
  "Tooth Color Wire": "ui.mega.toothColorWire",
  "Begg Appliances": "ui.mega.beggAppliances",
  "Miscellaneous Items": "ui.mega.miscellaneousItems",
  "Curio Mono-Crystalline Ceramic": "ui.mega.curioMonoCrystallineCeramic",
  "Purity-MS Metal Slot Ceramic": "ui.mega.purityMsMetalSlotCeramic",
  "Purity Ceramic": "ui.mega.purityCeramic",
  "d'art Mini Ceramic": "ui.mega.dartMiniCeramic",
  "Elegant Composite": "ui.mega.elegantComposite",
  "Sapphire True Twin": "ui.mega.sapphireTrueTwin",
  "Sapphire Plus Low-Profile": "ui.mega.sapphirePlusLowProfile",
  "At-Ease Self Ligating": "ui.mega.atEaseSelfLigating",
  "Micro-LP Mini": "ui.mega.microLpMini",
  "Sapphire Brackets (Bio-Progressive)": "ui.mega.sapphireBracketsBioProgressive",
  "Sapphire Brackets (Standard Edgewise)": "ui.mega.sapphireBracketsStandardEdgewise",
  "NiTi Super Elastic": "ui.mega.nitiSuperElastic",
  "NiTi Thermal": "ui.mega.nitiThermal",
  "NiTi RCS": "ui.mega.nitiRcs",
  "Spooled NiTi Wire": "ui.mega.spooledNitiWire",
  "NiTi Springs": "ui.mega.nitiSprings",
  "Acti-4S Stainless Steel Archwire": "ui.mega.acti4sStainlessSteelArchwire",
  "Ligature Wires": "ui.mega.ligatureWires",
  "Co-Axial Wire": "ui.mega.coAxialWire",
  "Fixed Retainer Wire": "ui.mega.fixedRetainerWire",
  "Posted SS Wire": "ui.mega.postedSsWire",
  "Beta Titanium": "ui.mega.betaTitanium",
  "Pre-Torqued Archwire": "ui.mega.preTorquedArchwire",
  "Three Force Arch Wire": "ui.mega.threeForceArchWire",
  "Plain Bands": "ui.mega.plainBands",
  "Pre-welded Bands": "ui.mega.preWeldedBands",
  "Elfin Bondable Molar Tube": "ui.mega.elfinBondableMolarTube",
  "Afix Bondable Molar Tube": "ui.mega.afixBondableMolarTube",
  "Elfin Weldable Molar Tube": "ui.mega.elfinWeldableMolarTube",
  "Elastic Ties": "ui.mega.elasticTies",
  "Elastomeric Chain": "ui.mega.elastomericChain",
  "Elastomeric Separators": "ui.mega.elastomericSeparators",
  "Elastomeric Thread": "ui.mega.elastomericThread",
  "Elastomeric Tissue Guard": "ui.mega.elastomericTissueGuard",
  "Archwire Sleeve": "ui.mega.archwireSleeve",
  "Micro-KOT NiTi": "ui.mega.microKotNiti",
  "Micro-KOT SS": "ui.mega.microKotSs",
  "Begg Brackets (Bondable)": "ui.mega.beggBracketsBondable",
  "Begg Brackets (Weldable)": "ui.mega.beggBracketsWeldable",
  "Begg Molar Tubes (Bondable)": "ui.mega.beggMolarTubesBondable",
  "Lock Pins": "ui.mega.lockPins",
  "Micro Implants": "ui.mega.microImplants",
  "Stainless Steel Lab Wire": "ui.mega.stainlessSteelLabWire",
  "Diamond Proximal Strips": "ui.mega.diamondProximalStrips",
  "Lip & Cheek Retractor": "ui.mega.lipCheekRetractor",
  "Hyrex RME Screw": "ui.mega.hyrexRmeScrew",
  "Base Former": "ui.mega.baseFormer",
};

const MODORTHO_COLUMN_ORDER: Record<string, number> = {
  // Column 1: Aesthetic Brackets, Metal Brackets, Molar Bands
  "aesthetic brackets": 0,
  "aesthetic bracket": 0,
  "aesthetic bracket1": 0,
  "aesthetic brackets1": 0,
  "metal brackets": 0,
  "metal bracket": 0,
  "molar bands": 0,
  "molar band": 0,

  // Column 2: NiTi Wires, SS Wires, Special Wires
  "niti wires": 1,
  "niti wire": 1,
  "ss wires": 1,
  "ss wire": 1,
  "special wires": 1,
  "special wire": 1,

  // Column 3: Molar Tubes, Elastomerics, Tooth Color Wire
  "molar tubes": 2,
  "molar tube": 2,
  "elastomerics": 2,
  "elastomeric": 2,
  "tooth color wire": 2,
  "tooth colour wire": 2,
  "tooth color wires": 2,

  // Column 4: Begg Appliances, Miscellaneous Items
  "begg appliances": 3,
  "begg appliance": 3,
  "begg": 3,
  "miscellaneous items": 3,
  "miscellaneous item": 3,
  "miscellaneous": 3,
  instruments: 3,
  accessories: 3,
};

function partitionInto4Columns(groups: NavMegaGroup[]): NavMegaGroup[][] {
  const columns: NavMegaGroup[][] = [[], [], [], []];
  const unassigned: NavMegaGroup[] = [];

  for (const group of groups) {
    const key = group.label.trim().toLowerCase();
    const colIndex = MODORTHO_COLUMN_ORDER[key];
    if (colIndex !== undefined) {
      columns[colIndex].push(group);
    } else {
      unassigned.push(group);
    }
  }

  // Intelligently distribute any extra/custom categories into the shortest column
  for (const group of unassigned) {
    let minCol = 0;
    let minWeight = Infinity;
    for (let c = 0; c < 4; c++) {
      const weight = columns[c].reduce((sum, g) => sum + g.children.length + 2, 0);
      if (weight < minWeight) {
        minWeight = weight;
        minCol = c;
      }
    }
    columns[minCol].push(group);
  }

  const filledCount = columns.filter((c) => c.length > 0).length;
  if (filledCount <= 1 && groups.length > 1) {
    const fallbackCols: NavMegaGroup[][] = [[], [], [], []];
    groups.forEach((g, idx) => {
      fallbackCols[idx % 4].push(g);
    });
    return fallbackCols;
  }

  return columns;
}

export function MegaMenu({ open, groups }: MegaMenuProps) {
  const { t } = useStaticTranslations();
  const label = (value: string) => {
    if (/^aesthetic\s*brackets?1?$/i.test(value.trim())) {
      const translated = t("ui.mega.aestheticBrackets");
      return translated || "Aesthetic Brackets";
    }
    const key = megaMenuLabelKeys[value];
    return key ? t(key) : value;
  };

  const columns = useMemo(() => partitionInto4Columns(groups), [groups]);

  if (!groups.length) return null;

  return (
    <AnimatePresence>
      <div className="fixed left-1/2 z-50 -translate-x-1/2">
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="w-[min(940px,calc(100vw-24px))] max-h-[min(430px,calc(100vh-160px))] overflow-y-auto rounded-lg border border-slate-200/90 bg-white p-3 shadow-[0_16px_45px_rgba(15,23,42,0.13)]"
          >
            <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:divide-x md:divide-slate-100">
              {columns.map((columnGroups, colIdx) => (
                <div
                  key={colIdx}
                  className={`flex flex-col space-y-2.5 ${colIdx > 0 ? "md:pl-3" : ""} ${colIdx < 3 ? "md:pr-1" : ""}`}
                >
                  {columnGroups.map((group) => (
                    <div key={group.label} className="group/cat">
                      <Link
                        href={group.href}
                        className="group/link flex items-center justify-between border-b border-slate-100 pb-0.5 pt-0.5 text-[12px] font-bold uppercase tracking-wider text-ink transition-colors hover:text-brand"
                      >
                        <span className="truncate">{label(group.label)}</span>
                        <ChevronRight className="h-3 w-3 shrink-0 text-brand opacity-0 transition-all group-hover/link:translate-x-0.5 group-hover/link:opacity-100" />
                      </Link>

                      <ul className="mt-0.5 space-y-[1px]">
                        {group.children.map((child) => (
                          <li key={child.label}>
                            <Link
                              href={child.href}
                              title={label(child.label)}
                              className="block truncate rounded px-1 py-[1.5px] text-[11.5px] leading-tight text-steel transition hover:bg-slate-50 hover:text-brand"
                            >
                              {label(child.label)}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
