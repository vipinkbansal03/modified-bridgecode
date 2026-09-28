"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, StatusBadge, useToast, toastMessages } from "@/components/admin/AdminComponents";
import { TranslationCoverageHub } from "@/components/admin/TranslationCoverageHub";
import { cn } from "@/utils/cn";
import { useAdminLanguages, useAdminProducts } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { staticMessages, type StaticMessageKey } from "@/i18n/staticMessages";
import { STATIC_SECTIONS, getStaticKeyMetadata, type StaticSectionId } from "@/i18n/staticLabelMetadata";
import {
  Check,
  Globe,
  FileText,
  Bot,
  Settings,
  Plus,
  Search,
  Shield,
  Trash2,
  X,
  Zap,
  Undo2,
  Sparkles,
  Layers,
  ChevronRight,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { RefreshButton } from "@/components/admin/RefreshButton";

type KeywordRow = { id: string; key: StaticMessageKey; languageId: string; value: string };
type LanguageRow = { id: string; name: string; code: string; isDefault: boolean; isEnabled: boolean };
type ReviewQueueItem = {
  id: string;
  title: string | null;
  status: string;
  isAiGenerated: boolean;
  language: { name: string; code: string };
  product: { id: string; title: string; slug: string; productCode: string | null };
};
type ProtectedKeywordRow = { id: string; term: string; note: string | null };
type StaticStatusFilter = "all" | "missing" | "translated";
type TabType = "text" | "coverage" | "ai" | "languages";

const STATIC_PAGE_SIZE_OPTIONS = [12, 24, 48, 96] as const;

function getPaginationItems(currentPage: number, totalPages: number) {
  const pages: Array<number | "ellipsis"> = [];

  for (let page = 1; page <= totalPages; page += 1) {
    const isEdge = page === 1 || page === totalPages;
    const isNearCurrent = Math.abs(page - currentPage) <= 1;

    if (isEdge || isNearCurrent) {
      pages.push(page);
      continue;
    }

    if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return pages;
}

interface StaticLabelCardProps {
  labelKey: StaticMessageKey;
  defaultText: string;
  savedValue: string;
  isFlashed: boolean;
  isDefaultLang: boolean;
  langName: string;
  selectedLanguageId: string;
  onSave: (key: StaticMessageKey, value: string) => Promise<void>;
  onReset: (key: StaticMessageKey) => Promise<void>;
}

function StaticLabelCard({
  labelKey,
  defaultText,
  savedValue,
  isFlashed,
  isDefaultLang,
  langName,
  selectedLanguageId,
  onSave,
  onReset,
}: StaticLabelCardProps) {
  const [localValue, setLocalValue] = useState(savedValue);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalValue(savedValue);
  }, [savedValue, selectedLanguageId]);

  const meta = getStaticKeyMetadata(labelKey);
  const isSaved = Boolean(savedValue.trim());
  const isDirty = localValue.trim() !== savedValue.trim();

  const handleSave = async () => {
    const val = localValue.trim();
    if (val === savedValue.trim()) return;
    setIsSaving(true);
    try {
      await onSave(labelKey, val);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setIsSaving(true);
    try {
      await onReset(labelKey);
      setLocalValue("");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-xl border bg-white p-4.5 shadow-xs transition-all",
        isFlashed
          ? "border-green-400 ring-2 ring-green-100"
          : isSaved
          ? "border-[#D6E4FF]"
          : "border-[#E6E6E6]",
      )}
    >
      {/* Card Header: Friendly name & Section info */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-[14px] font-bold text-[#1A1A1A]">{meta.friendlyName}</span>
              {isFlashed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 animate-pulse">
                  <Check size={11} /> Saved!
                </span>
              )}
              {isSaved && !isFlashed && (
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-medium text-blue-700">
                  Customized
                </span>
              )}
            </div>
            <p className="text-[12px] text-[#777] leading-tight">{meta.context}</p>
          </div>
          <span className="shrink-0 rounded-md bg-[#F4F4F4] px-2 py-1 text-[11px] font-medium text-[#666]">
            {STATIC_SECTIONS.find((s) => s.id === meta.section)?.icon}{" "}
            {STATIC_SECTIONS.find((s) => s.id === meta.section)?.label}
          </span>
        </div>

        {/* English Reference */}
        <div className="mt-3 rounded-lg border border-[#ECECEC] bg-[#FAFAFA] p-2.5">
          <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#999]">
            Default Original Text (English):
          </span>
          <p className="mt-0.5 text-[13px] text-[#333] font-medium select-text break-words">
            {defaultText}
          </p>
        </div>
      </div>

      {/* Input Box for custom/translated text */}
      <div className="mt-3 space-y-2">
        <label className="block text-[11.5px] font-semibold text-[#444]">
          {isDefaultLang ? "Custom English Text:" : `Text in ${langName}:`}
        </label>
        {defaultText.length > 60 ? (
          <textarea
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={`Type text here (default: ${defaultText})`}
            rows={3}
            className="w-full rounded-lg border border-[#DCDCDC] p-2.5 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
            onBlur={() => {
              if (isDirty) handleSave();
            }}
          />
        ) : (
          <input
            type="text"
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={`Type text here (default: ${defaultText})`}
            className="h-10 w-full rounded-lg border border-[#DCDCDC] px-3 text-[13px] text-[#1A1A1A] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSave();
              }
            }}
            onBlur={() => {
              if (isDirty) handleSave();
            }}
          />
        )}

        {/* Action Row: Key & Action buttons (Save + Reset) */}
        <div className="flex items-center justify-between pt-2 border-t border-[#F0F0F0]">
          <span className="text-[11px] font-mono text-[#AAA] select-all">
            key: {labelKey}
          </span>
          <div className="flex items-center gap-2.5">
            {isSaved && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleReset}
                className="flex items-center gap-1 text-[11.5px] font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
              >
                <Undo2 size={12} /> Reset to Default
              </button>
            )}
            <button
              type="button"
              disabled={isSaving || !isDirty}
              onClick={handleSave}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-semibold transition-all shadow-2xs cursor-pointer",
                isDirty
                  ? "bg-[#E31E24] text-white hover:bg-[#B5151B]"
                  : isSaved
                  ? "bg-green-50 text-green-700 border border-green-200 cursor-default"
                  : "bg-[#F0F0F0] text-[#888] cursor-not-allowed",
              )}
            >
              <Check size={13} />
              <span>{isSaving ? "Saving..." : isDirty ? "Save Changes" : isSaved ? "Saved" : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TranslationsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("translations.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("translations.create");
  const canUpdate = hasPermission("translations.update");
  const canDelete = hasPermission("translations.delete");

  const [activeTab, setActiveTab] = useState<TabType>("text");
  const [showLangForm, setShowLangForm] = useState(false);
  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedStaticLanguage, setSelectedStaticLanguage] = useState("");
  const [protectedTerm, setProtectedTerm] = useState("");
  const [protectedNote, setProtectedNote] = useState("");
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const [updatingLanguageId, setUpdatingLanguageId] = useState("");
  const [staticSearch, setStaticSearch] = useState("");
  const [selectedSection, setSelectedSection] = useState<"all" | StaticSectionId>("all");
  const [staticStatusFilter, setStaticStatusFilter] = useState<StaticStatusFilter>("all");
  const [staticPage, setStaticPage] = useState(1);
  const [staticPageSize, setStaticPageSize] = useState<(typeof STATIC_PAGE_SIZE_OPTIONS)[number]>(24);
  const [savedKeyFlash, setSavedKeyFlash] = useState<string | null>(null);

  const { showToast, ToastComponent } = useToast();
  const { data: languages = [], refetch: refetchLangs, isFetching: isFetchingLangs } = useAdminLanguages();
  const { data: productsData } = useAdminProducts({ limit: 40 });
  const products = productsData?.data || [];

  // Auto-select default language (or first language) if none selected yet
  useEffect(() => {
    if (!selectedStaticLanguage && (languages as LanguageRow[]).length > 0) {
      const defaultLang = (languages as LanguageRow[]).find((l) => l.isDefault) || (languages as LanguageRow[])[0];
      if (defaultLang) {
        setSelectedStaticLanguage(defaultLang.id);
      }
    }
  }, [languages, selectedStaticLanguage]);

  const { data: keywordRows = [], refetch: refetchKeywords, isFetching: isFetchingKeywords } = useQuery({
    queryKey: ["admin-static-keywords", selectedStaticLanguage],
    queryFn: () => adminApi.get("/translations/keywords", { params: { languageId: selectedStaticLanguage } }).then((r) => r.data.data as KeywordRow[]),
    enabled: !!selectedStaticLanguage,
  });

  const { data: reviewQueue = [], refetch: refetchReviewQueue, isFetching: isFetchingReviewQueue } = useQuery({
    queryKey: ["admin-translation-review-queue"],
    queryFn: () => adminApi.get("/translations/review-queue").then((r) => r.data.data as ReviewQueueItem[]),
  });

  const { data: protectedKeywords = [], refetch: refetchProtectedKeywords, isFetching: isFetchingProtectedKeywords } = useQuery({
    queryKey: ["admin-protected-keywords"],
    queryFn: () => adminApi.get("/translations/protected-keywords").then((r) => r.data.data as ProtectedKeywordRow[]),
  });

  const isRefreshing = isFetchingLangs || isFetchingKeywords || isFetchingReviewQueue || isFetchingProtectedKeywords;

  const handleRefresh = async () => {
    await Promise.all([
      refetchLangs(),
      selectedStaticLanguage ? refetchKeywords() : Promise.resolve(),
      refetchReviewQueue(),
      refetchProtectedKeywords(),
    ]);
    showToast("Translations list refreshed.", "success");
  };

  const currentLanguage = (languages as LanguageRow[]).find((l) => l.id === selectedStaticLanguage);
  const keywordMap = useMemo(() => new Map(keywordRows.map((row) => [row.key, row.value])), [keywordRows]);
  const allStaticKeywordEntries = useMemo(() => Object.entries(staticMessages) as Array<[StaticMessageKey, string]>, []);

  // Calculate counts per section
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allStaticKeywordEntries.length };
    for (const [key] of allStaticKeywordEntries) {
      const meta = getStaticKeyMetadata(key);
      counts[meta.section] = (counts[meta.section] || 0) + 1;
    }
    return counts;
  }, [allStaticKeywordEntries]);

  // Filter static entries
  const filteredStaticEntries = useMemo(() => {
    const query = staticSearch.trim().toLowerCase();
    return allStaticKeywordEntries.filter(([key, fallback]) => {
      const meta = getStaticKeyMetadata(key);
      const savedValue = keywordMap.get(key) ?? "";
      const hasCustomization = Boolean(savedValue.trim());

      // If user typed a search query, search globally across all sections so no results are missed
      const matchesSection = !query ? (selectedSection === "all" || meta.section === selectedSection) : true;
      const matchesStatus =
        staticStatusFilter === "all" ||
        (staticStatusFilter === "missing" && !hasCustomization) ||
        (staticStatusFilter === "translated" && hasCustomization);

      const matchesSearch =
        !query ||
        meta.friendlyName.toLowerCase().includes(query) ||
        meta.context.toLowerCase().includes(query) ||
        key.toLowerCase().includes(query) ||
        fallback.toLowerCase().includes(query) ||
        savedValue.toLowerCase().includes(query);

      return matchesSection && matchesStatus && matchesSearch;
    });
  }, [allStaticKeywordEntries, keywordMap, selectedSection, staticStatusFilter, staticSearch]);

  const translatedStaticCount = useMemo(
    () => allStaticKeywordEntries.filter(([key]) => Boolean((keywordMap.get(key) ?? "").trim())).length,
    [allStaticKeywordEntries, keywordMap],
  );
  const missingStaticCount = selectedStaticLanguage ? allStaticKeywordEntries.length - translatedStaticCount : 0;
  const staticCompletion = selectedStaticLanguage
    ? Math.round((translatedStaticCount / Math.max(allStaticKeywordEntries.length, 1)) * 100)
    : 0;

  const staticTotalPages = Math.max(1, Math.ceil(filteredStaticEntries.length / staticPageSize));
  const normalizedStaticPage = Math.min(staticPage, staticTotalPages);
  const staticSkip = (normalizedStaticPage - 1) * staticPageSize;
  const paginatedStaticKeywordEntries = filteredStaticEntries.slice(staticSkip, staticSkip + staticPageSize);
  const staticPaginationItems = getPaginationItems(normalizedStaticPage, staticTotalPages);

  const goToStaticPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), staticTotalPages);
    setStaticPage(nextPage);
  };

  const addLanguage = async () => {
    if (!langName || !langCode) return;
    try {
      await adminApi.post("/translations/languages", { name: langName, code: langCode.toLowerCase() });
      showToast("Language added.");
      refetchLangs();
      setLangName("");
      setLangCode("");
      setShowLangForm(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to add language."), "error");
    }
  };

  const updateLanguage = async (language: LanguageRow, data: Partial<Pick<LanguageRow, "isEnabled" | "isDefault">>) => {
    setUpdatingLanguageId(language.id);
    try {
      await adminApi.put(`/translations/languages/${language.id}`, data);
      showToast(data.isDefault ? "Default language updated." : "Language updated.");
      refetchLangs();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update language."), "error");
    } finally {
      setUpdatingLanguageId("");
    }
  };

  const deleteLanguage = async (language: LanguageRow) => {
    if (language.isDefault) return;
    if (!window.confirm(`Are you sure you want to delete ${language.name} (${language.code.toUpperCase()})? All associated translations will be removed.`)) return;
    setUpdatingLanguageId(language.id);
    try {
      await adminApi.delete(`/translations/languages/${language.id}`);
      showToast(`${language.name} deleted.`);
      refetchLangs();
      if (selectedStaticLanguage === language.id) {
        setSelectedStaticLanguage("");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete language."), "error");
    } finally {
      setUpdatingLanguageId("");
    }
  };

  const generateForProduct = async () => {
    if (!selectedProduct) return;
    try {
      const result = await adminApi.post("/translations/generate", { productId: selectedProduct });
      showToast(`Generated ${result.data.data.generated} translation${result.data.data.generated === 1 ? "" : "s"} for review.`);
      refetchReviewQueue();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to generate translations."), "error");
    }
  };

  const saveStaticKeyword = async (key: StaticMessageKey, value: string) => {
    if (!selectedStaticLanguage) return;
    try {
      await adminApi.put("/translations/keywords", { key, languageId: selectedStaticLanguage, value });
      setSavedKeyFlash(key);
      setTimeout(() => setSavedKeyFlash((curr) => (curr === key ? null : curr)), 2500);
      showToast(toastMessages.staticLabelSaved);
      refetchKeywords();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  };

  const resetStaticKeyword = async (key: StaticMessageKey) => {
    if (!selectedStaticLanguage) return;
    try {
      await adminApi.put("/translations/keywords", { key, languageId: selectedStaticLanguage, value: "" });
      showToast("Restored to default text.");
      refetchKeywords();
    } catch {
      showToast("Failed to reset label.", "error");
    }
  };

  const approveTranslation = async (id: string) => {
    try {
      await adminApi.put(`/translations/products/translations/${id}/approve`);
      showToast("Translation approved.");
      refetchReviewQueue();
      setSelectedReviewIds((prev) => prev.filter((item) => item !== id));
    } catch {
      showToast("Failed to approve translation.", "error");
    }
  };

  const rejectTranslation = async (id: string) => {
    try {
      await adminApi.put(`/translations/products/translations/${id}/reject`);
      showToast("Translation rejected.");
      refetchReviewQueue();
      setSelectedReviewIds((prev) => prev.filter((item) => item !== id));
    } catch {
      showToast("Failed to reject translation.", "error");
    }
  };

  const bulkApprove = async () => {
    if (!selectedReviewIds.length) return;
    try {
      const result = await adminApi.post("/translations/review-queue/approve", { ids: selectedReviewIds });
      showToast(`Approved ${result.data.data.approved} translation${result.data.data.approved === 1 ? "" : "s"}.`);
      setSelectedReviewIds([]);
      refetchReviewQueue();
    } catch {
      showToast("Failed to approve selected translations.", "error");
    }
  };

  const addProtectedKeyword = async () => {
    if (!protectedTerm.trim()) return;
    try {
      await adminApi.post("/translations/protected-keywords", { term: protectedTerm.trim(), note: protectedNote.trim() || null });
      showToast("Protected keyword added.");
      setProtectedTerm("");
      setProtectedNote("");
      refetchProtectedKeywords();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to add protected keyword."), "error");
    }
  };

  const removeProtectedKeyword = async (id: string) => {
    try {
      await adminApi.delete(`/translations/protected-keywords/${id}`);
      showToast("Protected keyword removed.");
      refetchProtectedKeywords();
    } catch {
      showToast("Failed to remove protected keyword.", "error");
    }
  };

  const toggleReviewSelection = (id: string) => {
    setSelectedReviewIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  if (authLoading || !hasPermission("translations.view")) {
    return null;
  }

  return (
    <AdminLayout title="Translations & Website Text" breadcrumb={[{ label: "Translations" }]}>
      {/* Top Friendly Helper Banner */}
      <div className="mb-6 rounded-xl border border-red-100 bg-gradient-to-r from-red-50/70 via-white to-blue-50/50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-[15px] font-semibold text-[#1A1A1A] flex items-center gap-2">
              <span>🌐</span> Website Text, PDP Labels & Translations Manager
            </h2>
            <p className="text-[13px] text-[#555] leading-relaxed">
              Easily customize all buttons, banners, product page (PDP) titles, cart text, and multilingual translations across the storefront without touching code.
            </p>
          </div>
          <RefreshButton onRefresh={handleRefresh} isRefreshing={isRefreshing} className="shrink-0 self-start sm:self-center" />
        </div>
      </div>

      {/* 4 Main Modern Tabs */}
      <div className="mb-6 flex flex-wrap gap-2 rounded-xl border border-[#E6E6E6] bg-[#F7F7F7] p-1.5">
        <button
          type="button"
          onClick={() => setActiveTab("text")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all",
            activeTab === "text"
              ? "bg-[#E31E24] text-white shadow-sm"
              : "bg-transparent text-[#6B6B6B] hover:bg-white hover:text-[#1A1A1A]",
          )}
        >
          <FileText size={15} />
          <span>Website Text & Labels</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("coverage")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all",
            activeTab === "coverage"
              ? "bg-[#E31E24] text-white shadow-sm"
              : "bg-transparent text-[#6B6B6B] hover:bg-white hover:text-[#1A1A1A]",
          )}
        >
          <Layers size={15} />
          <span>Coverage Hub & CSV Sync</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ai")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all",
            activeTab === "ai"
              ? "bg-[#E31E24] text-white shadow-sm"
              : "bg-transparent text-[#6B6B6B] hover:bg-white hover:text-[#1A1A1A]",
          )}
        >
          <Bot size={15} />
          <span>AI Translation Studio</span>
          {reviewQueue.length > 0 && (
            <span className="ml-1 rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-black">
              {reviewQueue.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("languages")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-semibold transition-all",
            activeTab === "languages"
              ? "bg-[#E31E24] text-white shadow-sm"
              : "bg-transparent text-[#6B6B6B] hover:bg-white hover:text-[#1A1A1A]",
          )}
        >
          <Settings size={15} />
          <span>Languages & Protected Words</span>
        </button>
      </div>

      {/* TAB 1: WEBSITE TEXT & LABELS */}
      {activeTab === "text" && (
        <div className="space-y-6">
          {/* Top Control Bar: Language selection & summary */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="text-[13px] font-semibold text-[#1A1A1A] whitespace-nowrap">
                  Editing Language:
                </label>
                <div className="w-full sm:w-[280px]">
                  <AdminSelect
                    value={selectedStaticLanguage}
                    onChange={(e) => {
                      setSelectedStaticLanguage(e.target.value);
                      setStaticPage(1);
                    }}
                    options={[
                      { value: "", label: "Choose a language..." },
                      ...(languages as LanguageRow[]).map((l) => ({
                        value: l.id,
                        label: `${l.name} (${l.code.toUpperCase()})${l.isDefault ? " — Default English" : ""}`,
                      })),
                    ]}
                  />
                </div>
                {currentLanguage?.isDefault && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-[11.5px] font-medium text-blue-700">
                    <span>💡</span> Editing English custom overrides
                  </span>
                )}
              </div>

              {/* Stat badges */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="rounded-lg border border-[#EBEBEB] bg-[#FAFAFA] px-3.5 py-2 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#888]">Total Labels</span>
                  <p className="text-[16px] font-bold text-[#1A1A1A]">{allStaticKeywordEntries.length}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-2 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-green-700">
                    {currentLanguage?.isDefault ? "Customized" : "Translated"}
                  </span>
                  <p className="text-[16px] font-bold text-green-700">{translatedStaticCount}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-center">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-800">
                    {currentLanguage?.isDefault ? "Using Defaults" : "Needs Translation"}
                  </span>
                  <p className="text-[16px] font-bold text-amber-800">{missingStaticCount}</p>
                </div>
              </div>
            </div>

            {/* Section Filter Pills */}
            <div className="mt-5 border-t border-[#F0F0F0] pt-4">
              <div className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-[#888]">
                Browse by Website Section:
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSection("all");
                    setStaticPage(1);
                  }}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    selectedSection === "all"
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-xs"
                      : "border-[#E6E6E6] bg-white text-[#555] hover:border-[#CCC] hover:bg-[#F9F9F9]",
                  )}
                >
                  <span>🌟</span>
                  <span>All Sections</span>
                  <span className="ml-1 rounded-full bg-black/10 px-1.5 py-0.2 text-[11px]">
                    {sectionCounts.all || 0}
                  </span>
                </button>

                {STATIC_SECTIONS.map((sec) => (
                  <button
                    key={sec.id}
                    type="button"
                    onClick={() => {
                      setSelectedSection(sec.id);
                      setStaticPage(1);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                      selectedSection === sec.id
                        ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs"
                        : "border-[#E6E6E6] bg-white text-[#555] hover:border-[#CCC] hover:bg-[#F9F9F9]",
                    )}
                  >
                    <span>{sec.icon}</span>
                    <span>{sec.label}</span>
                    <span className={cn(
                      "ml-1 rounded-full px-1.5 py-0.2 text-[11px]",
                      selectedSection === sec.id ? "bg-white/20 text-white" : "bg-gray-100 text-[#666]"
                    )}>
                      {sectionCounts[sec.id] || 0}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Search & Status Filters */}
            <div className="mt-4 flex flex-col gap-3 border-t border-[#F0F0F0] pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-[480px]">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                <input
                  type="text"
                  value={staticSearch}
                  onChange={(e) => {
                    setStaticSearch(e.target.value);
                    setStaticPage(1);
                  }}
                  placeholder="Search by label name, English text, or custom value..."
                  className="h-10 w-full rounded-lg border border-[#E6E6E6] bg-white pl-9 pr-9 text-[13px] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                />
                {staticSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setStaticSearch("");
                      setStaticPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9A9A9A] hover:bg-[#F0F0F0] hover:text-[#1A1A1A]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStaticStatusFilter("all");
                    setStaticPage(1);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                    staticStatusFilter === "all"
                      ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                      : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CCC]",
                  )}
                >
                  All ({filteredStaticEntries.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStaticStatusFilter("missing");
                    setStaticPage(1);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                    staticStatusFilter === "missing"
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CCC]",
                  )}
                >
                  Needs Customization / Missing
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStaticStatusFilter("translated");
                    setStaticPage(1);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[12px] font-medium transition",
                    staticStatusFilter === "translated"
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CCC]",
                  )}
                >
                  Customized / Translated
                </button>
              </div>
            </div>
          </div>

          {/* Cards Grid: Intuitive Text Editor */}
          {filteredStaticEntries.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1 text-[12.5px] text-[#6B6B6B]">
                <span>
                  Showing {staticSkip + 1}–{Math.min(staticSkip + staticPageSize, filteredStaticEntries.length)} of {filteredStaticEntries.length} items
                </span>
                <label className="flex items-center gap-2 text-[12.5px] text-[#6B6B6B]">
                  Items per page:
                  <select
                    value={staticPageSize}
                    onChange={(e) => {
                      setStaticPageSize(Number(e.target.value) as (typeof STATIC_PAGE_SIZE_OPTIONS)[number]);
                      setStaticPage(1);
                    }}
                    className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2 text-[12px] text-[#1A1A1A] outline-none"
                  >
                    {STATIC_PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {paginatedStaticKeywordEntries.map(([key, defaultText]) => (
                  <StaticLabelCard
                    key={`${selectedStaticLanguage}-${key}`}
                    labelKey={key}
                    defaultText={defaultText}
                    savedValue={keywordMap.get(key) ?? ""}
                    isFlashed={savedKeyFlash === key}
                    isDefaultLang={Boolean(currentLanguage?.isDefault)}
                    langName={currentLanguage?.name || "Selected Language"}
                    selectedLanguageId={selectedStaticLanguage}
                    onSave={saveStaticKeyword}
                    onReset={resetStaticKeyword}
                  />
                ))}
              </div>

              {/* Pagination controls */}
              {staticTotalPages > 1 && (
                <div className="mt-6 flex flex-col gap-3 rounded-xl border border-[#E6E6E6] bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-[12.5px] text-[#6B6B6B]">
                    Page {normalizedStaticPage} of {staticTotalPages}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={normalizedStaticPage <= 1}
                      onClick={() => goToStaticPage(normalizedStaticPage - 1)}
                      className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] transition hover:border-[#CCC] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Previous
                    </button>
                    <div className="flex flex-wrap items-center gap-1">
                      {staticPaginationItems.map((item, index) =>
                        item === "ellipsis" ? (
                          <span key={`static-ellipsis-${index}`} className="px-2 text-[12.5px] text-[#9A9A9A]">
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => goToStaticPage(item)}
                            className={cn(
                              "h-8 min-w-8 rounded-md border px-2 text-[12.5px] font-semibold transition",
                              item === normalizedStaticPage
                                ? "border-[#E31E24] bg-[#E31E24] text-white"
                                : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CCC] hover:text-[#1A1A1A]",
                            )}
                          >
                            {item}
                          </button>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      disabled={normalizedStaticPage >= staticTotalPages}
                      onClick={() => goToStaticPage(normalizedStaticPage + 1)}
                      className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] transition hover:border-[#CCC] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#DDD] bg-white py-12 text-center">
              <p className="text-[14px] font-medium text-[#555]">No matching text labels found.</p>
              <p className="mt-1 text-[12.5px] text-[#999]">Try clearing your search query or choosing another section above.</p>
              {staticSearch && (
                <button
                  type="button"
                  onClick={() => setStaticSearch("")}
                  className="mt-3 rounded-md bg-[#1A1A1A] px-4 py-2 text-[12.5px] font-medium text-white hover:bg-[#333]"
                >
                  Clear Search
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: COVERAGE HUB & CSV SYNC */}
      {activeTab === "coverage" && (
        <div className="space-y-4">
          <TranslationCoverageHub
            languages={languages}
            canUpdate={canUpdate}
            canDelete={canDelete}
            canCreate={canCreate}
          />
        </div>
      )}

      {/* TAB 3: AI TRANSLATION STUDIO */}
      {activeTab === "ai" && (
        <div className="space-y-6">
          {/* AI Generator Box */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles size={17} className="text-[#E31E24]" />
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">1-Click AI Multilingual Generation</h3>
            </div>
            <p className="text-[13px] text-[#666] mb-4">
              Select a product to automatically generate translations across all enabled languages (titles, specifications, highlights, warranty, direction to use, and SEO keywords).
            </p>
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="flex-1">
                <AdminSelect
                  label="Select Product to Translate"
                  options={[
                    { value: "", label: "Choose a product..." },
                    ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title })),
                  ]}
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                />
              </div>
              <button
                onClick={generateForProduct}
                disabled={!selectedProduct}
                className="flex items-center justify-center gap-2 rounded-lg bg-[#1A1A1A] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-[#333] disabled:opacity-40 shadow-xs"
              >
                <Zap size={15} /> Generate for All Languages
              </button>
            </div>
            <div className="mt-4 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-[12.5px] text-blue-800">
              ℹ️ <strong>Safety Guarantee:</strong> AI outputs are automatically placed into the <strong>Review Queue</strong> below. They are never published to the live storefront until an admin approves them.
            </div>
          </div>

          {/* AI Review Queue */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-0.5">Translation Review Queue</h3>
                <p className="text-[13px] text-[#666]">Approve or reject generated translations before they go live on the storefront.</p>
              </div>
              {selectedReviewIds.length > 0 && (
                <button
                  onClick={bulkApprove}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-green-700 shadow-xs"
                >
                  <Check size={15} /> Approve Selected ({selectedReviewIds.length})
                </button>
              )}
            </div>

            {reviewQueue.length > 0 ? (
              <div className="space-y-3">
                {reviewQueue.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-[#E6E6E6] p-4 transition hover:border-[#D0D0D0] sm:flex-row sm:items-center"
                  >
                    <label className="flex items-start gap-3 sm:flex-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedReviewIds.includes(item.id)}
                        onChange={() => toggleReviewSelection(item.id)}
                        className="mt-1 h-4 w-4 rounded border-[#CCC] text-[#E31E24] focus:ring-[#E31E24]"
                      />
                      <div>
                        <div className="text-[14px] font-bold text-[#1A1A1A]">{item.product.title}</div>
                        <div className="mt-1 text-[13px] text-[#555]">
                          Language: <strong className="text-[#1A1A1A]">{item.language.name} ({item.language.code.toUpperCase()})</strong> · Translated Title: &quot;{item.title || "Untitled translation"}&quot;
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          {item.isAiGenerated && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-700">
                              🤖 AI Generated
                            </span>
                          )}
                          <Link
                            href={`/admin/products/${item.product.id}/edit`}
                            className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#E31E24] hover:underline"
                          >
                            Open Product <ExternalLink size={11} />
                          </Link>
                        </div>
                      </div>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                      <button
                        onClick={() => approveTranslation(item.id)}
                        className="rounded-lg border border-green-200 bg-green-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-green-700 hover:bg-green-100"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectTranslation(item.id)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-red-700 hover:bg-red-100"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#DDD] py-10 text-center">
                <p className="text-[14px] font-semibold text-[#444]">All caught up!</p>
                <p className="mt-1 text-[12.5px] text-[#888]">No pending translations waiting for review.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LANGUAGES & PROTECTED WORDS */}
      {activeTab === "languages" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Languages Manager */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[15px] font-bold text-[#1A1A1A]">Configured Storefront Languages</h3>
                <p className="text-[12.5px] text-[#666]">Enable or disable languages for the global customer switcher.</p>
              </div>
              <button
                onClick={() => setShowLangForm(!showLangForm)}
                className="flex items-center gap-1 rounded-lg border border-[#E31E24] bg-red-50 px-3 py-1.5 text-[12.5px] font-semibold text-[#E31E24] hover:bg-red-100"
              >
                {showLangForm ? <X size={14} /> : <Plus size={14} />}
                {showLangForm ? "Cancel" : "Add Language"}
              </button>
            </div>

            {showLangForm && (
              <div className="mb-4 rounded-xl border border-red-100 bg-red-50/50 p-4 space-y-3">
                <AdminInput label="Language Name" placeholder="e.g. Spanish" value={langName} onChange={(e) => setLangName(e.target.value)} />
                <AdminInput label="ISO Code" placeholder="e.g. es" maxLength={5} value={langCode} onChange={(e) => setLangCode(e.target.value)} />
                <button onClick={addLanguage} className="w-full rounded-lg bg-[#E31E24] py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                  Save Language
                </button>
              </div>
            )}

            <div className="space-y-2.5">
              {(languages as LanguageRow[]).map((l) => (
                <div key={l.id} className="rounded-xl border border-[#EAEAEA] p-3.5 transition hover:border-[#D6D6D6]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[14px] font-bold text-[#1A1A1A]">{l.name}</div>
                      <div className="text-[12px] font-mono text-[#888] uppercase">{l.code}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.isDefault && (
                        <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-semibold text-green-700">
                          Default English
                        </span>
                      )}
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                          l.isEnabled ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-500",
                        )}
                      >
                        {l.isEnabled ? "Active" : "Disabled"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-[#F4F4F4]">
                    {!l.isDefault && (
                      <button
                        type="button"
                        disabled={updatingLanguageId === l.id}
                        onClick={() => updateLanguage(l, { isDefault: true })}
                        className="rounded-md border border-[#DDD] px-2.5 py-1 text-[12px] font-medium text-[#555] hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-50"
                      >
                        Set as Default
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={l.isDefault || updatingLanguageId === l.id}
                      onClick={() => updateLanguage(l, { isEnabled: !l.isEnabled })}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-40",
                        l.isEnabled
                          ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-green-200 bg-green-50 text-green-800 hover:bg-green-100",
                      )}
                    >
                      {l.isEnabled ? "Disable" : "Enable"}
                    </button>
                    {!l.isDefault && (
                      <button
                        type="button"
                        disabled={updatingLanguageId === l.id}
                        onClick={() => deleteLanguage(l)}
                        className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Protected Brand Keywords */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
            <div className="mb-4">
              <h3 className="text-[15px] font-bold text-[#1A1A1A] mb-0.5 flex items-center gap-2">
                <Shield size={16} className="text-[#E31E24]" /> Protected Brand Words
              </h3>
              <p className="text-[12.5px] text-[#666]">
                Brand names, product codes, or medical terms that the AI translation must <strong>never translate</strong> into other languages.
              </p>
            </div>

            <div className="mb-4 space-y-2.5 rounded-xl border border-[#EAEAEA] bg-[#FAFAFA] p-3.5">
              <AdminInput label="Protected Word / Term" placeholder="e.g. Modern Orthodontics, Curio, etc." value={protectedTerm} onChange={(e) => setProtectedTerm(e.target.value)} />
              <AdminInput label="Note / Explanation (optional)" placeholder="e.g. Trademark brand name" value={protectedNote} onChange={(e) => setProtectedNote(e.target.value)} />
              <button
                onClick={addProtectedKeyword}
                disabled={!protectedTerm.trim()}
                className="w-full rounded-lg bg-[#1A1A1A] py-2 text-[13px] font-semibold text-white hover:bg-[#333] disabled:opacity-40"
              >
                Add Protected Term
              </button>
            </div>

            <div className="space-y-2">
              {protectedKeywords.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#E6E6E6] px-3.5 py-2.5 bg-white">
                  <div>
                    <div className="text-[13.5px] font-bold text-[#1A1A1A]">{item.term}</div>
                    {item.note && <div className="text-[12px] text-[#888]">{item.note}</div>}
                  </div>
                  <button
                    onClick={() => removeProtectedKeyword(item.id)}
                    className="rounded-md p-1.5 text-[#9A9A9A] hover:bg-red-50 hover:text-red-600 transition"
                    title="Remove term"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {protectedKeywords.length === 0 && (
                <div className="rounded-xl border border-dashed border-[#DDD] py-8 text-center text-[13px] text-[#999]">
                  No protected terms added yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {ToastComponent}
    </AdminLayout>
  );
}
