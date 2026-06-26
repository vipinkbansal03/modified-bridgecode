"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminSelect, useToast, toastMessages } from "@/components/admin/AdminComponents";
import { TranslationBlurField, TranslationBlurInput, filterTranslationLanguages } from "@/components/admin/TranslationEditorUi";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { AlertCircle, CheckCircle2, ChevronDown, ExternalLink, Languages } from "lucide-react";

type CoverageGapType = "product" | "category" | "static" | "cms";
type CmsEntityType = "page" | "section" | "block" | "menuItem" | "footer";

type CoverageMissingField = {
  field: string;
  fieldLabel: string;
  englishValue: string;
};

type CoverageGap = {
  type: CoverageGapType;
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
};

type CoverageResponse = {
  language: { id: string; name: string; code: string };
  summary: Record<CoverageGapType, CoverageBucketSummary>;
  gaps: { data: CoverageGap[]; total: number; page: number; limit: number };
};

type AdminLanguage = { id: string; name: string; code: string; isDefault?: boolean };

const TYPE_FILTERS: Array<{ value: "all" | CoverageGapType; label: string }> = [
  { value: "all", label: "All" },
  { value: "product", label: "Products" },
  { value: "category", label: "Categories" },
  { value: "static", label: "Static UI" },
  { value: "cms", label: "CMS" },
];

const TYPE_LABELS: Record<CoverageGapType, string> = {
  product: "Product",
  category: "Category",
  static: "Static UI",
  cms: "CMS",
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
      if (gap.cmsPageId) return `/admin/cms/pages/${gap.cmsPageId}`;
      return `/admin/cms/pages/${gap.entityId}`;
    default:
      return "#";
  }
}

function totalMissing(summary: CoverageResponse["summary"]) {
  return Object.values(summary).reduce((sum, bucket) => sum + bucket.fields, 0);
}

function SummaryCard({
  label,
  gaps,
  fields,
  active,
  onClick,
}: {
  label: string;
  gaps: number;
  fields: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        active ? "border-[#E31E24] bg-[#FFFBFB]" : "border-[#E6E6E6] bg-white hover:border-[#D8D8D8]",
      )}
    >
      <div className="text-[12px] font-medium uppercase tracking-wide text-[#9A9A9A]">{label}</div>
      <div className="mt-2 text-[24px] font-semibold text-[#1A1A1A]">{fields}</div>
      <div className="mt-1 text-[12px] text-[#6B6B6B]">
        {gaps === 0 ? "All complete" : `${gaps} item${gaps === 1 ? "" : "s"} need attention`}
      </div>
    </button>
  );
}

