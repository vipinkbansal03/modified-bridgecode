"use client";
import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, StatusBadge, useToast, toastMessages } from "@/components/admin/AdminComponents";
import { TranslationCoverageHub } from "@/components/admin/TranslationCoverageHub";
import { cn } from "@/utils/cn";
import { useAdminLanguages, useAdminProducts } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { staticMessages, type StaticMessageKey } from "@/i18n/staticMessages";
import { Check, Plus, Shield, Trash2, X, Zap } from "lucide-react";

type KeywordRow = { id: string; key: StaticMessageKey; languageId: string; value: string };
type ReviewQueueItem = {
  id: string;
  title: string | null;
  status: string;
  isAiGenerated: boolean;
  language: { name: string; code: string };
  product: { id: string; title: string; slug: string; productCode: string | null };
};
type ProtectedKeywordRow = { id: string; term: string; note: string | null };

export default function TranslationsPage() {
  const [activeTab, setActiveTab] = useState<"hub" | "manage">("hub");
  const [showLangForm, setShowLangForm] = useState(false);
  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedStaticLanguage, setSelectedStaticLanguage] = useState("");
  const [protectedTerm, setProtectedTerm] = useState("");
  const [protectedNote, setProtectedNote] = useState("");
  const [selectedReviewIds, setSelectedReviewIds] = useState<string[]>([]);
  const { showToast, ToastComponent } = useToast();
  const { data: languages = [], refetch: refetchLangs } = useAdminLanguages();
  const { data: productsData } = useAdminProducts({ limit: 100 });
  const products = productsData?.data || [];
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

  const addLanguage = async () => {
    if (!langName || !langCode) return;
    try { await adminApi.post("/translations/languages", { name: langName, code: langCode.toLowerCase() }); showToast("Language added."); refetchLangs(); setLangName(""); setLangCode(""); setShowLangForm(false); }
    catch { showToast("Failed.", "error"); }
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

  return (
    <AdminLayout title="Translations" breadcrumb={[{ label: "Translations" }]}>
      <div className="mb-5 inline-flex rounded-lg border border-[#E6E6E6] bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveTab("hub")}
          className={cn(
            "rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
            activeTab === "hub" ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Coverage Hub
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("manage")}
          className={cn(
            "rounded-md px-4 py-2 text-[13px] font-medium transition-colors",
            activeTab === "manage" ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
          )}
        >
          Languages & Tools
        </button>
      </div>

      {activeTab === "hub" ? (
        <TranslationCoverageHub languages={languages} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
            {languages.map((l: { id: string; name: string; code: string; isDefault: boolean }) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-[#E6E6E6] px-3.5 py-2.5">
                <div><div className="text-[13.5px] font-medium">{l.name}</div><div className="text-[11.5px] text-[#9A9A9A] uppercase">{l.code}</div></div>
                {l.isDefault && <span className="text-[11px] text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">Default</span>}
              </div>
            ))}
            {languages.length === 0 && <p className="text-[13px] text-[#9A9A9A]">No languages configured yet.</p>}
          </div>
        </div>

        <div className="lg:col-span-2 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">AI Translation</h3>
          <p className="text-[12.5px] text-[#9A9A9A] mb-4">Generate translations for all enabled non-default languages. AI output is saved as pending review and is not published until approved.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <AdminSelect label="Select Product" options={[{ value: "", label: "Select a product…" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))]} value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} />
            </div>
            <button onClick={generateForProduct} disabled={!selectedProduct} className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40">
              <Zap size={14} /> Generate All Languages
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] text-amber-800">
            AI-generated translations enter the review queue below. Only approved translations are shown on the storefront.
          </div>
        </div>

        <div className="lg:col-span-3 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">Review Queue</h3>
              <p className="text-[12.5px] text-[#9A9A9A]">Approve or reject AI-generated product translations before they go live.</p>
            </div>
            {selectedReviewIds.length > 0 && (
              <button onClick={bulkApprove} className="flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-2 text-[13px] font-medium text-white hover:bg-green-700">
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
                  <div className="flex items-center gap-2 sm:ml-auto">
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

        <div className="lg:col-span-3 rounded-xl border border-[#E6E6E6] bg-white p-5">
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

        <div className="lg:col-span-3 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">Static UI Keywords</h3>
              <p className="text-[12.5px] text-[#9A9A9A]">Translate shared storefront labels like navigation, search, filters, footer, and product listing text.</p>
            </div>
            <div className="w-full sm:w-[260px]">
              <AdminSelect
                label="Language"
                value={selectedStaticLanguage}
                onChange={(e) => setSelectedStaticLanguage(e.target.value)}
                options={[{ value: "", label: "Select language..." }, ...languages.map((l: { id: string; name: string; code: string }) => ({ value: l.id, label: `${l.name} (${l.code})` }))]}
              />
            </div>
          </div>

          {selectedStaticLanguage ? (
            <div className="grid gap-3 md:grid-cols-2">
              {(Object.entries(staticMessages) as Array<[StaticMessageKey, string]>).map(([key, fallback]) => (
                <AdminInput
                  key={`${selectedStaticLanguage}-${key}-${keywordMap.get(key) ?? ""}`}
                  label={key}
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
