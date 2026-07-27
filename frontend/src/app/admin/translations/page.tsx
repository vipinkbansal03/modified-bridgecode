"use client";
import { useLayoutEffect, useState } from "react";
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
import { Check, Plus, Search, Shield, Trash2, X, Zap } from "lucide-react";

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

const STATIC_GROUP_FILTERS = [
  { value: "all", label: "All sections", prefixes: [] },
  { value: "ui.nav.", label: "Navigation", prefixes: ["ui.nav."] },
  { value: "ui.products.", label: "Products", prefixes: ["ui.products."] },
  { value: "ui.filters.", label: "Filters", prefixes: ["ui.filters."] },
  { value: "ui.search.", label: "Search", prefixes: ["ui.search."] },
  { value: "ui.footer.", label: "Footer", prefixes: ["ui.footer."] },
  { value: "ui.home.", label: "Home", prefixes: ["ui.home."] },
  { value: "ui.quality.", label: "Quality page", prefixes: ["ui.quality."] },
  { value: "ui.blog.", label: "Blog", prefixes: ["ui.blog."] },
  { value: "commerce", label: "Cart & quote", prefixes: ["ui.cart.", "ui.quote."] },
  { value: "ui.common.", label: "Common", prefixes: ["ui.common.", "ui.contactCta."] },
] as const;

