"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast, toastMessages } from "@/components/admin/AdminComponents";
import {
  filterTranslationLanguages,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  TranslationModeBar,
  NoTranslationLanguagesMessage,
} from "@/components/admin/TranslationEditorUi";
import { useAdminCmsFooter, useUpsertCmsFooter, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type FooterData = { id?: string; title?: string; description?: string; email?: string; phone?: string; address?: string; status: string; translations?: CmsTranslations };

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((item) => item.languageId === languageId)?.value ?? "";
}

export default function CmsFooterPage() {
  const { data: footer, isLoading, refetch } = useAdminCmsFooter();
  const { data: languages = [] } = useAdminLanguages();
  const upsert = useUpsertCmsFooter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FooterData>({ title: "", description: "", email: "", phone: "", address: "", status: "ACTIVE" });
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState<"content" | "translations">("content");
  const [translationLanguageId, setTranslationLanguageId] = useState("");

  const translationLanguages = filterTranslationLanguages(languages);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

  useEffect(() => {
    if (footer) {
      setForm({
        title: footer.title ?? "",
        description: footer.description ?? "",
        email: footer.email ?? "",
        phone: footer.phone ?? "",
        address: footer.address ?? "",
        status: footer.status ?? "ACTIVE",
      });
    }
  }, [footer]);

  useEffect(() => {
    if (translationLanguages.length && !translationLanguageId) {
      setTranslationLanguageId(translationLanguages[0].id);
    }
  }, [translationLanguages, translationLanguageId]);

  function set(k: string, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsert.mutateAsync(form);
      showToast("Footer saved.", "success");
      setDirty(false);
    } catch {
      showToast("Save failed.", "error");
    }
  }

  async function saveTranslation(languageId: string, field: "title" | "description" | "address", value: string) {
    if (!footer?.id) return;
    try {
      await adminApi.put(`/cms/translations/footer/${footer.id}/${languageId}`, { [field]: value });
      showToast(toastMessages.translationSaved, "success");
      refetch();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  }

  if (isLoading) {
    return (
      <AdminLayout title="Footer" breadcrumb={[{ label: "Content" }, { label: "Footer" }]}>
        <div className="text-sm text-gray-500">Loading…</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Footer Settings" breadcrumb={[{ label: "Content" }, { label: "Footer" }]}>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <TranslationModeBar
          editorTab={editorTab}
          onTabChange={setEditorTab}
          translationLanguages={translationLanguages}
          selectedLanguageId={translationLanguageId}
          onLanguageChange={setTranslationLanguageId}
        />

        {editorTab === "content" && (
          <>
            <AdminInput label="Site Name / Title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Modern Orthodontics" />
            <AdminTextarea label="Tagline / Description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} />
            <AdminInput label="Email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="orders@modortho.com" />
            <AdminInput label="Phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            <AdminTextarea label="Address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} rows={2} />
            <AdminSelect
              label="Status"
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <button
              type="submit"
              disabled={upsert.isPending || !dirty}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              {upsert.isPending ? "Saving…" : "Save Footer"}
            </button>
          </>
        )}

        {editorTab === "translations" && footer?.id && (
          translationLanguages.length === 0 ? (
            <NoTranslationLanguagesMessage />
          ) : activeTranslationLang ? (
            <div className="space-y-4">
              <TranslationEditorBanner language={activeTranslationLang} />
              <TranslationBlurInput
                key={`title-${activeTranslationLang.id}-${translationValue(footer.translations, "title", activeTranslationLang.id)}`}
                label="Site Name / Title"
                defaultValue={translationValue(footer.translations, "title", activeTranslationLang.id)}
                englishReference={footer.title || "Modern Orthodontics"}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "title", value)}
              />
              <TranslationBlurField
                key={`description-${activeTranslationLang.id}-${translationValue(footer.translations, "description", activeTranslationLang.id)}`}
                label="Tagline / Description"
                rows={2}
                defaultValue={translationValue(footer.translations, "description", activeTranslationLang.id)}
                englishReference={footer.description || ""}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "description", value)}
              />
              <TranslationBlurField
                key={`address-${activeTranslationLang.id}-${translationValue(footer.translations, "address", activeTranslationLang.id)}`}
                label="Address"
                rows={2}
                defaultValue={translationValue(footer.translations, "address", activeTranslationLang.id)}
                englishReference={footer.address || ""}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "address", value)}
              />
              <p className="text-[12px] text-[#9A9A9A]">Email and phone are shared across all languages.</p>
            </div>
          ) : null
        )}
      </form>
    </AdminLayout>
  );
}
