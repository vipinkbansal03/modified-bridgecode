"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminLanguages, useAdminProducts } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, X, Zap } from "lucide-react";

export default function TranslationsPage() {
  const [showLangForm, setShowLangForm] = useState(false);
  const [langName, setLangName] = useState("");
  const [langCode, setLangCode] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const { showToast, ToastComponent } = useToast();
  const { data: languages = [], refetch: refetchLangs } = useAdminLanguages();
  const { data: productsData } = useAdminProducts({ limit: 100 });
  const products = productsData?.data || [];

  const addLanguage = async () => {
    if (!langName || !langCode) return;
    try { await adminApi.post("/translations/languages", { name: langName, code: langCode.toLowerCase() }); showToast("Language added."); refetchLangs(); setLangName(""); setLangCode(""); setShowLangForm(false); }
    catch { showToast("Failed.", "error"); }
  };

  const generateForProduct = async () => {
    if (!selectedProduct) return;
    try { await adminApi.post("/translations/generate", { productId: selectedProduct }); showToast("AI generation queued. Connect OpenAI key in Settings > AI to enable."); }
    catch { showToast("Failed.", "error"); }
  };

  return (
    <AdminLayout title="Translations" breadcrumb={[{ label: "Translations" }]}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Languages panel */}
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

        {/* AI generation panel */}
        <div className="lg:col-span-2 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-1">AI Translation</h3>
          <p className="text-[12.5px] text-[#9A9A9A] mb-4">Select a product and generate translations for all enabled languages using the AI module. Requires OpenAI key in Settings.</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <AdminSelect label="Select Product" options={[{ value: "", label: "Select a product…" }, ...products.map((p: { id: string; title: string }) => ({ value: p.id, label: p.title }))]} value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} />
            </div>
            <button onClick={generateForProduct} disabled={!selectedProduct} className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2.5 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40">
              <Zap size={14} /> Generate All Languages
            </button>
          </div>
          <div className="mt-4 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-[13px] text-blue-700">
            AI-generated translations are marked as AI Generated and can be manually reviewed and edited on each product&apos;s Translations tab.
          </div>
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
