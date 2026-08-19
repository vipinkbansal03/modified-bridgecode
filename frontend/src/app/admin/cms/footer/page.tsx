"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  ExternalLink,
  Globe,
  ImageIcon,
  Languages,
  Layers,
  Mail,
  RotateCcw,
  Save,
  Share2,
  SlidersHorizontal,
  Upload,
  X,
} from "lucide-react";
import {
  AdminInput,
  AdminSelect,
  AdminStatsGrid,
  AdminTextarea,
  DataTable,
  useToast,
  toastMessages,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminStickySaveBar } from "@/components/admin/AdminStickySaveBar";
import { Logo } from "@/components/ui/Logo";
import {
  NoTranslationLanguagesMessage,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  TranslationModeBar,
  filterTranslationLanguages,
} from "@/components/admin/TranslationEditorUi";
import {
  useAdminCmsFooter,
  useAdminCmsMenus,
  useAdminLanguages,
  useUpsertCmsFooter,
} from "@/hooks/admin/useAdminHooks";
import { CMS_MENU_LOCATIONS, parseFooterSocialLinks } from "@/lib/cmsNavigation";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { uploadMediaFiles } from "@/utils/uploadMedia";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;

type FooterData = {
  id?: string;
  title: string;
  description: string;
  email: string;
  phone: string;
  address: string;
  logo: string;
  socialLinksJson: {
    facebook: string;
    linkedin: string;
    twitter: string;
    instagram: string;
  };
  newsletterEnabled: boolean;
  status: string;
  translations?: CmsTranslations;
};

type MenuLocationRow = {
  location: string;
  label: string;
  itemCount: number;
  description: string;
  group: string;
};

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.6 1.7-1.6H16.7V4.8c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V11H7.7v3h2.6v8h3.2Z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M6.9 8.7a1.9 1.9 0 1 1 0-3.8 1.9 1.9 0 0 1 0 3.8ZM5.3 19V10h3.2v9H5.3Zm5 0V10h3.1v1.3h.1c.4-.8 1.5-1.6 3-1.6 3.2 0 3.8 2.1 3.8 4.8V19H17v-3.9c0-.9 0-2.2-1.4-2.2s-1.6 1-1.6 2.1V19h-3.7Z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.9 3H21l-4.6 5.3L21.8 21h-4.5l-3.5-4.6L9.8 21H7.7l4.9-5.7L2.2 3h4.6l3.2 4.2L13.7 3h5.2Zm-1.6 15.3h1.2L7.4 5.6H6.1l11.2 12.7Z" />
    </svg>
  );
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4ZM18.4 6.8a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0ZM21 18.5c-.1 1.3-.4 2.5-1.4 3.5s-2.2 1.3-3.5 1.4c-1.4.1-5.7.1-8.1 0-1.3-.1-2.5-.4-3.5-1.4s-1.3-2.2-1.4-3.5c-.1-1.4-.1-5.7 0-8.1.1-1.3.4-2.5 1.4-3.5S6.7 2.6 8 2.5c1.4-.1 5.7-.1 8.1 0 1.3.1 2.5.4 3.5 1.4s1.3 2.2 1.4 3.5c.1 1.4.1 5.7 0 8.1ZM19 7.7c-.1-.9-.2-1.4-.5-1.8-.4-.4-.9-.5-1.8-.5-1.3-.1-5.2-.1-6.5 0-.9 0-1.4.2-1.8.5-.4.4-.5.9-.5 1.8-.1 1.3-.1 5.2 0 6.5 0 .9.2 1.4.5 1.8.4.4.9.5 1.8.5 1.3.1 5.2.1 6.5 0 .9 0 1.4-.2 1.8-.5.4-.4.5-.9.5-1.8.1-1.3.1-5.2 0-6.5Z" />
    </svg>
  );
}

const initialFooterData: FooterData = {
  title: "Modern Orthodontics. All rights reserved.",
  description: "Stay up to date on the latest news and more.",
  email: "orders@modortho.com",
  phone: "1800 890 8022",
  address: "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India",
  logo: "",
  socialLinksJson: {
    facebook: "",
    linkedin: "",
    twitter: "",
    instagram: "",
  },
  newsletterEnabled: true,
  status: "ACTIVE",
};

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((item) => item.languageId === languageId)?.value ?? "";
}

