"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { stripHtmlTags } from "@/utils/sanitize";
import { Modal } from "@/components/ui/Modal";
import {
  AdminInput,
  AdminSelect,
  AdminRichTextEditor,
  useToast,
  toastMessages,
} from "@/components/admin/AdminComponents";
import { filterTranslationLanguages } from "@/components/admin/TranslationEditorUi";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  ExternalLink,
  Layers,
  Package,
  Tag,
  Globe,
  FileText,
  Search,
  Upload,
  X,
  Copy,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import TechnicalSpecificationsEditor, {
  TechnicalSpecification,
  normalizeTechnicalSpecifications,
} from "./translations/TechnicalSpecificationsEditor";
import WarrantyEditor, { normalizeWarranty } from "./translations/WarrantyEditor";
import PrimaryFeaturesEditor, {
  PrimaryFeature,
  normalizePrimaryFeatures,
} from "./translations/PrimaryFeaturesEditor";
import HighlightsEditor, {
  Highlight,
  normalizeHighlights,
} from "./translations/HighlightsEditor";

type CoverageGapType = "product" | "category" | "static" | "cms";
type CoveragePriority = "high" | "medium" | "low";
type CmsEntityType = "page" | "section" | "block" | "menuItem" | "footer";

type CoverageMissingField = {
  field: string;
  fieldLabel: string;
  englishValue: string;
};

type CoverageGap = {
  type: CoverageGapType;
  priority: CoveragePriority;
  priorityLabel: string;
  entityId: string;
  entityLabel: string;
  context?: string;
  cmsEntityType?: CmsEntityType;
  cmsPageId?: string;
  missingFields: CoverageMissingField[];
};

type CoverageBucketSummary = {
  gaps: number;
  fields: number;
  totalFields: number;
  completedFields: number;
  completionPercentage: number;
};

type CoverageResponse = {
  language: { id: string; name: string; code: string };
  summary: Record<CoverageGapType, CoverageBucketSummary>;
  gaps: {
    data: CoverageGap[];
    total: number;
    page: number;
    limit: number;
    skip: number;
    totalPages: number;
  };
};

type AdminLanguage = {
  id: string;
  name: string;
  code: string;
  isDefault?: boolean;
};

const CATEGORY_TABS: Array<{
  value: "all" | CoverageGapType;
  label: string;
  icon: typeof Layers;
}> = [
  { value: "all", label: "All Items", icon: Layers },
  { value: "product", label: "Products", icon: Package },
  { value: "category", label: "Categories", icon: Tag },
  { value: "static", label: "Website Labels", icon: Globe },
  { value: "cms", label: "CMS Pages", icon: FileText },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TYPE_LABELS: Record<CoverageGapType, string> = {
  product: "Product",
  category: "Category",
  static: "Website Label",
  cms: "CMS Page",
};

const SUB_TABS: Record<
  "all" | CoverageGapType,
  Array<{ value: string; label: string }>
> = {
  all: [
    { value: "all", label: "All Items" },
  ],
  product: [
    { value: "all", label: "All Products" },
    { value: "info", label: "Titles & Descriptions" },
    { value: "specs", label: "Specs & Features" },
    { value: "seo", label: "SEO Metadata" },
  ],
  category: [
    { value: "all", label: "All Categories" },
    { value: "names", label: "Category Names" },
    { value: "descriptions", label: "Descriptions" },
  ],
  static: [
    { value: "all", label: "All Labels" },
    { value: "nav", label: "Navigation & Menus" },
    { value: "product", label: "Product & Catalog" },
    { value: "cart", label: "Cart & Checkout" },
    { value: "account", label: "Account & Auth" },
    { value: "footer", label: "Footer & Legal" },
    { value: "general", label: "General & Buttons" },
  ],
  cms: [
    { value: "all", label: "All CMS" },
    { value: "page", label: "Page Headers & SEO" },
    { value: "section", label: "Sections & Content" },
    { value: "menu", label: "Navigation Menus" },
    { value: "footer", label: "Footer Blocks" },
  ],
};

const PRIORITY_FILTERS: Array<{
  value: "all" | CoveragePriority;
  label: string;
}> = [
  { value: "all", label: "All Priorities" },
  { value: "high", label: "Needs attention first" },
  { value: "medium", label: "Standard content" },
  { value: "low", label: "SEO & metadata" },
];

const PRIORITY_BADGE_CLASSES: Record<CoveragePriority, string> = {
  high: "border-red-200 bg-red-50 text-red-700",
  medium: "border-gray-200 bg-gray-50 text-[#555]",
  low: "border-amber-200 bg-amber-50 text-amber-800",
};

function getEditHref(gap: CoverageGap) {
  switch (gap.type) {
    case "product":
      return `/admin/products/${gap.entityId}/edit`;
    case "category":
      return "/admin/categories";
    case "static":
      return "/admin/translations";
    case "cms":
      if (gap.cmsEntityType === "footer") return "/admin/cms/footer";
      if (gap.cmsEntityType === "menuItem") return "/admin/cms/menus";
      if (gap.cmsPageId) return `/admin/cms/pages?pageId=${gap.cmsPageId}`;
      return `/admin/cms/pages?pageId=${gap.entityId}`;
    default:
      return "#";
  }
}

function getPaginationItems(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) items.push("ellipsis");

  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) {
    items.push(pageNumber);
  }

  if (end < totalPages - 1) items.push("ellipsis");

  items.push(totalPages);
  return items;
}