function GapSaveFields({
  gap,
  languageId,
  onSaved,
}: {
  gap: CoverageGap;
  languageId: string;
  onSaved: () => void;
}) {
  const { showToast } = useToast();

  const saveProductField = async (field: string, value: string) => {
    await adminApi.put(`/translations/products/${gap.entityId}/${languageId}`, { [field]: value });
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  const saveCategoryField = async (field: string, value: string) => {
    await adminApi.put(`/translations/categories/${gap.entityId}/${languageId}`, { [field]: value });
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  const saveStaticField = async (value: string) => {
    await adminApi.put("/translations/keywords", { key: gap.entityId, languageId, value });
    showToast(toastMessages.staticLabelSaved);
    onSaved();
  };

  const saveCmsField = async (field: string, value: string) => {
    if (!gap.cmsEntityType) return;
    await adminApi.put(`/cms/translations/${gap.cmsEntityType}/${gap.entityId}/${languageId}`, { [field]: value });
    showToast(toastMessages.translationSaved);
    onSaved();
  };

  return (
    <div className="space-y-3 border-t border-[#F0F0F0] pt-3">
      {gap.missingFields.map((missing) => {
        const isLong = missing.englishValue.length > 80 || missing.field === "description" || missing.field === "seoDescription";

        if (gap.type === "static") {
          return (
            <TranslationBlurInput
              key={`${gap.entityId}-${missing.field}`}
              label={missing.fieldLabel}
              defaultValue=""
              englishReference={missing.englishValue}
              onSave={saveStaticField}
            />
          );
        }

        const onSave = async (value: string) => {
          try {
            if (gap.type === "product") await saveProductField(missing.field, value);
            else if (gap.type === "category") await saveCategoryField(missing.field, value);
            else if (gap.type === "cms") await saveCmsField(missing.field, value);
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
          />
        );
      })}
    </div>
  );
}

export function TranslationCoverageHub({ languages }: { languages: AdminLanguage[] }) {
  const translationLanguages = filterTranslationLanguages(languages);
  const [selectedLanguageId, setSelectedLanguageId] = useState(translationLanguages[0]?.id ?? "");
  const [typeFilter, setTypeFilter] = useState<"all" | CoverageGapType>("all");
  const [page, setPage] = useState(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    if (translationLanguages.length && !selectedLanguageId) {
      setSelectedLanguageId(translationLanguages[0].id);
    }
  }, [translationLanguages, selectedLanguageId]);

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-translation-coverage", selectedLanguageId, typeFilter, page],
    queryFn: () =>
      adminApi
        .get("/translations/coverage", {
          params: { languageId: selectedLanguageId, type: typeFilter, page, limit: 25 },
        })
        .then((response) => response.data.data as CoverageResponse),
    enabled: !!selectedLanguageId,
  });

  const missingTotal = data ? totalMissing(data.summary) : 0;
  const totalPages = data ? Math.max(1, Math.ceil(data.gaps.total / data.gaps.limit)) : 1;

  if (!translationLanguages.length) {
    return (
      <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-white p-10 text-center">
        <Languages size={28} className="mx-auto mb-3 text-[#E31E24]" />
        <p className="text-[14px] font-medium text-[#1A1A1A]">Add a translation language to use the coverage hub</p>
        <p className="mt-1 text-[13px] text-[#9A9A9A]">The default English language is excluded from coverage checks.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1A1A1A]">Translation Coverage</h3>
            <p className="mt-1 text-[13px] text-[#6B6B6B]">
              Find missing translations across products, categories, CMS content, and static UI labels.
            </p>
          </div>
          <div className="w-full lg:w-[260px]">
            <AdminSelect
              label="Language"
              value={selectedLanguageId}
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
                  {data.language.name} is fully translated across all tracked content.
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={16} className="text-amber-600" />
                <span className="text-[13px] text-[#1A1A1A]">
                  <span className="font-semibold">{missingTotal}</span> missing field{missingTotal === 1 ? "" : "s"} for{" "}
                  <span className="font-semibold">{data.language.name}</span>
                </span>
              </>
            )}
            {isFetching && <span className="text-[12px] text-[#9A9A9A]">Refreshing…</span>}
          </div>
        )}
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard
            label="Products"
            gaps={data.summary.product.gaps}
            fields={data.summary.product.fields}
            active={typeFilter === "product"}
            onClick={() => {
              setTypeFilter("product");
              setPage(1);
            }}
          />
          <SummaryCard
            label="Categories"
            gaps={data.summary.category.gaps}
            fields={data.summary.category.fields}
            active={typeFilter === "category"}
            onClick={() => {
              setTypeFilter("category");
              setPage(1);
            }}
          />
          <SummaryCard
            label="Static UI"
            gaps={data.summary.static.gaps}
            fields={data.summary.static.fields}
            active={typeFilter === "static"}
            onClick={() => {
              setTypeFilter("static");
              setPage(1);
            }}
          />
          <SummaryCard
            label="CMS"
            gaps={data.summary.cms.gaps}
            fields={data.summary.cms.fields}
            active={typeFilter === "cms"}
            onClick={() => {
              setTypeFilter("cms");
              setPage(1);
            }}
          />
        </div>
      )}

      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="mb-4 flex flex-wrap gap-2">
          {TYPE_FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => {
                setTypeFilter(filter.value);
                setPage(1);
              }}
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

        {isLoading ? (
          <div className="py-12 text-center text-[13px] text-[#9A9A9A]">Loading coverage…</div>
        ) : data && data.gaps.data.length > 0 ? (
          <div className="space-y-3">
            {data.gaps.data.map((gap) => {
              const rowKey = `${gap.type}:${gap.entityId}`;
              const expanded = expandedKey === rowKey;
              const editHref = getEditHref(gap);

              return (
                <div key={rowKey} className="rounded-lg border border-[#E6E6E6]">
                  <button
                    type="button"
                    onClick={() => setExpandedKey(expanded ? null : rowKey)}
                    className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-[#FAFAFA]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-[#E6E6E6] bg-[#F8F8F8] px-2 py-0.5 text-[11px] font-medium uppercase text-[#6B6B6B]">
                          {TYPE_LABELS[gap.type]}
                        </span>
                        <span className="text-[13.5px] font-medium text-[#1A1A1A]">{gap.entityLabel}</span>
                      </div>
                      {gap.context && <p className="mt-1 text-[12px] text-[#9A9A9A]">{gap.context}</p>}
                      <p className="mt-1 text-[12px] text-[#6B6B6B]">
                        Missing: {gap.missingFields.map((field) => field.fieldLabel).join(", ")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={editHref}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 rounded-md border border-[#E6E6E6] px-2.5 py-1 text-[12px] text-[#6B6B6B] hover:bg-[#F5F5F5]"
                      >
                        Open <ExternalLink size={12} />
                      </Link>
                      <ChevronDown size={16} className={cn("text-[#9A9A9A] transition-transform", expanded && "rotate-180")} />
                    </div>
                  </button>

                  {expanded && (
                    <div className="px-4 pb-4">
                      <GapSaveFields gap={gap} languageId={selectedLanguageId} onSaved={() => refetch()} />
                    </div>
                  )}
                </div>
              );
            })}

            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[12.5px] text-[#9A9A9A]">
                  Page {data.gaps.page} of {totalPages} · {data.gaps.total} items
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    className="rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12.5px] disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12.5px] disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : data ? (
          <div className="rounded-lg border border-dashed border-[#E6E6E6] py-10 text-center">
            <CheckCircle2 size={24} className="mx-auto mb-2 text-green-600" />
            <p className="text-[14px] font-medium text-[#1A1A1A]">No missing translations in this view</p>
            <p className="mt-1 text-[13px] text-[#9A9A9A]">
              {typeFilter === "all"
                ? "Everything tracked for this language is complete."
                : `All ${TYPE_LABELS[typeFilter as CoverageGapType].toLowerCase()} content is translated.`}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