export default function CmsFooterPage() {
  const { data: footer, isLoading, refetch } = useAdminCmsFooter();
  const { data: menus = [] } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const upsert = useUpsertCmsFooter();
  const { showToast, ToastComponent } = useToast();

  const [form, setForm] = useState<FooterData>(initialFooterData);
  const [activeTab, setActiveTab] = useState<"settings" | "navigation" | "translations">("settings");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const translationLanguages = filterTranslationLanguages(languages);
  const activeTranslationLang =
    translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];

  // Accurately compute whether form differs from saved database state
  const isDirty = useMemo(() => {
    if (!footer) return false;
    const social = parseFooterSocialLinks(footer.socialLinksJson);
    return (
      (form.title ?? "").trim() !== (footer.title ?? "").trim() ||
      (form.description ?? "").trim() !== (footer.description ?? "").trim() ||
      (form.logo ?? "").trim() !== (footer.logo ?? "").trim() ||
      Boolean(form.newsletterEnabled) !== (footer.newsletterEnabled ?? true) ||
      (form.status ?? "ACTIVE") !== (footer.status ?? "ACTIVE") ||
      (form.socialLinksJson?.facebook ?? "").trim() !== (social.facebook ?? "").trim() ||
      (form.socialLinksJson?.linkedin ?? "").trim() !== (social.linkedin ?? "").trim() ||
      (form.socialLinksJson?.twitter ?? "").trim() !== (social.twitter ?? "").trim() ||
      (form.socialLinksJson?.instagram ?? "").trim() !== (social.instagram ?? "").trim()
    );
  }, [form, footer]);

  // Sync form when backend data loads or is refetched
  useEffect(() => {
    if (!footer) return;

    const socialLinks = parseFooterSocialLinks(footer.socialLinksJson);
    setForm({
      id: footer.id,
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
      translations: footer.translations,
    });
  }, [footer]);

  useEffect(() => {
    if (translationLanguages.length && !translationLanguageId) {
      setTranslationLanguageId(translationLanguages[0].id);
    }
  }, [translationLanguages, translationLanguageId]);

  function setField<K extends keyof FooterData>(key: K, value: FooterData[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function setSocialField(key: "facebook" | "linkedin" | "twitter" | "instagram", value: string) {
    setForm((current) => ({
      ...current,
      socialLinksJson: {
        ...current.socialLinksJson,
        [key]: value,
      },
    }));
  }

  function handleDiscard() {
    if (!footer) {
      setForm(initialFooterData);
    } else {
      const socialLinks = parseFooterSocialLinks(footer.socialLinksJson);
      setForm({
        id: footer.id,
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
        translations: footer.translations,
      });
    }
    showToast("Changes discarded.");
  }

  async function handleSave() {
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        logo: form.logo.trim(),
        socialLinksJson: form.socialLinksJson,
        newsletterEnabled: form.newsletterEnabled,
        status: form.status,
      };
      await upsert.mutateAsync(payload);
      showToast("Footer settings saved successfully.", "success");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save footer settings."), "error");
    }
  }

  async function uploadLogo(file?: File) {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const results = await uploadMediaFiles([file], {
        entityType: "FOOTER",
        entityId: form.id || undefined,
      });
      const uploaded = results[0];
      if (uploaded?.url) {
        setField("logo", uploaded.url);
      } else {
        throw new Error("Upload completed, but no image URL was returned.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Image upload failed."), "error");
    } finally {
      setUploadingLogo(false);
    }
  }

  async function saveTranslation(
    languageId: string,
    field: "title" | "description" | "address",
    value: string
  ) {
    if (!footer?.id) return;

    try {
      await adminApi.put(`/cms/translations/footer/${footer.id}/${languageId}`, { [field]: value });
      showToast(toastMessages.translationSaved, "success");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, toastMessages.translationFailed), "error");
    }
  }

  // Count active social links
  const activeSocialCount = Object.values(form.socialLinksJson).filter((url) => Boolean(url?.trim())).length;

  // Build Footer Menus Reference List
  const footerMenuRows: MenuLocationRow[] = useMemo(() => {
    const footerLocations = CMS_MENU_LOCATIONS.filter(
      (loc) => loc.group === "footer" || loc.group === "offices_legal"
    );

    return footerLocations.map((loc) => {
      const matchedMenu = (menus as any[]).find((m) => m.location === loc.value);
      const activeItems = (matchedMenu?.items ?? []).filter(
        (item: any) => (item.status ?? "ACTIVE") === "ACTIVE"
      );

      return {
        location: loc.value,
        label: loc.label,
        itemCount: activeItems.length,
        description: loc.description,
        group: loc.group === "footer" ? "Main Column" : "Office & Legal",
      };
    });
  }, [menus]);

  const menuColumns: Column<MenuLocationRow>[] = [
    {
      key: "location",
      label: "Location Key",
      width: "190px",
      render: (row) => (
        <code className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-[11.5px] font-mono text-gray-800">
          {row.location}
        </code>
      ),
    },
    {
      key: "label",
      label: "Section / Column Name",
      render: (row) => (
        <div className="font-semibold text-[13.5px] text-[#1A1A1A]">
          {row.label}
        </div>
      ),
    },
    {
      key: "itemCount",
      label: "Active Links",
      width: "120px",
      render: (row) => (
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold ${
            row.itemCount > 0
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-gray-100 text-gray-500 border border-gray-200"
          }`}
        >
          {row.itemCount} {row.itemCount === 1 ? "link" : "links"}
        </span>
      ),
    },
    {
      key: "description",
      label: "Placement Target",
      render: (row) => (
        <span className="text-[12.5px] text-gray-500 line-clamp-1">
          {row.description}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Manage in Menus",
      width: "150px",
      render: (row) => (
        <Link
          href="/admin/cms/menus"
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#0F6CBD] hover:text-[#0c4a80] hover:underline"
        >
          Edit in Menus <ArrowRight size={13} />
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Footer Settings"
      breadcrumb={[
        { label: "CMS", href: "/admin/cms/pages" },
        { label: "Footer" },
      ]}
    >
      {/* Overview Stats Bar */}
      <AdminStatsGrid
        stats={[
          {
            title: "Footer Status",
            value: form.status === "ACTIVE" ? "Active" : "Inactive",
            subtitle: form.status === "ACTIVE" ? "Visible on storefront" : "Hidden from site",
            icon: <Globe size={18} />,
            color: form.status === "ACTIVE" ? "bg-emerald-600" : "bg-gray-500",
          },
          {
            title: "Newsletter Signup",
            value: form.newsletterEnabled ? "Enabled" : "Disabled",
            subtitle: "Footer CTA Form",
            icon: <Mail size={18} />,
            color: form.newsletterEnabled ? "bg-emerald-600" : "bg-amber-600",
          },
          {
            title: "Navigation Columns",
            value: `${footerMenuRows.length} Locations`,
            subtitle: "Managed under CMS Menus",
            icon: <Layers size={18} />,
            color: "bg-[#0F6CBD]",
          },
          {
            title: "Social Profiles",
            value: `${activeSocialCount} / 4 Active`,
            subtitle: "Bottom bar icons",
            icon: <Share2 size={18} />,
            color: "bg-purple-600",
          },
        ]}
        isLoading={isLoading}
      />

      {/* Top Navigation Tabs Header Card */}
      <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                activeTab === "settings"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#666] hover:text-[#1A1A1A]"
              }`}
            >
              <SlidersHorizontal size={15} />
              Footer Settings
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("navigation")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                activeTab === "navigation"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#666] hover:text-[#1A1A1A]"
              }`}
            >
              <Layers size={15} />
              Navigation Columns (Menus Overview)
              <span className="ml-1 rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-700">
                {footerMenuRows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("translations")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[13.5px] font-semibold transition-colors ${
                activeTab === "translations"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#666] hover:text-[#1A1A1A]"
              }`}
            >
              <Languages size={15} />
              Translations
            </button>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs"
            >
              <ExternalLink size={13} /> View Live Footer
            </a>
            <Link
              href="/admin/cms/menus"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#0F6CBD] hover:bg-blue-50 transition-colors shadow-2xs"
            >
              <Layers size={13} /> Manage Menus
            </Link>
          </div>
        </div>
      </div>

      {/* Tab 1: Content Settings */}
      {activeTab === "settings" && (
        <div className="space-y-5">
          <AdminStickySaveBar
            title="Footer Settings"
            subtitle="Configure footer branding, newsletter, fallback contact details, and social links."
            isDirty={isDirty}
            saving={upsert.isPending}
            savingText="Saving Footer…"
            saveLabel="Save Changes"
            onSave={handleSave}
            secondaryActions={
              <>
                {isDirty && (
                  <button
                    type="button"
                    onClick={handleDiscard}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 hover:bg-[#F5F5F5] transition-colors shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    <span>Reset</span>
                  </button>
                )}
                <a
                  href="/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-2xs"
                >
                  <ExternalLink size={13} />
                  <span>View Live</span>
                </a>
              </>
            }
          />

          <div className="space-y-6">

            {/* Card 1: Branding & Bottom Bar */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
              <div className="mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                  Branding & Bottom Bar Identity
                </h3>
                <p className="text-[12px] text-gray-500">
                  Configure the footer logo, copyright notice, and live publication status.
                </p>
              </div>

              <div className="space-y-4">
                {/* Logo Section */}
                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#1A1A1A]">
                    Footer Logo
                  </label>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    {/* Contrast Preview Box */}
                    <div className="flex h-14 w-44 items-center justify-center rounded-lg border border-[#E6E6E6] bg-[#A1090D] px-3 py-2 shadow-2xs">
                      {form.logo ? (
                        <img
                          src={form.logo}
                          alt="Footer Logo Preview"
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <Logo variant="light" className="scale-90" />
                      )}
                    </div>

                    <div className="space-y-2 flex-1 w-full">
                      <div className="flex items-center gap-2">
                        <label
                          className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#333] hover:bg-gray-50 transition-colors shadow-2xs ${
                            uploadingLogo ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {uploadingLogo ? (
                            <span className="inline-block animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent w-3.5 h-3.5" />
                          ) : (
                            <Upload size={13} />
                          )}
                          {uploadingLogo ? "Uploading..." : "Upload Logo Image"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(event) => uploadLogo(event.target.files?.[0])}
                            disabled={uploadingLogo}
                          />
                        </label>
                        {form.logo && (
                          <button
                            type="button"
                            onClick={() => setField("logo", "")}
                            className="inline-flex items-center gap-1 text-[12px] text-red-600 hover:text-red-800"
                          >
                            <X size={12} /> Clear Custom Logo
                          </button>
                        )}
                      </div>
                      <AdminInput
                        label="Custom Logo URL"
                        value={form.logo}
                        onChange={(e) => setField("logo", e.target.value)}
                        placeholder="/images/footer-logo.svg or https://..."
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                  <div>
                    <AdminInput
                      label="Copyright / Bottom Bar Notice *"
                      value={form.title}
                      onChange={(e) => setField("title", e.target.value)}
                      placeholder="Modern Orthodontics. All rights reserved."
                      required
                    />
                    <p className="mt-1 text-[11.5px] text-gray-500">
                      Rendered on storefront as: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">© {new Date().getFullYear()} {form.title || "Your Notice"}</code>
                    </p>
                  </div>

                  <AdminSelect
                    label="Footer Status"
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value)}
                    options={[
                      { value: "ACTIVE", label: "Active (Visible)" },
                      { value: "INACTIVE", label: "Inactive (Hidden)" },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Card 2: Newsletter & CTA */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
              <div className="mb-4 border-b border-gray-100 pb-3">
                <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                  Newsletter & Email CTA
                </h3>
                <p className="text-[12px] text-gray-500">
                  Control the newsletter subscription block rendered at the bottom of the footer.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <AdminSelect
                    label="Newsletter Visibility"
                    value={form.newsletterEnabled ? "true" : "false"}
                    onChange={(e) => setField("newsletterEnabled", e.target.value === "true")}
                    options={[
                      { value: "true", label: "Enabled (Show on footer)" },
                      { value: "false", label: "Disabled (Hidden from footer)" },
                    ]}
                  />

                  <div className="space-y-1.5">
                    <AdminTextarea
                      label="Newsletter Heading Text"
                      value={form.description}
                      onChange={(e) => setField("description", e.target.value)}
                      placeholder="Stay up to date on the latest news and more."
                      rows={2}
                      disabled={!form.newsletterEnabled}
                      className={!form.newsletterEnabled ? "bg-gray-100/70 text-gray-500 cursor-not-allowed opacity-75" : ""}
                    />
                    {!form.newsletterEnabled ? (
                      <p className="text-[12px] font-medium text-amber-700">
                        ⚠️ Newsletter is disabled. This heading is hidden and will not be displayed on the live storefront footer.
                      </p>
                    ) : (
                      <p className="text-[11.5px] text-gray-500">
                        Headline displayed directly above the email input box on the storefront footer.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Card 3: Company Contact Notice */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-blue-100 p-2 text-blue-700">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-[13.5px] font-bold text-blue-950">
                      Company Contact & Legal Address
                    </h4>
                    <p className="text-[12px] text-blue-800/80 mt-0.5">
                      Global company contact details (email, phone, and address) are managed centrally in <strong>Settings → General</strong>. Footer navigation columns are managed in <strong>CMS Menus</strong>.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/admin/settings"
                    className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-blue-900 hover:bg-blue-50 transition-colors shadow-2xs"
                  >
                    Open General Settings <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>

            {/* Card 4: Social Media Links */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs">
              <div className="mb-4 border-b border-gray-100 pb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                    Global Social Media Profiles
                  </h3>
                  <p className="text-[12px] text-gray-500">
                    Social icons displayed in the bottom bar of the storefront footer.
                  </p>
                </div>
                <Link
                  href="/admin/settings?tab=social"
                  className="text-[12px] font-semibold text-[#0F6CBD] hover:underline"
                >
                  Configure Country-wise Overrides →
                </Link>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#1A1A1A]">
                    <FacebookIcon className="text-[#1877F2]" /> Facebook URL
                  </label>
                  <AdminInput
                    value={form.socialLinksJson.facebook}
                    onChange={(e) => setSocialField("facebook", e.target.value)}
                    placeholder="https://facebook.com/..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#1A1A1A]">
                    <LinkedinIcon className="text-[#0A66C2]" /> LinkedIn URL
                  </label>
                  <AdminInput
                    value={form.socialLinksJson.linkedin}
                    onChange={(e) => setSocialField("linkedin", e.target.value)}
                    placeholder="https://linkedin.com/company/..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#1A1A1A]">
                    <TwitterIcon className="text-gray-900" /> Twitter / X URL
                  </label>
                  <AdminInput
                    value={form.socialLinksJson.twitter}
                    onChange={(e) => setSocialField("twitter", e.target.value)}
                    placeholder="https://x.com/..."
                  />
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[#1A1A1A]">
                    <InstagramIcon className="text-[#E4405F]" /> Instagram URL
                  </label>
                  <AdminInput
                    value={form.socialLinksJson.instagram}
                    onChange={(e) => setSocialField("instagram", e.target.value)}
                    placeholder="https://instagram.com/..."
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        {/* Tab 2: Navigation Columns (Menus Overview Table) */}
        {activeTab === "navigation" && (
          <div className="p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4">
              <div>
                <h4 className="text-[13.5px] font-bold text-blue-950">
                  Navigation Menus Architecture
                </h4>
                <p className="text-[12px] text-blue-800/80 mt-0.5">
                  Footer columns and legal links are managed directly in <strong>CMS Menus</strong>. Click any row below to edit links, ordering, or visibility.
                </p>
              </div>
              <Link
                href="/admin/cms/menus"
                className="inline-flex items-center gap-1.5 rounded-md bg-[#0F6CBD] px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-[#0c4a80] transition-colors shadow-2xs"
              >
                Go to Menus Editor <ArrowRight size={13} />
              </Link>
            </div>

            <DataTable
              title="Footer Navigation Columns Reference"
              description="Overview of all 9 menu locations mapped to the Storefront Footer."
              columns={menuColumns}
              data={footerMenuRows}
              rowKey="location"
              emptyMessage="No footer menu locations configured."
            />
          </div>
        )}

        {/* Tab 3: Translations */}
        {activeTab === "translations" && footer?.id && (
          <div className="p-6 space-y-5">
            <TranslationModeBar
              editorTab="translations"
              onTabChange={() => {}}
              translationLanguages={translationLanguages}
              selectedLanguageId={translationLanguageId}
              onLanguageChange={setTranslationLanguageId}
            />

            {translationLanguages.length === 0 ? (
              <NoTranslationLanguagesMessage />
            ) : activeTranslationLang ? (
              <div className="space-y-4">
                <TranslationEditorBanner language={activeTranslationLang} />

                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
                  <TranslationBlurInput
                    key={`title-${activeTranslationLang.id}-${translationValue(footer.translations, "title", activeTranslationLang.id)}`}
                    label="Copyright / Bottom Bar Notice"
                    defaultValue={translationValue(footer.translations, "title", activeTranslationLang.id)}
                    englishReference={footer.title || ""}
                    onSave={(value) => saveTranslation(activeTranslationLang.id, "title", value)}
                  />

                  <TranslationBlurField
                    key={`description-${activeTranslationLang.id}-${translationValue(footer.translations, "description", activeTranslationLang.id)}`}
                    label="Newsletter Callout Text"
                    rows={2}
                    defaultValue={translationValue(footer.translations, "description", activeTranslationLang.id)}
                    englishReference={footer.description || ""}
                    onSave={(value) => saveTranslation(activeTranslationLang.id, "description", value)}
                  />

                  <TranslationBlurField
                    key={`address-${activeTranslationLang.id}-${translationValue(footer.translations, "address", activeTranslationLang.id)}`}
                    label="Fallback Company Address"
                    rows={2}
                    defaultValue={translationValue(footer.translations, "address", activeTranslationLang.id)}
                    englishReference={footer.address || ""}
                    onSave={(value) => saveTranslation(activeTranslationLang.id, "address", value)}
                  />
                </div>

                <p className="text-[12px] text-gray-500 italic">
                  Logo URL, email, phone, newsletter toggle, status, and social URLs are global and shared across all languages.
                </p>
              </div>
            ) : null}
          </div>
        )}

      {ToastComponent}
    </AdminLayout>
  );
}
