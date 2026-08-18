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
import {
  AdminSelect,
  useToast,
  toastMessages,
} from "@/components/admin/AdminComponents";
import {
  TranslationBlurField,
  TranslationBlurInput,
  filterTranslationLanguages,
} from "@/components/admin/TranslationEditorUi";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Download,
  ExternalLink,
  Languages,
  Search,
  Upload,
} from "lucide-react";
import TechnicalSpecificationsField from "./translations/fields/TechnicalSpecificationsField";
import WarrantyField from "./translations/WarrantyField";
import PrimaryFeaturesField from "./translations/fields/PrimaryFeaturesField";
import HighlightsField from "./translations/fields/HighlightsField";

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

const TYPE_FILTERS: Array<{ value: "all" | CoverageGapType; label: string }> = [
  { value: "all", label: "All" },
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "static", label: "Static UI" },
  { value: "cms", label: "CMS" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TYPE_LABELS: Record<CoverageGapType, string> = {
  product: "Product",
  category: "Category",
  static: "Static UI",
  cms: "CMS",
};

const PRIORITY_FILTERS: Array<{
  value: "all" | CoveragePriority;
  label: string;
}> = [
  { value: "all", label: "All priorities" },
  { value: "high", label: "Needs attention first" },
  { value: "medium", label: "Standard content" },
  { value: "low", label: "SEO / metadata" },
];

const PRIORITY_BADGE_CLASSES: Record<CoveragePriority, string> = {
  high: "border-[#FAD7D9] bg-[#FFF1F2] text-[#C9151B]",
  medium: "border-[#E7E7E7] bg-[#F8F8F8] text-[#5F5F5F]",
  low: "border-[#E9E1C8] bg-[#FFF9E8] text-[#8A6500]",
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

function totalMissing(summary: CoverageResponse["summary"]) {
  return Object.values(summary).reduce((sum, bucket) => sum + bucket.fields, 0);
}

function totalTranslatable(summary: CoverageResponse["summary"]) {
  return Object.values(summary).reduce(
    (sum, bucket) => sum + bucket.totalFields,
    0,
  );
}

function totalCompleted(summary: CoverageResponse["summary"]) {
  return Object.values(summary).reduce(
    (sum, bucket) => sum + bucket.completedFields,
    0,
  );
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

function SummaryCard({
  label,
  gaps,
  fields,
  totalFields,
  completedFields,
  completionPercentage,
  active,
  onClick,
}: {
  label: string;
  gaps: number;
  fields: number;
  totalFields: number;
  completedFields: number;
  completionPercentage: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        active
          ? "border-[#E31E24] bg-[#FFFBFB]"
          : "border-[#E6E6E6] bg-white hover:border-[#D8D8D8]",
      )}
    >
      <div className="text-[12px] font-medium uppercase tracking-wide text-[#9A9A9A]">
        {label}
      </div>
      <div className="mt-2 text-[24px] font-semibold text-[#1A1A1A]">
        {fields}
      </div>
      <div className="mt-1 text-[12px] text-[#6B6B6B]">
        {gaps === 0
          ? "All complete"
          : `${gaps} item${gaps === 1 ? "" : "s"} need attention`}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[11.5px] text-[#9A9A9A]">
          <span>{completionPercentage}% complete</span>
          <span>
            {completedFields}/{totalFields}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[#EEEEEE]">
          <div
            className="h-full rounded-full bg-[#E31E24]"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>
    </button>
  );
}

function GapSaveFields({
  gap,
  languageId,
  onSaved,
  canUpdate = false,
}: {
  gap: CoverageGap;
  languageId: string;
  onSaved: () => void;
  canUpdate?: boolean;
}) {
  const { showToast } = useToast();

  const saveProductField = async (field: string, value: string) => {
    await adminApi.put(`/translations/products/${gap.entityId}/${languageId}`, {
      [field]: value,
    });
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  const saveCategoryField = async (field: string, value: string) => {
    await adminApi.put(
      `/translations/categories/${gap.entityId}/${languageId}`,
      { [field]: value },
    );
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  const saveStaticField = async (value: string) => {
    await adminApi.put("/translations/keywords", {
      key: gap.entityId,
      languageId,
      value,
    });
    showToast(toastMessages.staticLabelSaved);
    onSaved();
  };

  const saveCmsField = async (field: string, value: string) => {
    if (!gap.cmsEntityType) return;
    await adminApi.put(
      `/cms/translations/${gap.cmsEntityType}/${gap.entityId}/${languageId}`,
      { [field]: value },
    );
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  return (
    <div className="space-y-3 border-t border-[#F0F0F0] pt-3">
      {gap.missingFields.map((missing) => {
        const isLong =
          missing.englishValue.length > 80 ||
          missing.field === "description" ||
          missing.field === "seoDescription";

        if (gap.type === "product" && missing.field === "technicalSpecs") {
          const parsedSpecs = (() => {
            try {
              return JSON.parse(missing.englishValue);
            } catch {
              return [];
            }
          })();

          return (
            <TechnicalSpecificationsField
              key={`${gap.entityId}-${missing.field}`}
              initialValue={parsedSpecs}
              onSave={async (updatedSpecs) => {
                try {
                  await saveProductField(
                    "technicalSpecs",
                    JSON.stringify(updatedSpecs),
                  );
                } catch {
                  showToast(toastMessages.translationFailed, "error");
                }
              }}
            />
          );
        }

        if (gap.type === "product" && missing.field === "warranty") {
          const parsedWarranty = (() => {
            try {
              return JSON.parse(missing.englishValue);
            } catch {
              return [];
            }
          })();

          return (
            <WarrantyField
              key={`${gap.entityId}-${missing.field}`}
              initialValue={parsedWarranty}
              onSave={async (updatedWarranty) => {
                try {
                  await saveProductField(
                    "warranty",
                    JSON.stringify(updatedWarranty),
                  );
                } catch {
                  showToast(toastMessages.translationFailed, "error");
                }
              }}
            />
          );
        }

        if (gap.type === "product" && missing.field === "primaryFeatures") {
          const parsedFeatures = (() => {
            try {
              return JSON.parse(missing.englishValue);
            } catch {
              return [];
            }
          })();

          return (
            <PrimaryFeaturesField
              key={`${gap.entityId}-${missing.field}`}
              initialValue={parsedFeatures}
              onSave={async (updatedFeatures) => {
                try {
                  await saveProductField(
                    "primaryFeatures",
                    JSON.stringify(updatedFeatures),
                  );
                } catch {
                  showToast(toastMessages.translationFailed, "error");
                }
              }}
            />
          );
        }

        if (gap.type === "product" && missing.field === "highlights") {
          const parsedHighlights = (() => {
            try {
              return JSON.parse(missing.englishValue);
            } catch {
              return [];
            }
          })();

          return (
            <HighlightsField
              key={`${gap.entityId}-${missing.field}`}
              initialValue={parsedHighlights}
              onSave={async (updatedHighlights) => {
                try {
                  await saveProductField(
                    "highlights",
                    JSON.stringify(updatedHighlights),
                  );
                } catch {
                  showToast(toastMessages.translationFailed, "error");
                }
              }}
            />
          );
        }

        if (gap.type === "static") {
          const onStaticSave = async (value: string) => {
            try {
              await saveStaticField(value);
            } catch {
              showToast(toastMessages.translationFailed, "error");
            }
          };

          return (
            <TranslationBlurInput
              key={`${gap.entityId}-${missing.field}`}
              label={missing.fieldLabel}
              defaultValue=""
              englishReference={missing.englishValue}
              onSave={onStaticSave}
              disabled={!canUpdate}
            />
          );
        }

        const onSave = async (value: string) => {
          try {
            if (gap.type === "product")
              await saveProductField(missing.field, value);
            else if (gap.type === "category")
              await saveCategoryField(missing.field, value);
            else if (gap.type === "cms")
              await saveCmsField(missing.field, value);
          } catch {
            showToast(toastMessages.translationFailed, "error");
          }
        };

        if (isLong) {
          return (
            <TranslationBlurField
              key={`${gap.entityId}-${missing.field}`}
              label={missing.fieldLabel}
              rows={missing.field === "description" ? 4 : 3}
              defaultValue=""
              englishReference={missing.englishValue}
              onSave={onSave}
              disabled={!canUpdate}
            />
          );
        }

        return (
          <TranslationBlurInput
            key={`${gap.entityId}-${missing.field}`}
            label={missing.fieldLabel}
            defaultValue=""
            englishReference={missing.englishValue}
            onSave={onSave}
            disabled={!canUpdate}
          />
        );
      })}
    </div>
  );
}

export function TranslationCoverageHub({
  languages,
  canUpdate = false,
  canDelete = false,
  canCreate = false,
}: {
  languages: AdminLanguage[];
  canUpdate?: boolean;
  canDelete?: boolean;
  canCreate?: boolean;
}) {
  const translationLanguages = filterTranslationLanguages(languages);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingScrollTopRef = useRef<number | null>(null);
  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | CoverageGapType>("all");
  const [priorityFilter, setPriorityFilter] = useState<
    "all" | CoveragePriority
  >("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const activeLanguageId =
    selectedLanguageId || translationLanguages[0]?.id || "";
  const deferredSearchQuery = useDeferredValue(searchQuery.trim());
  const { showToast } = useToast();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      "admin-translation-coverage",
      activeLanguageId,
      typeFilter,
      priorityFilter,
      page,
      pageSize,
      deferredSearchQuery,
    ],
    queryFn: () =>
      adminApi
        .get("/translations/coverage", {
          params: {
            languageId: activeLanguageId,
            type: typeFilter,
            priority: priorityFilter,
            page,
            limit: pageSize,
            search: deferredSearchQuery || undefined,
          },
        })
        .then((response) => response.data.data as CoverageResponse),
    enabled: !!activeLanguageId,
    placeholderData: (previousData) => previousData,
  });

  const missingTotal = data ? totalMissing(data.summary) : 0;
  const completedTotal = data ? totalCompleted(data.summary) : 0;
  const translatableTotal = data ? totalTranslatable(data.summary) : 0;
  const overallCompletion =
    translatableTotal > 0
      ? Math.round((completedTotal / translatableTotal) * 100)
      : 100;
  const totalPages = data ? Math.max(1, data.gaps.totalPages) : 1;
  const currentPage = data?.gaps.page ?? page;
  const firstItem =
    data && data.gaps.total > 0 ? (currentPage - 1) * data.gaps.limit + 1 : 0;
  const lastItem = data
    ? Math.min(currentPage * data.gaps.limit, data.gaps.total)
    : 0;
  const paginationItems = getPaginationItems(currentPage, totalPages);

  const getAdminScrollContainer = useCallback(
    () => rootRef.current?.closest("main") as HTMLElement | null,
    [],
  );

  const captureAdminScroll = useCallback(() => {
    const scrollContainer = getAdminScrollContainer();
    pendingScrollTopRef.current = scrollContainer?.scrollTop ?? window.scrollY;
  }, [getAdminScrollContainer]);

  const restoreAdminScroll = useCallback(() => {
    const previousScrollTop = pendingScrollTopRef.current;
    if (previousScrollTop === null) return;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const scrollContainer = getAdminScrollContainer();
        if (scrollContainer) {
          scrollContainer.scrollTop = previousScrollTop;
        } else {
          window.scrollTo({ top: previousScrollTop });
        }
        pendingScrollTopRef.current = null;
      });
    });
  }, [getAdminScrollContainer]);

  const preserveAdminScroll = useCallback(
    (update: () => void) => {
      captureAdminScroll();
      update();
    },
    [captureAdminScroll],
  );

  useEffect(() => {
    if (!isLoading && !isFetching) restoreAdminScroll();
  }, [data, isLoading, isFetching, restoreAdminScroll]);

  const selectTypeFilter = (value: "all" | CoverageGapType) => {
    preserveAdminScroll(() => {
      setTypeFilter(value);
      setPage(1);
      setExpandedKey(null);
    });
  };

  const selectPriorityFilter = (value: "all" | CoveragePriority) => {
    preserveAdminScroll(() => {
      setPriorityFilter(value);
      setPage(1);
      setExpandedKey(null);
    });
  };

  const goToPage = (targetPage: number) => {
    const safePage = Math.min(totalPages, Math.max(1, targetPage));
    setPage(safePage);
    setExpandedKey(null);
  };

  const handleExportCsv = async () => {
    try {
      setIsExporting(true);
      const response = await adminApi.get("/translations/coverage/export", {
        params: {
          languageId: activeLanguageId,
          type: typeFilter,
          priority: priorityFilter,
          search: deferredSearchQuery || undefined,
        },
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], { type: "text/csv;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `translation-coverage-${Date.now()}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      showToast("Failed to export translations CSV.", "error");
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const formData = new FormData();
      formData.append("file", file);

      const response = await adminApi.post(
        "/translations/coverage/import",
        formData,
        {
          params: { languageId: activeLanguageId },
          
        },
      );

      const result = response.data.data as {
        imported: number;
        skipped: number;
        errors?: string[];
      };
      showToast(
        `CSV import complete: ${result.imported} imported, ${result.skipped} skipped.`,
      );
      if (result.errors?.length) {
        showToast(
          `${result.errors.length} row${result.errors.length === 1 ? "" : "s"} need review after import.`,
          "error",
        );
      }
      setExpandedKey(null);
      refetch();
    } catch {
      showToast("Failed to import translations CSV.", "error");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  if (!translationLanguages.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-white p-10 text-center">
        <Languages size={28} className="mx-auto mb-3 text-[#E31E24]" />
        <p className="text-[14px] font-medium text-[#1A1A1A]">
          Add a translation language to use the coverage hub
        </p>
        <p className="mt-1 text-[13px] text-[#9A9A9A]">
          The default English language is excluded from coverage checks.
        </p>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="space-y-5">
      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1A1A]">
              Translation Coverage
            </h3>
            <p className="mt-1 text-[13px] text-[#6B6B6B]">
              Find missing translations across products, categories, CMS
              content, and static UI labels.
            </p>
          </div>
          <div className="w-full xl:w-[260px]">
            <AdminSelect
              label="Language"
              value={activeLanguageId}
              onChange={(e) => {
                setSelectedLanguageId(e.target.value);
                setPage(1);
                setExpandedKey(null);
              }}
              options={translationLanguages.map((lang) => ({
                value: lang.id,
                label: `${lang.name} (${lang.code.toUpperCase()})`,
              }))}
            />
          </div>
        </div>

        {data && (
          <div className="mt-5 flex flex-wrap items-center gap-2 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] px-4 py-3">
            {missingTotal === 0 ? (
              <>
                <CheckCircle2 size={16} className="text-green-600" />
                <span className="text-[13px] font-medium text-green-700">
                  {data.language.name} is fully translated across all tracked
                  content.
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-amber-600" />
                <span className="text-[13px] text-[#1A1A1A]">
                  <span className="font-semibold">{missingTotal}</span> missing
                  field{missingTotal === 1 ? "" : "s"} for{" "}
                  <span className="font-semibold">{data.language.name}</span>
                </span>
              </>
            )}
            <span className="rounded-full border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12px] font-medium text-[#6B6B6B]">
              {overallCompletion}% complete
            </span>
            {isFetching && (
              <span className="text-[12px] text-[#9A9A9A]">Refreshing…</span>
            )}
          </div>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            label="Products"
            gaps={data.summary.product.gaps}
            fields={data.summary.product.fields}
            totalFields={data.summary.product.totalFields}
            completedFields={data.summary.product.completedFields}
            completionPercentage={data.summary.product.completionPercentage}
            active={typeFilter === "product"}
            onClick={() => selectTypeFilter("product")}
          />
          <SummaryCard
            label="Categories"
            gaps={data.summary.category.gaps}
            fields={data.summary.category.fields}
            totalFields={data.summary.category.totalFields}
            completedFields={data.summary.category.completedFields}
            completionPercentage={data.summary.category.completionPercentage}
            active={typeFilter === "category"}
            onClick={() => selectTypeFilter("category")}
          />
          <SummaryCard
            label="Static UI"
            gaps={data.summary.static.gaps}
            fields={data.summary.static.fields}
            totalFields={data.summary.static.totalFields}
            completedFields={data.summary.static.completedFields}
            completionPercentage={data.summary.static.completionPercentage}
            active={typeFilter === "static"}
            onClick={() => selectTypeFilter("static")}
          />
          <SummaryCard
            label="CMS"
            gaps={data.summary.cms.gaps}
            fields={data.summary.cms.fields}
            totalFields={data.summary.cms.totalFields}
            completedFields={data.summary.cms.completedFields}
            completionPercentage={data.summary.cms.completionPercentage}
            active={typeFilter === "cms"}
            onClick={() => selectTypeFilter("cms")}
          />
        </div>
      )}

      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="mb-4 rounded-xl border border-[#ECECEC] bg-[#FCFCFC] p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div className="w-full xl:max-w-[460px]">
              <label className="relative block">
                <Search
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setPage(1);
                    setExpandedKey(null);
                  }}
                  placeholder="Search missing translations..."
                  className="h-11 w-full rounded-xl border border-[#E6E6E6] bg-white pl-10 pr-3 text-[13px] outline-none transition focus:border-[#E31E24] focus:ring-4 focus:ring-[#E31E24]/10"
                />
              </label>

              <p className="mt-2 text-[12px] text-[#8A8A8A]">
                Missing translations only · Completed labels are editable in
                Languages &amp; Tools.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={isExporting || !activeLanguageId}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E6E6E6] bg-white px-3.5 text-[12.5px] font-medium text-[#1A1A1A] transition hover:bg-[#FAFAFA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Download size={14} />
                {isExporting ? "Exporting..." : "Export CSV"}
              </button>

              {canUpdate && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting || !activeLanguageId}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E31E24] bg-[#E31E24] px-3.5 text-[12.5px] font-medium text-white shadow-sm transition hover:bg-[#C9151B] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Upload size={14} />
                  {isImporting ? "Importing..." : "Import CSV"}
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleImportCsv}
              />

              <label className="flex h-10 items-center gap-2 rounded-xl border border-[#E6E6E6] bg-white px-3 text-[12.5px] text-[#6B6B6B]">
                Show
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                    setExpandedKey(null);
                  }}
                  className="bg-transparent text-[12.5px] font-medium text-[#1A1A1A] outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="cursor-pointer"
                    >
                      {option}
                    </option>
                  ))}
                </select>
                items
              </label>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {TYPE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => selectTypeFilter(filter.value)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  typeFilter === filter.value
                    ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                    : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CFCFCF]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="mr-1 text-[12px] font-medium text-[#8A8A8A]">
              Priority:
            </span>

            {PRIORITY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => selectPriorityFilter(filter.value)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                  priorityFilter === filter.value
                    ? "border-[#E31E24] bg-[#E31E24] text-white"
                    : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CFCFCF]",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-[#9A9A9A]">
            Loading coverage…
          </div>
        ) : data && data.gaps.data.length > 0 ? (
          <div className="space-y-3">
            {data.gaps.data.map((gap) => {
              const rowKey = `${gap.type}:${gap.entityId}`;
              const expanded = expandedKey === rowKey;
              const editHref = getEditHref(gap);

              return (
                <div
                  key={rowKey}
                  className="rounded-lg border border-[#E6E6E6]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedKey(expanded ? null : rowKey)}
                    className="flex w-full flex-col gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA] md:flex-row md:items-start md:justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#E6E6E6] bg-[#F8F8F8] px-2 py-0.5 text-[11px] font-medium uppercase text-[#6B6B6B]">
                          {TYPE_LABELS[gap.type]}
                        </span>
                        <span
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[11px] font-medium",
                            PRIORITY_BADGE_CLASSES[gap.priority],
                          )}
                        >
                          {gap.priorityLabel}
                        </span>
                        <span className="text-[13.5px] font-medium text-[#1A1A1A]">
                          {gap.entityLabel}
                        </span>
                      </div>
                      {gap.context && (
                        <p className="mt-1 text-[12px] text-[#9A9A9A]">
                          {gap.context}
                        </p>
                      )}
                      <p className="mt-1 text-[12px] text-[#6B6B6B]">
                        Missing:{" "}
                        {gap.missingFields
                          .map((field) => field.fieldLabel)
                          .join(", ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={editHref}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E6E6E6] px-2.5 py-1 text-[12px] text-[#6B6B6B] hover:bg-[#F5F5F5]"
                      >
                        Open <ExternalLink size={12} />
                      </Link>
                      <ChevronDown
                        size={16}
                        className={cn(
                          "text-[#9A9A9A] transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4">
                      <GapSaveFields
                        gap={gap}
                        languageId={activeLanguageId}
                        onSaved={() => refetch()}
                        canUpdate={canUpdate}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] px-3 py-3 xl:flex-row xl:items-center xl:justify-between">
                <span className="text-[12.5px] text-[#9A9A9A]">
                  Showing {firstItem}-{lastItem} of {data.gaps.total} missing
                  items
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => goToPage(currentPage - 1)}
                    className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] text-[#1A1A1A] transition hover:border-[#CFCFCF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <div className="flex flex-wrap items-center gap-1">
                    {paginationItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span
                          key={`ellipsis-${index}`}
                          className="px-2 text-[12.5px] text-[#9A9A9A]"
                        >
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => goToPage(item)}
                          className={cn(
                            "h-8 min-w-8 rounded-md border px-2 text-[12.5px] font-medium transition",
                            item === currentPage
                              ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                              : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CFCFCF] hover:text-[#1A1A1A]",
                          )}
                        >
                          {item}
                        </button>
                      ),
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => goToPage(currentPage + 1)}
                    className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] text-[#1A1A1A] transition hover:border-[#CFCFCF] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                  </button>
                  <form
                    className="ml-0 flex items-center gap-2 xl:ml-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const formData = new FormData(event.currentTarget);
                      const pageValue = Number(formData.get("page"));

                      if (Number.isFinite(pageValue)) {
                        goToPage(pageValue);
                      }
                    }}
                  >
                    <span className="text-[12.5px] text-[#9A9A9A]">Go to</span>
                    <input
                      key={currentPage}
                      name="page"
                      type="number"
                      min={1}
                      max={totalPages}
                      defaultValue={currentPage}
                      className="h-8 w-16 rounded-md border border-[#E6E6E6] bg-white px-2 text-center text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                    />
                  </form>
                </div>
              </div>
            )}
          </div>
        ) : data && deferredSearchQuery ? (
          <div className="rounded-lg border border-dashed border-[#E6E6E6] py-10 text-center">
            <Search size={24} className="mx-auto mb-2 text-[#9A9A9A]" />
            <p className="text-[14px] font-medium text-[#1A1A1A]">
              No missing translations found
            </p>
            <p className="mt-1 text-[13px] text-[#9A9A9A]">
              Try another keyword or clear the search.
            </p>
          </div>
        ) : data ? (
          <div className="rounded-lg border border-dashed border-[#E6E6E6] py-10 text-center">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-green-600" />
            <p className="text-[14px] font-medium text-[#1A1A1A]">
              No missing translations in this view
            </p>
            <p className="mt-1 text-[13px] text-[#9A9A9A]">
              {priorityFilter !== "all"
                ? `No ${PRIORITY_FILTERS.find((filter) => filter.value === priorityFilter)?.label.toLowerCase()} items found.`
                : typeFilter === "all"
                  ? "Everything tracked for this language is complete."
                  : `All ${TYPE_LABELS[typeFilter as CoverageGapType].toLowerCase()} content is translated.`}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