/** Common Center-aligned Translation Modal for clean, distraction-free editing */
function TranslationModal({
  gap,
  language,
  onClose,
  onSaved,
}: {
  gap: CoverageGap | null;
  language: AdminLanguage;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!gap) return;
    const initial: Record<string, unknown> = {};
    for (const field of gap.missingFields) {
      if (field.field === "technicalSpecs") {
        initial[field.field] = normalizeTechnicalSpecifications(field.englishValue);
      } else if (field.field === "warranty") {
        initial[field.field] = normalizeWarranty(field.englishValue);
      } else if (field.field === "primaryFeatures") {
        initial[field.field] = normalizePrimaryFeatures(field.englishValue);
      } else if (field.field === "highlights") {
        initial[field.field] = normalizeHighlights(field.englishValue);
      } else {
        initial[field.field] = "";
      }
    }
    setFormData(initial);
  }, [gap]);

  if (!gap) return null;

  const handleCopyEnglish = (field: CoverageMissingField) => {
    let copyText = field.englishValue;
    if (["technicalSpecs", "warranty", "primaryFeatures", "highlights"].includes(field.field)) {
      try {
        const parsed = JSON.parse(field.englishValue);
        copyText = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
      } catch {
        copyText = field.englishValue;
      }
    } else if (/<[a-z][\s\S]*>/i.test(field.englishValue)) {
      copyText = stripHtmlTags(field.englishValue);
    }
    navigator.clipboard.writeText(copyText);
    showToast("English text copied to clipboard.");
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      if (gap.type === "product") {
        const payload: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(formData)) {
          if (["technicalSpecs", "warranty", "primaryFeatures", "highlights"].includes(key)) {
            payload[key] = value;
          } else {
            payload[key] = typeof value === "string" ? value.trim() : value;
          }
        }
        await adminApi.put(`/translations/products/${gap.entityId}/${language.id}`, payload);
      } else if (gap.type === "category") {
        await adminApi.put(`/translations/categories/${gap.entityId}/${language.id}`, formData);
      } else if (gap.type === "static") {
        for (const [key, value] of Object.entries(formData)) {
          await adminApi.put("/translations/keywords", {
            key,
            languageId: language.id,
            value: typeof value === "string" ? value.trim() : String(value ?? ""),
          });
        }
      } else if (gap.type === "cms") {
        for (const [key, value] of Object.entries(formData)) {
          const cmsKey = `cms.${gap.cmsEntityType || "page"}.${gap.entityId}.${key}`;
          await adminApi.put("/translations/keywords", {
            key: cmsKey,
            languageId: language.id,
            value: typeof value === "string" ? value.trim() : String(value ?? ""),
          });
        }
      }

      showToast("Translations saved successfully!");
      onSaved();
      onClose();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save translations."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={Boolean(gap)}
      onClose={onClose}
      size="3xl"
      title={
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-[#F4F4F4] border border-[#E0E0E0] px-2 py-0.5 text-[11px] font-semibold text-[#555] uppercase">
              {TYPE_LABELS[gap.type]}
            </span>
            <span className="rounded-md bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              Translating to {language.name} ({language.code.toUpperCase()})
            </span>
          </div>
          <h3 className="text-[17px] font-bold text-[#1A1A1A] truncate">{gap.entityLabel}</h3>
        </div>
      }
      onSave={handleSaveAll}
      saveText="Save All Translations"
      cancelText="Cancel"
      isSaving={isSaving}
      bodyClassName="p-6 space-y-6"
    >
      <div className="rounded-lg bg-blue-50/60 border border-blue-100 p-3 text-[12.5px] text-blue-800 leading-relaxed">
        ℹ️ Enter the translated text below for each missing field. The original English values are displayed for reference.
      </div>

      {gap.missingFields.map((field) => {
        const hasHtml = /<[a-z][\s\S]*>/i.test(field.englishValue);
        const isLong =
          field.englishValue.length > 80 ||
          field.field === "description" ||
          field.field === "seoDescription";

        return (
          <div key={field.field} className="rounded-xl border border-[#E6E6E6] bg-white p-4.5 space-y-3 shadow-2xs">
            {/* Field Header */}
            <div className="flex items-center justify-between">
              <span className="text-[13.5px] font-bold text-[#1A1A1A]">{field.fieldLabel}</span>
              <button
                type="button"
                onClick={() => handleCopyEnglish(field)}
                className="flex items-center gap-1 text-[11.5px] font-medium text-[#666] hover:text-[#1A1A1A] hover:underline cursor-pointer"
              >
                <Copy size={12} /> Copy English
              </button>
            </div>

            {/* English Reference Box */}
            <div className="rounded-lg border border-[#ECECEC] bg-[#FAFAFA] p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#888]">
                Original English Content:
              </span>
              {hasHtml ? (
                <div
                  className="mt-1.5 max-h-48 overflow-y-auto rounded border border-[#E2E2E2] bg-white p-3 text-[12.5px] leading-relaxed text-[#222] select-text prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline"
                  dangerouslySetInnerHTML={{ __html: field.englishValue }}
                />
              ) : (
                <p className="mt-1 text-[12.5px] text-[#333] font-medium leading-relaxed select-text break-words max-h-40 overflow-y-auto">
                  {field.englishValue || <em className="text-[#AAA]">Empty in English</em>}
                </p>
              )}
            </div>

            {/* Editor Component for Field */}
            <div className="pt-1">
              <label className="block text-[11.5px] font-semibold text-[#444] mb-1.5">
                {language.name} Translation:
              </label>

              {field.field === "technicalSpecs" ? (
                <TechnicalSpecificationsEditor
                  value={formData[field.field]}
                  onChange={(specs) => setFormData((prev) => ({ ...prev, [field.field]: specs }))}
                />
              ) : field.field === "warranty" ? (
                <WarrantyEditor
                  value={formData[field.field] as string[]}
                  onChange={(lines) => setFormData((prev) => ({ ...prev, [field.field]: lines }))}
                />
              ) : field.field === "primaryFeatures" ? (
                <PrimaryFeaturesEditor
                  value={formData[field.field] as PrimaryFeature[]}
                  onChange={(features) => setFormData((prev) => ({ ...prev, [field.field]: features }))}
                />
              ) : field.field === "highlights" ? (
                <HighlightsEditor
                  value={formData[field.field] as Highlight[]}
                  onChange={(hls) => setFormData((prev) => ({ ...prev, [field.field]: hls }))}
                />
              ) : field.field === "description" ? (
                <AdminRichTextEditor
                  value={String(formData[field.field] ?? "")}
                  onChange={(val) => setFormData((prev) => ({ ...prev, [field.field]: val }))}
                  placeholder={`Enter ${language.name} description...`}
                  compact
                />
              ) : isLong ? (
                <textarea
                  rows={4}
                  value={String(formData[field.field] ?? "")}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.field]: e.target.value }))}
                  placeholder={`Enter ${language.name} ${field.fieldLabel.toLowerCase()}...`}
                  className="w-full rounded-lg border border-[#DCDCDC] p-3 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                />
              ) : (
                <input
                  type="text"
                  value={String(formData[field.field] ?? "")}
                  onChange={(e) => setFormData((prev) => ({ ...prev, [field.field]: e.target.value }))}
                  placeholder={`Enter ${language.name} ${field.fieldLabel.toLowerCase()}...`}
                  className="h-10 w-full rounded-lg border border-[#DCDCDC] px-3 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                />
              )}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