const STATIC_STATUS_FILTERS: Array<{ value: StaticStatusFilter; label: string }> = [
  { value: "all", label: "All labels" },
  { value: "missing", label: "Needs translation" },
  { value: "translated", label: "Translated" },
];
const STATIC_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

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

  const [activeTab, setActiveTab] = useState<"hub" | "manage">("hub");
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
  const [staticGroupFilter, setStaticGroupFilter] = useState<(typeof STATIC_GROUP_FILTERS)[number]["value"]>("all");
  const [staticStatusFilter, setStaticStatusFilter] = useState<StaticStatusFilter>("all");
  const [staticPage, setStaticPage] = useState(1);
  const [staticPageSize, setStaticPageSize] = useState<(typeof STATIC_PAGE_SIZE_OPTIONS)[number]>(25);
  const { showToast, ToastComponent } = useToast();
  const { data: languages = [], refetch: refetchLangs } = useAdminLanguages();
  const { data: productsData } = useAdminProducts({ limit: 100 });
  const products = productsData?.data || [];
  const translationLanguages = (languages as LanguageRow[]).filter((language) => !language.isDefault);
  const { data: keywordRows = [], refetch: refetchKeywords } = useQuery({
    queryKey: ["admin-static-keywords", selectedStaticLanguage],
    queryFn: () => adminApi.get("/translations/keywords", { params: { languageId: selectedStaticLanguage } }).then((r) => r.data.data as KeywordRow[]),
    enabled: !!selectedStaticLanguage,
  });
  const { data: reviewQueue = [], refetch: refetchReviewQueue } = useQuery({
    queryKey: ["admin-translation-review-queue"],
    queryFn: () => adminApi.get("/translations/review-queue").then((r) => r.data.data as ReviewQueueItem[]),
  });
  const { data: protectedKeywords = [], refetch: refetchProtectedKeywords } = useQuery({
    queryKey: ["admin-protected-keywords"],
    queryFn: () => adminApi.get("/translations/protected-keywords").then((r) => r.data.data as ProtectedKeywordRow[]),
  });

  const keywordMap = new Map(keywordRows.map((row) => [row.key, row.value]));
  const allStaticKeywordEntries = Object.entries(staticMessages) as Array<[StaticMessageKey, string]>;
  const selectedStaticGroup = STATIC_GROUP_FILTERS.find((group) => group.value === staticGroupFilter) ?? STATIC_GROUP_FILTERS[0];
  const translatedStaticCount = allStaticKeywordEntries.filter(([key]) => Boolean((keywordMap.get(key) ?? "").trim())).length;
  const missingStaticCount = selectedStaticLanguage ? allStaticKeywordEntries.length - translatedStaticCount : 0;
  const staticCompletion = selectedStaticLanguage
    ? Math.round((translatedStaticCount / Math.max(allStaticKeywordEntries.length, 1)) * 100)
    : 0;
  const staticKeywordEntries = allStaticKeywordEntries.filter(([key, fallback]) => {
    const query = staticSearch.trim().toLowerCase();
    const savedValue = keywordMap.get(key) ?? "";
    const hasTranslation = Boolean(savedValue.trim());
    const matchesGroup =
      selectedStaticGroup.value === "all" || selectedStaticGroup.prefixes.some((prefix) => key.startsWith(prefix));
    const matchesStatus =
      staticStatusFilter === "all" ||
      (staticStatusFilter === "missing" && !hasTranslation) ||
      (staticStatusFilter === "translated" && hasTranslation);
    const matchesSearch = !query || `${key} ${fallback} ${savedValue}`.toLowerCase().includes(query);

    return matchesGroup && matchesStatus && matchesSearch;
  });
  const staticTotalPages = Math.max(1, Math.ceil(staticKeywordEntries.length / staticPageSize));
  const normalizedStaticPage = Math.min(staticPage, staticTotalPages);
  const staticSkip = (normalizedStaticPage - 1) * staticPageSize;
  const paginatedStaticKeywordEntries = staticKeywordEntries.slice(staticSkip, staticSkip + staticPageSize);
  const staticPaginationItems = getPaginationItems(normalizedStaticPage, staticTotalPages);

  const goToStaticPage = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), staticTotalPages);
    setStaticPage(nextPage);
  };

  const addLanguage = async () => {
    if (!langName || !langCode) return;
    try { await adminApi.post("/translations/languages", { name: langName, code: langCode.toLowerCase() }); showToast("Language added."); refetchLangs(); setLangName(""); setLangCode(""); setShowLangForm(false); }
    catch (error) { showToast(getAdminErrorMessage(error, "Failed to add language."), "error"); }
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
      showToast(toastMessages.staticLabelSaved);
      refetchKeywords();
    } catch {
      showToast(toastMessages.translationFailed, "error");
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
    <AdminLayout title="Translations" breadcrumb={[{ label: "Translations" }]}>
      <div className="mb-5 flex w-full rounded-lg border border-[#E6E6E6] bg-white p-1 sm:inline-flex sm:w-auto">
        <button
          type="button"
          onClick={() => setActiveTab("hub")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors sm:flex-none",
            activeTab === "hub" ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Coverage Hub
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={cn(
            "flex-1 rounded-md px-4 py-2 text-[13px] font-medium transition-colors sm:flex-none",
            activeTab === "manage" ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Languages & Tools
        </button>
      </div>

      {activeTab === "hub" ? (
        <TranslationCoverageHub languages={languages} canUpdate={canUpdate} canDelete={canDelete} canCreate={canCreate} />
      ) : (
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Languages</h3>
            <button onClick={() => setShowLangForm(!showLangForm)} className="flex items-center gap-1 text-[12.5px] text-[#E31E24]">{showLangForm ? <X size={13} /> : <Plus size={13} />}{showLangForm ? "Cancel" : "Add"}</button>
          </div>
          {showLangForm && (
            <div className="mb-4 space-y-2.5">
              <AdminInput label="Language Name" placeholder="Arabic" value={langName} onChange={(e) => setLangName(e.target.value)} />
              <AdminInput label="ISO Code" placeholder="ar" maxLength={5} value={langCode} onChange={(e) => setLangCode(e.target.value)} />
              <button onClick={addLanguage} className="w-full rounded-md bg-[#E31E24] py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">Add Language</button>
            </div>
          )}
          <div className="space-y-2">
            {(languages as LanguageRow[]).map((l) => (
              <div key={l.id} className="rounded-lg border border-[#E6E6E6] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13.5px] font-medium text-[#1A1A1A]">{l.name}</div>
                    <div className="text-[11.5px] uppercase text-[#9A9A9A]">{l.code}</div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {l.isDefault && <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] text-green-600">Default</span>}
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[11px]",
                      l.isEnabled ? "border-blue-200 bg-blue-50 text-blue-600" : "border-[#E6E6E6] bg-[#F7F7F7] text-[#9A9A9A]",
                    )}>
                      {l.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {!l.isDefault && (
                    <button
                      type="button"
                      disabled={updatingLanguageId === l.id}
                      onClick={() => updateLanguage(l, { isDefault: true })}
                      className="rounded-md border border-[#E6E6E6] px-2.5 py-1.5 text-[12px] font-medium text-[#6B6B6B] hover:border-[#E31E24] hover:text-[#E31E24] disabled:opacity-50"
                    >
                      Set default
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={l.isDefault || updatingLanguageId === l.id}
                    onClick={() => updateLanguage(l, { isEnabled: !l.isEnabled })}
                    className={cn(
                      "rounded-md border px-2.5 py-1.5 text-[12px] font-medium disabled:cursor-not-allowed disabled:opacity-45",
                      l.isEnabled
                        ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
                    )}
                  >
                    {l.isEnabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            ))}
            {languages.length === 0 && <p className="text-[13px] text-[#9A9A9A]">No languages configured yet.</p>}
          </div>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 xl:col-span-2">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">AI Translation</h3>
          <p className="text-[12.5px] text-[#9A9A9A] mb-4">Generate translations for all enabled non-default languages. AI output is saved as pending review and is not published until approved.</p>
          <div className="flex flex-col gap-3 md:flex-row md:items-end">
            <div className="flex-1">
              <AdminSelect label="Select Product" options={[{ value: "", label: "Select a product…" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))]} value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} />
            </div>
            <button onClick={generateForProduct} disabled={!selectedProduct} className="flex items-center justify-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40">
              <Zap size={14} /> Generate All Languages
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
            AI-generated translations enter the review queue below. Only approved translations are shown on the storefront.
          </div>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 xl:col-span-3">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">Review Queue</h3>
              <p className="text-[12.5px] text-[#9A9A9A]">Approve or reject AI-generated product translations before they go live.</p>
            </div>
            {selectedReviewIds.length > 0 && (
              <button onClick={bulkApprove} className="flex items-center justify-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-green-700">
                <Check size={14} /> Approve Selected ({selectedReviewIds.length})
              </button>
            )}
          </div>

          {reviewQueue.length > 0 ? (
            <div className="space-y-3">
              {reviewQueue.map((item) => (
                <div key={item.id} className="flex flex-col gap-3 rounded-lg border border-[#E6E6E6] p-4 sm:flex-row sm:items-center">
                  <label className="flex items-start gap-3 sm:flex-1">
                    <input
                      type="checkbox"
                      checked={selectedReviewIds.includes(item.id)}
                      onChange={() => toggleReviewSelection(item.id)}
                      className="mt-1"
                    />
                    <div>
                      <div className="text-[13.5px] font-medium text-[#1A1A1A]">{item.product.title}</div>
                      <div className="mt-1 text-[12.5px] text-[#6B6B6B]">
                        {item.language.name} ({item.language.code.toUpperCase()}) · {item.title || "Untitled translation"}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <StatusBadge status={item.status} />
                        {item.isAiGenerated && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">AI Generated</span>}
                        <Link href={`/admin/products/${item.product.id}/edit`} className="text-[12px] text-[#E31E24] hover:underline">
                          Open product
                        </Link>
                      </div>
                    </div>
                  </label>
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    <button onClick={() => approveTranslation(item.id)} className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-[12.5px] font-medium text-green-700 hover:bg-green-100">
                      Approve
                    </button>
                    <button onClick={() => rejectTranslation(item.id)} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[12.5px] font-medium text-red-700 hover:bg-red-100">
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#E6E6E6] py-8 text-center text-[13px] text-[#9A9A9A]">
              No translations waiting for review.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 xl:col-span-3">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1 flex items-center gap-2">
              <Shield size={15} /> Protected Keywords
            </h3>
            <p className="text-[12.5px] text-[#9A9A9A]">Brand names and protected terms that AI translation must never translate.</p>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <AdminInput label="Protected Term" placeholder="Modern Orthodontics" value={protectedTerm} onChange={(e) => setProtectedTerm(e.target.value)} />
            <AdminInput label="Note (optional)" placeholder="Company brand name" value={protectedNote} onChange={(e) => setProtectedNote(e.target.value)} />
            <button onClick={addProtectedKeyword} disabled={!protectedTerm.trim()} className="rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40">
              Add Term
            </button>
          </div>
          <div className="space-y-2">
            {protectedKeywords.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-lg border border-[#E6E6E6] px-4 py-3">
                <div>
                  <div className="text-[13.5px] font-medium text-[#1A1A1A]">{item.term}</div>
                  {item.note && <div className="text-[12px] text-[#9A9A9A]">{item.note}</div>}
                </div>
                <button onClick={() => removeProtectedKeyword(item.id)} className="rounded-md border border-[#E6E6E6] p-2 text-[#9A9A9A] hover:border-red-200 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {protectedKeywords.length === 0 && (
              <div className="rounded-lg border border-dashed border-[#E6E6E6] py-6 text-center text-[13px] text-[#9A9A9A]">
                No protected keywords configured yet.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 xl:col-span-3">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">Static UI Keywords</h3>
              <p className="text-[12.5px] text-[#9A9A9A]">Translate shared storefront labels like navigation, search, filters, footer, and product listing text.</p>
              <p className="mt-1 text-[12px] text-[#9A9A9A]">
                Use this editor for already translated labels too. Changes are saved when you leave an input field.
              </p>
            </div>
            <div className="w-full sm:w-[260px]">
              <AdminSelect
                label="Language"
                value={selectedStaticLanguage}
                onChange={(e) => {
                  setSelectedStaticLanguage(e.target.value);
                  setStaticSearch("");
                  setStaticGroupFilter("all");
                  setStaticStatusFilter("all");
                  setStaticPage(1);
                }}
                options={[{ value: "", label: "Select language..." }, ...translationLanguages.map((l) => ({ value: l.id, label: `${l.name} (${l.code})` }))]}
              />
            </div>
          </div>

          {selectedStaticLanguage ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A9A9A]">Completion</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-[26px] font-semibold text-[#1A1A1A]">{staticCompletion}%</span>
                    <span className="text-[12px] text-[#6B6B6B]">
                      {translatedStaticCount}/{allStaticKeywordEntries.length}
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-[#EDEDED]">
                    <div className="h-full rounded-full bg-[#E31E24]" style={{ width: `${staticCompletion}%` }} />
                  </div>
                </div>
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9A9A9A]">Needs work</p>
                  <p className="mt-2 text-[26px] font-semibold text-[#1A1A1A]">{missingStaticCount}</p>
                  <p className="mt-1 text-[12px] text-[#9A9A9A]">Missing static labels</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-green-700">Translated</p>
                  <p className="mt-2 text-[26px] font-semibold text-green-700">{translatedStaticCount}</p>
                  <p className="mt-1 text-[12px] text-green-700/75">Ready to show on storefront</p>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] p-3">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <label className="relative w-full xl:max-w-[460px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      type="text"
                      value={staticSearch}
                      onChange={(e) => {
                        setStaticSearch(e.target.value);
                        setStaticPage(1);
                      }}
                      placeholder="Search key, English text, or translated value..."
                      className="h-10 w-full rounded-lg border border-[#E6E6E6] bg-white pl-9 pr-9 text-[13px] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                    />
                    {staticSearch && (
                      <button
                        type="button"
                        onClick={() => {
                          setStaticSearch("");
                          setStaticPage(1);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9A9A9A] hover:bg-[#F0F0F0] hover:text-[#1A1A1A]"
                        aria-label="Clear static UI search"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </label>
                  <span className="text-[12.5px] text-[#6B6B6B]">
                    Showing {staticKeywordEntries.length} of {allStaticKeywordEntries.length} labels
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EDEDED] pt-3">
                  <span className="text-[12.5px] text-[#6B6B6B]">
                    {staticKeywordEntries.length > 0
                      ? `Showing ${staticSkip + 1}-${Math.min(staticSkip + staticPageSize, staticKeywordEntries.length)} of ${staticKeywordEntries.length}`
                      : "No labels in this view"}
                  </span>
                  <label className="flex items-center gap-2 text-[12.5px] text-[#6B6B6B]">
                    Show
                    <select
                      value={staticPageSize}
                      onChange={(event) => {
                        setStaticPageSize(Number(event.target.value) as (typeof STATIC_PAGE_SIZE_OPTIONS)[number]);
                        setStaticPage(1);
                      }}
                      className="h-9 cursor-pointer rounded-lg border border-[#E6E6E6] bg-white px-2 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                    >
                      {STATIC_PAGE_SIZE_OPTIONS.map((option) => (
                        <option key={option} value={option} className="cursor-pointer">
                          {option}
                        </option>
                      ))}
                    </select>
                    items
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {STATIC_GROUP_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => {
                        setStaticGroupFilter(filter.value);
                        setStaticPage(1);
                      }}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                        staticGroupFilter === filter.value
                          ? "border-[#1A1A1A] bg-[#1A1A1A] text-white"
                          : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CFCFCF]",
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-[#EDEDED] pt-3">
                  {STATIC_STATUS_FILTERS.map((filter) => (
                    <button
                      key={filter.value}
                      type="button"
                      onClick={() => {
                        setStaticStatusFilter(filter.value);
                        setStaticPage(1);
                      }}
                      className={cn(
                        "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                        staticStatusFilter === filter.value
                          ? "border-[#E31E24] bg-[#E31E24] text-white"
                          : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#CFCFCF]",
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {staticKeywordEntries.length > 0 ? (
                <>
                <div className="grid gap-3 xl:grid-cols-2">
                  {paginatedStaticKeywordEntries.map(([key, fallback]) => (
                    <AdminInput
                      key={`${selectedStaticLanguage}-${key}-${keywordMap.get(key) ?? ""}`}
                      label={`${key} · English: ${fallback}`}
                      defaultValue={keywordMap.get(key) ?? ""}
                      placeholder={fallback}
                      onBlur={(e) => {
                        const value = e.currentTarget.value.trim();
                        const saved = (keywordMap.get(key) ?? "").trim();
                        if (value === saved) {
                          showToast(toastMessages.noChanges, "info");
                          return;
                        }
                        saveStaticKeyword(key, value);
                      }}
                    />
                  ))}
                </div>
                {staticTotalPages > 1 && (
                  <div className="flex flex-col gap-3 rounded-xl border border-[#F0F0F0] bg-[#FAFAFA] p-3 lg:flex-row lg:items-center lg:justify-between">
                    <p className="text-[12.5px] text-[#6B6B6B]">
                      Page {normalizedStaticPage} of {staticTotalPages}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={normalizedStaticPage <= 1}
                        onClick={() => goToStaticPage(normalizedStaticPage - 1)}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] text-[#1A1A1A] transition hover:border-[#CFCFCF] disabled:cursor-not-allowed disabled:opacity-40"
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
                                "h-8 min-w-8 rounded-md border px-2 text-[12.5px] font-medium transition",
                                item === normalizedStaticPage
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
                        disabled={normalizedStaticPage >= staticTotalPages}
                        onClick={() => goToStaticPage(normalizedStaticPage + 1)}
                        className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] text-[#1A1A1A] transition hover:border-[#CFCFCF] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>
                      <form
                        className="flex items-center gap-2"
                        onSubmit={(event) => {
                          event.preventDefault();
                          const formData = new FormData(event.currentTarget);
                          const pageValue = Number(formData.get("page"));

                          if (Number.isFinite(pageValue)) {
                            goToStaticPage(pageValue);
                          }
                        }}
                      >
                        <span className="text-[12.5px] text-[#9A9A9A]">Go to</span>
                        <input
                          key={normalizedStaticPage}
                          name="page"
                          type="number"
                          min={1}
                          max={staticTotalPages}
                          defaultValue={normalizedStaticPage}
                          className="h-8 w-16 rounded-md border border-[#E6E6E6] bg-white px-2 text-center text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
                        />
                      </form>
                    </div>
                  </div>
                )}
                </>
              ) : (
                <div className="rounded-lg border border-dashed border-[#E6E6E6] py-8 text-center text-[13px] text-[#9A9A9A]">
                  No static labels found for “{staticSearch}”.
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#E6E6E6] py-8 text-center text-[13px] text-[#9A9A9A]">
              Select a language to edit static UI labels.
            </div>
          )}
        </div>
      </div>
      )}
      {ToastComponent}
    </AdminLayout>
  );
}
