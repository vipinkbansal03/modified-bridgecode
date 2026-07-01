"use client";

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

export function MegaMenu({ open, groups }: MegaMenuProps) {
  const { t } = useStaticTranslations();
  const label = (value: string) => {
    const key = megaMenuLabelKeys[value];
    return key ? t(key) : value;
  };

  if (!groups.length) return null;

  return (
    <AnimatePresence>
      <div className="fixed left-1/2 z-50 -translate-x-1/2">
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-[min(1120px,calc(100vw-48px))] rounded-md border border-line bg-white p-3.5 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
          >
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 xl:grid-cols-5">
              {groups.map((group) => (
                <div
                  key={group.label}
                  className="rounded-lg px-2.5 py-2 transition hover:bg-slate-50"
                >
                  <Link
                    href={group.href}
                    className="group flex items-center justify-between text-[12.5px] font-semibold text-ink hover:text-brand"
                  >
                    <span>{label(group.label)}</span>
                    <ChevronRight className="h-3.5 w-3.5 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                  </Link>

                  <ul className="mt-1.5 space-y-0">
                    {group.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          href={child.href}
                          className="block rounded-md px-1.5 py-0.5 text-[12.5px] leading-snug text-steel transition hover:bg-white hover:text-brand hover:shadow-sm"
                        >
                          {label(child.label)}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
