"use client";

import { useEffect, useState } from "react";
import { AdminInput, AdminSelect, AdminTextarea, useToast, toastMessages, LoadingButton } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  NoTranslationLanguagesMessage,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  TranslationModeBar,
  filterTranslationLanguages,
} from "@/components/admin/TranslationEditorUi";
import { useAdminCmsFooter, useAdminCmsMenus, useAdminLanguages, useUpsertCmsFooter } from "@/hooks/admin/useAdminHooks";
import { CMS_MENU_LOCATIONS, parseFooterSocialLinks } from "@/lib/cmsNavigation";
import { adminApi } from "@/services/adminApi";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type FooterData = {
  id?: string;
  title?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  logo?: string;
  socialLinksJson?: {
    facebook?: string;
    linkedin?: string;
    twitter?: string;
    instagram?: string;
  };
  newsletterEnabled?: boolean;
  status: string;
  translations?: CmsTranslations;
};

type MenuItem = {
  id: string;
  label: string;
  url: string;
  sortOrder: number;
  parentId?: string | null;
  openInNewTab?: boolean;
  status?: string;
};

type Menu = { id: string; name: string; location: string; status: string; items: MenuItem[] };

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((item) => item.languageId === languageId)?.value ?? "";
}

function menuLabel(location: string) {
  return CMS_MENU_LOCATIONS.find((item) => item.value === location)?.label ?? location;
}

function normalizeMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    url: item.url ?? "",
    parentId: item.parentId ?? null,
    openInNewTab: Boolean(item.openInNewTab),
    status: item.status ?? "ACTIVE",
  };
}