export function TranslationCoverageHub({
  languages = [],
  canUpdate = false,
  canDelete = false,
  canCreate = false,
}: {
  languages?: AdminLanguage[];
  canUpdate?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
}) {
  const targetLanguages = filterTranslationLanguages(languages);
  const [selectedLanguageId, setSelectedLanguageId] = useState<string>("");

  useEffect(() => {
    if (targetLanguages.length > 0 && !selectedLanguageId) {
      setSelectedLanguageId(targetLanguages[0].id);
    }
  }, [targetLanguages, selectedLanguageId]);

  const [typeFilter, setTypeFilter] = useState<"all" | CoverageGapType>("all");
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | CoveragePriority>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [activeDrawerGap, setActiveDrawerGap] = useState<CoverageGap | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const currentLanguage =
    targetLanguages.find((l) => l.id === selectedLanguageId) || targetLanguages[0];

  const { data, isLoading, refetch } = useQuery<CoverageResponse>({
    queryKey: [
      "translation-coverage",
      selectedLanguageId,
      typeFilter,
      sectionFilter,
      priorityFilter,
      page,
      pageSize,
      deferredSearch,
    ],
    queryFn: async () => {
      const response = await adminApi.get("/translations/coverage", {
        params: {
          languageId: selectedLanguageId,
          type: typeFilter,
          section: sectionFilter !== "all" ? sectionFilter : undefined,
          priority: priorityFilter,
          page,
          limit: pageSize,
          search: deferredSearch,
        },
      });
      return response.data.data as CoverageResponse;
    },
    enabled: !!selectedLanguageId,
  });

  const handleExportCsv = async () => {
    if (!selectedLanguageId) return;
    try {
      const response = await adminApi.get("/translations/coverage/export", {
        params: {
          languageId: selectedLanguageId,
          type: typeFilter !== "all" ? typeFilter : undefined,
          section: sectionFilter !== "all" ? sectionFilter : undefined,
          priority: priorityFilter !== "all" ? priorityFilter : undefined,
          search: deferredSearch || undefined,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `translations-${currentLanguage?.code || "export"}-${Date.now()}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast("Translation CSV downloaded.");
    } catch {
      showToast("Failed to export CSV.", "error");
    }
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedLanguageId) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await adminApi.post("/translations/coverage/import", formData, {
        params: { languageId: selectedLanguageId },
        headers: { "Content-Type": "multipart/form-data" },
      });

      showToast(res.data.message || "CSV imported successfully!");
      refetch();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to import CSV."), "error");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (targetLanguages.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[#DDD] bg-white p-12 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#E31E24]">
          <Layers size={24} />
        </div>
        <h3 className="text-[15px] font-bold text-[#1A1A1A]">No Translation Languages Configured</h3>
        <p className="mt-1 text-[13px] text-[#666] max-w-md mx-auto">
          Your store is currently running on English. To track missing translations and export/import spreadsheets, add a target language in the <strong>Languages & Protected Words</strong> tab.
        </p>
      </div>
    );
  }

  const summary = data?.summary;
  const totalMissingCount = summary ? Object.values(summary).reduce((sum, b) => sum + b.fields, 0) : 0;
  const totalFieldsCount = summary ? Object.values(summary).reduce((sum, b) => sum + b.totalFields, 0) : 0;
  const totalCompletedCount = summary ? Object.values(summary).reduce((sum, b) => sum + b.completedFields, 0) : 0;
  const overallPercentage = totalFieldsCount > 0 ? Math.round((totalCompletedCount / totalFieldsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Header Card: Language Selector & Overall Progress */}
      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="text-[13px] font-semibold text-[#1A1A1A] whitespace-nowrap">
              Target Language:
            </label>
            <div className="w-full sm:w-[260px]">
              <AdminSelect
                value={selectedLanguageId}
                onChange={(e) => {
                  setSelectedLanguageId(e.target.value);
                  setPage(1);
                }}
                options={targetLanguages.map((l) => ({
                  value: l.id,
                  label: `${l.name} (${l.code.toUpperCase()})`,
                }))}
              />
            </div>
            <span className="text-[12.5px] text-[#666]">
              Tracking multilingual gaps for <strong>{currentLanguage?.name}</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-lg border border-[#ECECEC] bg-[#FAFAFA] px-4 py-2 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#888]">Overall Progress</span>
              <p className="text-[16px] font-bold text-[#1A1A1A]">{overallPercentage}%</p>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Missing Fields</span>
              <p className="text-[16px] font-bold text-red-700">{totalMissingCount}</p>
            </div>
          </div>
        </div>

        {/* Simplified Unified Category Tabs */}
        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#F0F0F0] pt-4">
          {CATEGORY_TABS.map((tab) => {
            const isSelected = typeFilter === tab.value;
            const Icon = tab.icon;
            const missingCount =
              tab.value === "all"
                ? totalMissingCount
                : summary?.[tab.value]?.fields ?? 0;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => {
                  setTypeFilter(tab.value);
                  setSectionFilter("all");
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 rounded-xl border px-4 py-2 text-left transition-all cursor-pointer",
                  isSelected
                    ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs font-semibold"
                    : "border-[#E8E8E8] bg-white text-[#444] hover:border-[#CCC] hover:bg-[#F9FAFB] font-medium",
                )}
              >
                <Icon size={15} className={isSelected ? "text-white" : "text-[#777]"} />
                <span className="text-[13px]">{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-bold",
                    isSelected
                      ? "bg-white/20 text-white"
                      : missingCount > 0
                        ? "bg-red-50 text-red-700 border border-red-200"
                        : "bg-green-50 text-green-700 border border-green-200",
                  )}
                >
                  {missingCount}
                </span>
              </button>
            );
          })}
        </div>

        {/* Sub-Tabs Dividing the Active Category */}
        {SUB_TABS[typeFilter] && SUB_TABS[typeFilter].length > 1 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 border-t border-[#F0F0F0] pt-3">
            <span className="text-[11.5px] font-semibold text-[#888] mr-1.5">Sub-section:</span>
            {SUB_TABS[typeFilter].map((st) => (
              <button
                key={st.value}
                type="button"
                onClick={() => {
                  setSectionFilter(st.value);
                  setPage(1);
                }}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-[12px] font-medium transition cursor-pointer",
                  sectionFilter === st.value
                    ? "border border-[#1A1A1A] bg-[#1A1A1A] text-white font-semibold shadow-2xs"
                    : "border border-[#E8E8E8] bg-[#FAFAFA] text-[#555] hover:border-[#CCC] hover:bg-white hover:text-[#1A1A1A]",
                )}
              >
                {st.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Search & Actions Toolbar */}
      <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative flex-1 lg:max-w-[380px]">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, English text, or key..."
              className="h-9.5 w-full rounded-lg border border-[#E6E6E6] bg-white pl-9 pr-9 text-[13px] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9A9A9A] hover:bg-[#F0F0F0]"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter Pills */}
            <div className="flex flex-wrap items-center gap-1">
              <span className="text-[11.5px] font-semibold text-[#888] mr-1 hidden sm:inline">Priority:</span>
              {PRIORITY_FILTERS.map((pf) => (
                <button
                  key={pf.value}
                  type="button"
                  onClick={() => {
                    setPriorityFilter(pf.value);
                    setPage(1);
                  }}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition cursor-pointer",
                    priorityFilter === pf.value
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-white font-semibold"
                      : "border-[#E6E6E6] bg-white text-[#666] hover:border-[#CCC]",
                  )}
                >
                  {pf.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-[#E6E6E6] mx-1 hidden xl:block" />

            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F7F7F7] shadow-2xs transition cursor-pointer"
            >
              <Download size={13} /> Export CSV
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#B5151B] shadow-2xs transition cursor-pointer"
            >
              <Upload size={13} /> Import CSV
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleImportCsv}
            />

            <label className="flex h-8.5 items-center gap-1 rounded-lg border border-[#E6E6E6] bg-white px-2.5 text-[11.5px] text-[#666]">
              Show
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent font-semibold text-[#1A1A1A] outline-none cursor-pointer"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      {/* Gap Cards List */}
      {isLoading ? (
        <div className="rounded-xl border border-[#E6E6E6] bg-white py-16 text-center text-[13px] text-[#888]">
          Loading translation coverage data...
        </div>
      ) : data && data.gaps.data.length > 0 ? (
        <div className="space-y-3">
          {data.gaps.data.map((gap) => {
            const rowKey = `${gap.type}:${gap.entityId}`;
            const editHref = getEditHref(gap);
            const firstSnippet = gap.missingFields.find((f) => f.englishValue)?.englishValue;
            const cleanSnippet = firstSnippet ? stripHtmlTags(firstSnippet) : null;

            return (
              <div
                key={rowKey}
                className="flex flex-col gap-3 rounded-xl border border-[#E6E6E6] bg-white p-4 transition-all hover:border-[#D0D0D0] sm:flex-row sm:items-center sm:justify-between shadow-2xs"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-[#E0E0E0] bg-[#F7F7F7] px-2 py-0.5 text-[11px] font-semibold text-[#555] uppercase">
                      {TYPE_LABELS[gap.type]}
                    </span>
                    <span className={cn("rounded-md border px-2 py-0.5 text-[11px] font-semibold", PRIORITY_BADGE_CLASSES[gap.priority])}>
                      {gap.priorityLabel}
                    </span>
                    <h4 className="text-[14px] font-bold text-[#1A1A1A] truncate">{gap.entityLabel}</h4>
                  </div>

                  {cleanSnippet && cleanSnippet !== gap.entityLabel && (
                    <p className="text-[12.5px] text-[#555] line-clamp-1 italic bg-[#F9FAFB] px-2.5 py-1 rounded border border-[#EBEBEB]">
                      <span className="font-semibold text-[#888] not-italic mr-1.5">Original (EN):</span>
                      {cleanSnippet}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-[#666]">
                    <span className="font-semibold text-[#888]">Missing ({gap.missingFields.length}):</span>
                    {gap.missingFields.map((f, i) => (
                      <span key={f.field} className="rounded-md bg-[#F4F4F4] px-2 py-0.5 text-[11.5px] font-medium text-[#444]">
                        {f.fieldLabel}
                        {i < gap.missingFields.length - 1 ? "" : ""}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={editHref}
                    target="_blank"
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-[12px] font-medium text-[#555] hover:bg-[#F5F5F5] transition"
                  >
                    Open Page <ExternalLink size={11} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => setActiveDrawerGap(gap)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition shadow-2xs cursor-pointer"
                  >
                    <span>Translate</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {data.gaps.totalPages > 1 && (
            <div className="flex flex-col gap-3 rounded-xl border border-[#E6E6E6] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[12.5px] text-[#6B6B6B]">
                Showing page {data.gaps.page} of {data.gaps.totalPages} ({data.gaps.total} total items)
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:border-[#CCC] disabled:opacity-40"
                >
                  Previous
                </button>
                {getPaginationItems(data.gaps.page, data.gaps.totalPages).map((item, idx) =>
                  item === "ellipsis" ? (
                    <span key={`ellipsis-${idx}`} className="px-2 text-[12px] text-[#999]">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPage(item)}
                      className={cn(
                        "h-8 min-w-8 rounded-md border px-2 text-[12px] font-semibold transition",
                        item === data.gaps.page
                          ? "border-[#E31E24] bg-[#E31E24] text-white"
                          : "border-[#E6E6E6] bg-white text-[#666] hover:border-[#CCC]",
                      )}
                    >
                      {item}
                    </button>
                  ),
                )}
                <button
                  type="button"
                  disabled={page >= data.gaps.totalPages}
                  onClick={() => setPage((p) => Math.min(data.gaps.totalPages, p + 1))}
                  className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] transition hover:border-[#CCC] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#DDD] bg-white py-14 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
            <Check size={20} />
          </div>
          <h4 className="text-[14px] font-bold text-[#1A1A1A]">100% Translated!</h4>
          <p className="mt-1 text-[12.5px] text-[#777]">
            All {typeFilter !== "all" ? typeFilter : ""} items are translated for {currentLanguage?.name}.
          </p>
        </div>
      )}

      {/* Common Translation Modal */}
      {activeDrawerGap && currentLanguage && (
        <TranslationModal
          gap={activeDrawerGap}
          language={currentLanguage}
          onClose={() => setActiveDrawerGap(null)}
          onSaved={() => refetch()}
        />
      )}
    </div>
  );
}