export default function CmsFooterPage() {
  const { data: footer, isLoading, refetch } = useAdminCmsFooter();
  const { data: menus = [] } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const upsert = useUpsertCmsFooter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FooterData>({
    title: "",
    description: "",
    email: "",
    phone: "",
    address: "",
    logo: "",
    socialLinksJson: { facebook: "", linkedin: "", twitter: "", instagram: "" },
    newsletterEnabled: true,
    status: "ACTIVE",
  });
  const [dirty, setDirty] = useState(false);
  const [editorTab, setEditorTab] = useState<"content" | "translations">("content");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [menuDrafts, setMenuDrafts] = useState<Record<string, MenuItem[]>>({});

  const translationLanguages = filterTranslationLanguages(languages);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

  useEffect(() => {
    if (!footer) return;

    const socialLinks = parseFooterSocialLinks(footer.socialLinksJson);
    setForm({
      title: footer.title ?? "",
      description: footer.description ?? "",
      email: footer.email ?? "",
      phone: footer.phone ?? "",
      address: footer.address ?? "",
      logo: footer.logo ?? "",
      socialLinksJson: {
        facebook: socialLinks.facebook ?? "",
        linkedin: socialLinks.linkedin ?? "",
        twitter: socialLinks.twitter ?? "",
        instagram: socialLinks.instagram ?? "",
      },
      newsletterEnabled: footer.newsletterEnabled ?? true,
      status: footer.status ?? "ACTIVE",
    });
    setDirty(false);
  }, [footer]);

  useEffect(() => {
    const nextDrafts: Record<string, MenuItem[]> = {};
    for (const menu of menus as Menu[]) {
      if (
        menu.location === "footer-india-office" ||
        menu.location === "footer-usa-office" ||
        menu.location === "footer-legal" ||
        menu.location === "footer-export"
      ) {
        nextDrafts[menu.location] = menu.items.map(normalizeMenuItem);
      }
    }
    setMenuDrafts((current) => ({ ...current, ...nextDrafts }));
  }, [menus]);

  useEffect(() => {
    if (translationLanguages.length && !translationLanguageId) {
      setTranslationLanguageId(translationLanguages[0].id);
    }
  }, [translationLanguages, translationLanguageId]);

  function setField<K extends keyof FooterData>(key: K, value: FooterData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
  }

  function setSocialField(key: "facebook" | "linkedin" | "twitter" | "instagram", value: string) {
    setForm((current) => ({
      ...current,
      socialLinksJson: {
        facebook: current.socialLinksJson?.facebook ?? "",
        linkedin: current.socialLinksJson?.linkedin ?? "",
        twitter: current.socialLinksJson?.twitter ?? "",
        instagram: current.socialLinksJson?.instagram ?? "",
        [key]: value,
      },
    }));
    setDirty(true);
  }

  function updateMenuItem(location: string, itemId: string, patch: Partial<MenuItem>) {
    setMenuDrafts((current) => ({
      ...current,
      [location]: (current[location] ?? []).map((item) => (item.id === itemId ? normalizeMenuItem({ ...item, ...patch }) : item)),
    }));
  }

  async function saveMenuItem(location: string, item: MenuItem) {
    try {
      await adminApi.put(`/cms/menu-items/${item.id}`, {
        label: item.label.trim(),
        url: item.url.trim(),
        parentId: item.parentId || null,
        sortOrder: item.sortOrder,
        openInNewTab: Boolean(item.openInNewTab),
        status: item.status ?? "ACTIVE",
      });
      showToast(`${menuLabel(location)} saved.`, "success");
      refetch();
    } catch {
      showToast(`Failed to save ${menuLabel(location)}.`, "error");
    }
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
        <div className="text-sm text-gray-500">Loading...</div>
      </AdminLayout>
    );
  }

  const editLocations = ["footer-india-office", "footer-usa-office", "footer-legal", "footer-export"] as const;

  return (
    <AdminLayout title="Footer Settings" breadcrumb={[{ label: "Content" }, { label: "Footer" }]}>
      {/* <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        This screen controls footer branding, newsletter text, fallback contact details, and quick-edit links for office/legal menu rows. The full menu structure still lives under Menus.
      </div> */}

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-5">
        <TranslationModeBar
          editorTab={editorTab}
          onTabChange={setEditorTab}
          translationLanguages={translationLanguages}
          selectedLanguageId={translationLanguageId}
          onLanguageChange={setTranslationLanguageId}
        />

        {editorTab === "content" && (
          <>
            <AdminInput
              label="Logo URL"
              value={form.logo ?? ""}
              onChange={(e) => setField("logo", e.target.value)}
              placeholder="/images/footer-logo.svg"
            />
            <AdminInput
              label="Copyright / Footer Title"
              value={form.title ?? ""}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Modern Orthodontics. All rights reserved."
            />
            <AdminTextarea
              label="Newsletter Text"
              value={form.description ?? ""}
              onChange={(e) => setField("description", e.target.value)}
              rows={2}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput label="Fallback Email" value={form.email ?? ""} onChange={(e) => setField("email", e.target.value)} placeholder="orders@modortho.com" />
              <AdminInput label="Fallback Phone" value={form.phone ?? ""} onChange={(e) => setField("phone", e.target.value)} />
            </div>
            <AdminTextarea label="Fallback Address" value={form.address ?? ""} onChange={(e) => setField("address", e.target.value)} rows={2} />

            <div className="rounded-xl border border-gray-200 p-4">
              <p className="mb-3 text-sm font-medium text-gray-700">Social Links</p>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInput label="Facebook" value={form.socialLinksJson?.facebook ?? ""} onChange={(e) => setSocialField("facebook", e.target.value)} placeholder="https://facebook.com/..." />
                <AdminInput label="LinkedIn" value={form.socialLinksJson?.linkedin ?? ""} onChange={(e) => setSocialField("linkedin", e.target.value)} placeholder="https://linkedin.com/..." />
                <AdminInput label="X / Twitter" value={form.socialLinksJson?.twitter ?? ""} onChange={(e) => setSocialField("twitter", e.target.value)} placeholder="https://x.com/..." />
                <AdminInput label="Instagram" value={form.socialLinksJson?.instagram ?? ""} onChange={(e) => setSocialField("instagram", e.target.value)} placeholder="https://instagram.com/..." />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelect
                label="Newsletter Enabled"
                value={form.newsletterEnabled ? "true" : "false"}
                onChange={(e) => setField("newsletterEnabled", e.target.value === "true")}
                options={[
                  { value: "true", label: "Enabled" },
                  { value: "false", label: "Disabled" },
                ]}
              />
              <AdminSelect
                label="Status"
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
            </div>

            <div className="space-y-4 rounded-xl border border-gray-200 p-4">
              <div>
                <p className="text-sm font-medium text-gray-800">Office and legal links</p>
                <p className="text-xs text-gray-500">Edits here update the menu locations used by the live footer.</p>
              </div>

              {editLocations.map((location) => {
                const items = menuDrafts[location] ?? [];
                return (
                  <div key={location} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-gray-800">{menuLabel(location)}</p>
                        <p className="text-xs text-gray-500">{location}</p>
                      </div>
                    </div>

                    {items.length === 0 ? (
                      <p className="text-xs text-gray-500">No items found. Add this menu in Menus first.</p>
                    ) : (
                      <div className="space-y-3">
                        {items.map((item) => (
                          <div key={item.id} className="grid gap-3 md:grid-cols-[1.3fr_1.7fr_auto]">
                            <AdminInput
                              label="Label"
                              value={item.label}
                              onChange={(e) => updateMenuItem(location, item.id, { label: e.target.value })}
                            />
                            <AdminInput
                              label="URL"
                              value={item.url}
                              onChange={(e) => updateMenuItem(location, item.id, { url: e.target.value })}
                              placeholder="Leave blank for plain text rows"
                            />
                            <div className="flex items-end">
                              <button
                                type="button"
                                onClick={() => saveMenuItem(location, item)}
                                className="mb-0.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <LoadingButton
              type="submit"
              loading={upsert.isPending}
              loadingText="Saving..."
              disabled={!dirty}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand/90 disabled:opacity-50"
            >
              Save Footer
            </LoadingButton>
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
                label="Copyright / Footer Title"
                defaultValue={translationValue(footer.translations, "title", activeTranslationLang.id)}
                englishReference={footer.title || ""}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "title", value)}
              />
              <TranslationBlurField
                key={`description-${activeTranslationLang.id}-${translationValue(footer.translations, "description", activeTranslationLang.id)}`}
                label="Newsletter Text"
                rows={2}
                defaultValue={translationValue(footer.translations, "description", activeTranslationLang.id)}
                englishReference={footer.description || ""}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "description", value)}
              />
              <TranslationBlurField
                key={`address-${activeTranslationLang.id}-${translationValue(footer.translations, "address", activeTranslationLang.id)}`}
                label="Fallback Address"
                rows={2}
                defaultValue={translationValue(footer.translations, "address", activeTranslationLang.id)}
                englishReference={footer.address || ""}
                onSave={(value) => saveTranslation(activeTranslationLang.id, "address", value)}
              />
              <p className="text-[12px] text-[#9A9A9A]">Email, phone, logo, newsletter toggle, and social links are shared across all languages.</p>
            </div>
          ) : null
        )}
      </form>
    </AdminLayout>
  );
}
