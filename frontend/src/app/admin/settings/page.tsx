"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Globe, Search, BarChart2, Megaphone, Share2, ShieldCheck, Code2, Cookie, MessageCircle, Mail,
  CheckCircle2, AlertCircle, Eye, EyeOff, Save, RefreshCw, Lock, Upload, Plus, Trash2, ArrowUp, ArrowDown, Info,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminTextarea, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "general",      label: "General",          icon: Globe },
  { id: "seo",          label: "SEO",               icon: Search },
  { id: "analytics",    label: "Analytics",         icon: BarChart2 },
  { id: "pixels",       label: "Pixels",            icon: Megaphone },
  { id: "social",       label: "Social Media",      icon: Share2 },
  { id: "verification", label: "Verification",      icon: ShieldCheck },
  { id: "scripts",      label: "Custom Scripts",    icon: Code2 },
  { id: "cookies",      label: "Cookie Consent",    icon: Cookie },
  { id: "auth",         label: "Auth Pages",        icon: Lock },
  { id: "whatsapp",     label: "WhatsApp",          icon: MessageCircle },
  { id: "email",        label: "Email / SMTP",      icon: Mail },
];

type Setting = { id: string; key: string; value: string; group: string; label?: string | null; type: string; isSecret: boolean; isEnabled: boolean };
type SettingMap = Record<string, string>;
type UploadedMedia = { url: string };
type LoginSlide = { image: string; heading: string; subHeading: string; isVisible: boolean };

const DEFAULT_LOGIN_SLIDES: LoginSlide[] = [
  {
    image: "/auth/login1.jpg",
    heading: "Modern orthodontic care designed for confident smiles.",
    subHeading: "Premium products and account access for dental professionals.",
    isVisible: true,
  },
  {
    image: "/auth/login2.jpg",
    heading: "Track your treatment journey with ease and comfort.",
    subHeading: "Manage orders, quotes, and account details in one secure place.",
    isVisible: true,
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function parseLoginSlides(map: SettingMap): LoginSlide[] {
  try {
    const parsed = JSON.parse(map["auth.login_slides"] || "[]") as LoginSlide[];
    const validSlides = parsed
      .map((slide) => ({
        image: slide.image || "",
        heading: slide.heading || "",
        subHeading: slide.subHeading || "",
        isVisible: slide.isVisible !== false,
      }))
      .filter((slide) => slide.image || slide.heading || slide.subHeading);
    if (validSlides.length) return validSlides;
  } catch {
    // Fall back to old fixed setting keys or defaults below.
  }

  const oldSlides = [1, 2].map((slideNumber) => ({
    image: map[`auth.login_slide_${slideNumber}_image`] || DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.image || "",
    heading: map[`auth.login_slide_${slideNumber}_heading`] || DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.heading || "",
    subHeading: map[`auth.login_slide_${slideNumber}_sub_heading`] || DEFAULT_LOGIN_SLIDES[slideNumber - 1]?.subHeading || "",
    isVisible: true,
  }));

  return oldSlides.filter((slide) => slide.image || slide.heading || slide.subHeading);
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", value ? "bg-[#E31E24]" : "bg-gray-200")}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Leave blank to keep existing value"}
        className="w-full rounded-lg border border-[#E6E6E6] px-3 py-2 pr-10 text-[13.5px] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
      />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function FieldRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[220px_1fr] gap-4 items-start py-4 border-b border-[#F4F4F4] last:border-0">
      <div>
        <div className="text-[13.5px] font-medium text-[#1A1A1A]">{label}</div>
        {hint && <div className="mt-0.5 text-[11.5px] text-[#8B8B8B] leading-relaxed">{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function IntegrationCard({ title, subtitle, enabled, onToggle, children }: {
  title: string; subtitle: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border p-5 transition-colors", enabled ? "border-[#E31E24]/30 bg-[#E31E24]/[0.02]" : "border-[#E6E6E6] bg-white")}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[14px] font-semibold text-[#1A1A1A] flex items-center gap-2">
            {enabled ? <CheckCircle2 size={14} className="text-emerald-500" /> : <AlertCircle size={14} className="text-gray-300" />}
            {title}
          </div>
          <div className="text-[12px] text-[#8B8B8B] mt-0.5">{subtitle}</div>
        </div>
        <Toggle value={enabled} onChange={onToggle} />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

// ─── Settings key metadata ────────────────────────────────────────────────────

const SETTINGS_META: Record<string, { group: string; type: string; isSecret?: boolean }> = {
  // General
  "general.site_name":       { group: "general",  type: "string" },
  "general.site_url":        { group: "general",  type: "string" },
  "general.company_name":    { group: "general",  type: "string" },
  "general.email":           { group: "general",  type: "string" },
  "general.phone":           { group: "general",  type: "string" },
  "general.address":         { group: "general",  type: "string" },
  "general.logo":            { group: "general",  type: "string" },
  "general.logo_alt":        { group: "general",  type: "string" },
  "general.mobile_logo":     { group: "general",  type: "string" },
  "general.favicon":         { group: "general",  type: "string" },
  "general.default_currency":{ group: "general",  type: "string" },
  "general.timezone":        { group: "general",  type: "string" },
  // SEO
  "seo.default_title":              { group: "seo", type: "string" },
  "seo.default_description":        { group: "seo", type: "string" },
  "seo.default_keywords":           { group: "seo", type: "string" },
  "seo.og_title":                   { group: "seo", type: "string" },
  "seo.og_description":             { group: "seo", type: "string" },
  "seo.og_image":                   { group: "seo", type: "string" },
  "seo.twitter_image":              { group: "seo", type: "string" },
  "seo.canonical_domain":           { group: "seo", type: "string" },
  "seo.robots_txt":                 { group: "seo", type: "string" },
  "seo.sitemap_include_products":   { group: "seo", type: "boolean" },
  "seo.sitemap_include_categories": { group: "seo", type: "boolean" },
  "seo.sitemap_include_blogs":      { group: "seo", type: "boolean" },
  "seo.sitemap_include_cms_pages":  { group: "seo", type: "boolean" },
  // Analytics
  "analytics.ga4_measurement_id":   { group: "analytics", type: "string" },
  "analytics.ga4_enabled":          { group: "analytics", type: "boolean" },
  "analytics.gtm_container_id":     { group: "analytics", type: "string" },
  "analytics.gtm_enabled":          { group: "analytics", type: "boolean" },
  "analytics.clarity_project_id":   { group: "analytics", type: "string" },
  "analytics.clarity_enabled":      { group: "analytics", type: "boolean" },
  "analytics.hotjar_site_id":       { group: "analytics", type: "string" },
  "analytics.hotjar_enabled":       { group: "analytics", type: "boolean" },
  "analytics.hubspot_tracking_code":{ group: "analytics", type: "string" },
  "analytics.hubspot_enabled":      { group: "analytics", type: "boolean" },
  // Pixels
  "pixels.meta_pixel_id":           { group: "pixels", type: "string" },
  "pixels.meta_pixel_enabled":      { group: "pixels", type: "boolean" },
  "pixels.meta_capi_access_token":  { group: "pixels", type: "secret", isSecret: true },
  "pixels.meta_capi_test_event_code":{ group: "pixels", type: "string" },
  "pixels.meta_capi_enabled":       { group: "pixels", type: "boolean" },
  "pixels.linkedin_partner_id":     { group: "pixels", type: "string" },
  "pixels.linkedin_enabled":        { group: "pixels", type: "boolean" },
  "pixels.twitter_pixel_id":        { group: "pixels", type: "string" },
  "pixels.twitter_enabled":         { group: "pixels", type: "boolean" },
  "pixels.pinterest_tag_id":        { group: "pixels", type: "string" },
  "pixels.pinterest_enabled":       { group: "pixels", type: "boolean" },
  "pixels.tiktok_pixel_id":         { group: "pixels", type: "string" },
  "pixels.tiktok_enabled":          { group: "pixels", type: "boolean" },
  // Social
  "social.facebook_url":  { group: "social", type: "string" },
  "social.instagram_url": { group: "social", type: "string" },
  "social.linkedin_url":  { group: "social", type: "string" },
  "social.youtube_url":   { group: "social", type: "string" },
  "social.twitter_url":   { group: "social", type: "string" },
  "social.pinterest_url": { group: "social", type: "string" },
  // Verification
  "verification.google":          { group: "verification", type: "string" },
  "verification.bing":            { group: "verification", type: "string" },
  "verification.pinterest":       { group: "verification", type: "string" },
  "verification.facebook_domain": { group: "verification", type: "string" },
  "verification.custom":          { group: "verification", type: "string" },
  // Scripts
  "scripts.header": { group: "scripts", type: "string" },
  "scripts.footer": { group: "scripts", type: "string" },
  // Cookies
  "cookies.enabled":             { group: "cookies", type: "boolean" },
  "cookies.banner_title":        { group: "cookies", type: "string" },
  "cookies.banner_description":  { group: "cookies", type: "string" },
  "cookies.privacy_policy_url":  { group: "cookies", type: "string" },
  // Auth pages
  "auth.login_heading":             { group: "auth", type: "string" },
  "auth.login_sub_heading":         { group: "auth", type: "string" },
  "auth.login_slider_enabled":      { group: "auth", type: "boolean" },
  "auth.login_slide_1_image":       { group: "auth", type: "string" },
  "auth.login_slide_1_heading":     { group: "auth", type: "string" },
  "auth.login_slide_1_sub_heading": { group: "auth", type: "string" },
  "auth.login_slide_2_image":       { group: "auth", type: "string" },
  "auth.login_slide_2_heading":     { group: "auth", type: "string" },
  "auth.login_slide_2_sub_heading": { group: "auth", type: "string" },
  "auth.login_slides":              { group: "auth", type: "json" },
  // WhatsApp
  "whatsapp.number":                  { group: "whatsapp", type: "string" },
  "whatsapp.default_message":         { group: "whatsapp", type: "string" },
  "whatsapp.floating_button_enabled": { group: "whatsapp", type: "boolean" },
  // Email
  "email.smtp_host":     { group: "email", type: "string" },
  "email.smtp_port":     { group: "email", type: "string" },
  "email.smtp_user":     { group: "email", type: "string" },
  "email.smtp_password": { group: "email", type: "secret", isSecret: true },
  "email.from_name":     { group: "email", type: "string" },
  "email.from_email":    { group: "email", type: "string" },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("settings.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("settings.update");

  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState<SettingMap>({});
  const [loginSlides, setLoginSlides] = useState<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const shouldScrollToNewSlideRef = useRef(false);
  const newestSlideRef = useRef<HTMLDivElement | null>(null);
  const [savedSettings, setSavedSettings] = useState<SettingMap>({});
  const savedLoginSlidesRef = useRef<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const queryClient = useQueryClient();
  const { showToast, ToastComponent } = useToast();

  const loadSettings = useCallback(async () => {
    if (authLoading || !hasPermission("settings.view")) return;
    setLoading(true);
    try {
      const r = await adminApi.get("/settings");
      const rows: Setting[] = r.data.data ?? [];
      const map: SettingMap = {};
      rows.forEach((s) => { map[s.key] = s.value === "***" ? "" : s.value; });
      const parsedSlides = parseLoginSlides(map);
      setSettings(map);
      setSavedSettings(map);
      setLoginSlides(parsedSlides);
      savedLoginSlidesRef.current = parsedSlides;
    } catch { showToast("Failed to load settings.", "error"); }
    finally { setLoading(false); }
  }, [authLoading, hasPermission, showToast]);

  useEffect(() => {
    if (!authLoading && hasPermission("settings.view")) {
      loadSettings();
    }
  }, [authLoading, hasPermission, loadSettings]);

  useEffect(() => {
    if (!shouldScrollToNewSlideRef.current) return;

    newestSlideRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    shouldScrollToNewSlideRef.current = false;
  }, [loginSlides.length]);

  function set(key: string, value: string) { setSettings((s) => ({ ...s, [key]: value })); }
  function tog(key: string, v: boolean)    { set(key, String(v)); }
  const g = (key: string) => settings[key] ?? "";
  const b = (key: string) => settings[key] === "true";
  const authSliderEnabled = g("auth.login_slider_enabled") !== "false";

  const isLogoDirty = useMemo(() => {
    return (
      (settings["general.logo"] ?? "") !== (savedSettings["general.logo"] ?? "") ||
      (settings["general.mobile_logo"] ?? "") !== (savedSettings["general.mobile_logo"] ?? "") ||
      (settings["general.logo_alt"] ?? "") !== (savedSettings["general.logo_alt"] ?? "")
    );
  }, [settings, savedSettings]);

  const isDirty = useMemo(() => {
    const isSlidesChanged = JSON.stringify(loginSlides) !== JSON.stringify(savedLoginSlidesRef.current);
    const isSettingsChanged = Object.keys(settings).some(
      (k) => (settings[k] ?? "") !== (savedSettings[k] ?? "")
    );
    return isSlidesChanged || isSettingsChanged;
  }, [settings, loginSlides, savedSettings]);

  function updateLoginSlide<K extends keyof LoginSlide>(index: number, field: K, value: LoginSlide[K]) {
    setLoginSlides((slides) =>
      slides.map((slide, slideIndex) =>
        slideIndex === index ? { ...slide, [field]: value } : slide,
      ),
    );
  }

  function addLoginSlide() {
    shouldScrollToNewSlideRef.current = true;
    setLoginSlides((slides) => [
      ...slides,
      { image: "", heading: "", subHeading: "", isVisible: true },
    ]);
  }

  function removeLoginSlide(index: number) {
    setLoginSlides((slides) => slides.filter((_, slideIndex) => slideIndex !== index));
  }

  function moveLoginSlide(index: number, direction: "up" | "down") {
    setLoginSlides((slides) => {
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= slides.length) return slides;

      const nextSlides = [...slides];
      const currentSlide = nextSlides[index];
      nextSlides[index] = nextSlides[targetIndex]!;
      nextSlides[targetIndex] = currentSlide!;
      return nextSlides;
    });
  }

  function getLocalAuthSlideUrls(slides: LoginSlide[]) {
    return slides
      .map((slide) => slide.image)
      .filter((url) => url.startsWith("/uploads/modortho/auth/"));
  }

  async function deleteUnusedAuthSlideImages(previousSlides: LoginSlide[], currentSlides: LoginSlide[]) {
    const currentUrls = new Set(getLocalAuthSlideUrls(currentSlides));
    const urlsToDelete = [...new Set(getLocalAuthSlideUrls(previousSlides))]
      .filter((url) => !currentUrls.has(url));

    await Promise.all(
      urlsToDelete.map((url) =>
        adminApi.delete("/media/by-url", { params: { url } }),
      ),
    );
  }

  const handleSlideImageUpload = async (
    index: number,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const uploadKey = `auth.login_slide_${index}_image`;

    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "modortho/auth");
    setUploadingKey(uploadKey);

    try {
      const response = await adminApi.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = response.data.data?.[0] as UploadedMedia | undefined;

      if (!uploaded?.url) {
        throw new Error("Upload response did not include an image URL.");
      }

      updateLoginSlide(index, "image", uploaded.url);
      showToast("Image uploaded.", "success");
    } catch {
      showToast("Image upload failed.", "error");
    } finally {
      setUploadingKey(null);
      event.target.value = "";
    }
  };

  const handleSettingImageUpload = async (
    key: "general.logo" | "general.mobile_logo" | "general.favicon",
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingKey(key);
    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "modortho/branding");

    try {
      const response = await adminApi.post("/media", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const uploaded = response.data.data?.[0] as UploadedMedia | undefined;

      if (!uploaded?.url) {
        throw new Error("Upload response did not include an image URL.");
      }

      set(key, uploaded.url);
      showToast("Image uploaded. Click 'Save Settings' to apply changes.", "success");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Image upload failed."), "error");
    } finally {
      setUploadingKey(null);
      event.target.value = "";
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsToSave = {
        ...settings,
        "auth.login_slides": JSON.stringify(loginSlides),
      };
      const settingsList = Object.entries(settingsToSave)
        .filter(([key]) => SETTINGS_META[key])
        .map(([key, value]) => ({
          key,
          value,
          group:    SETTINGS_META[key]!.group,
          type:     SETTINGS_META[key]!.type,
          isSecret: SETTINGS_META[key]!.isSecret ?? false,
        }));
      const previousSlides = savedLoginSlidesRef.current;
      await adminApi.put("/settings", { settings: settingsList });
      try {
        await deleteUnusedAuthSlideImages(previousSlides, loginSlides);
      } catch {
        showToast("Settings saved, but old image cleanup failed.", "error");
      }
      savedLoginSlidesRef.current = loginSlides;
      setSavedSettings({ ...settingsToSave });
      queryClient.invalidateQueries({ queryKey: ["tracking-settings"] });
      showToast("Settings saved successfully.", "success");
    } catch { showToast("Failed to save settings.", "error"); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <AdminLayout title="Settings" breadcrumb={[{ label: "Settings" }]}>
        <div className="flex items-center gap-2 text-[14px] text-[#6B6B6B]">
          <RefreshCw size={14} className="animate-spin" /> Loading settings…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Website Settings" breadcrumb={[{ label: "Settings" }]}>
      {ToastComponent}
      <div className="flex gap-6">

        {/* ── Sidebar ── */}
        <aside className="w-[200px] flex-none">
          <nav className="space-y-0.5 sticky top-24">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-left transition-colors",
                    activeTab === tab.id ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
                  )}>
                  <Icon size={14} className="flex-none" />{tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          <div className="sticky -top-6 z-20 mb-5 flex items-center justify-between rounded-b-xl border border-t-0 border-[#E6E6E6] bg-white/95 px-4 py-3 shadow-[0_14px_35px_rgba(227,30,36,0.10)] backdrop-blur before:absolute before:left-0 before:top-0 before:h-[3px] before:w-full before:bg-[#E31E24] relative">
            <div>
              <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{TABS.find((t) => t.id === activeTab)?.label}</h2>
              {canUpdate ? (
                <p className="mt-0.5 text-[11.5px] text-[#8B8B8B]">Changes are not applied until you save.</p>
              ) : (
                <p className="mt-0.5 text-[11.5px] text-amber-600 font-medium">Read-only mode. You do not have permissions to edit store settings.</p>
              )}
            </div>
            {canUpdate && (
              <div className="flex items-center gap-3">
                {isDirty && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                    Unsaved Changes
                  </span>
                )}
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white shadow-[0_8px_20px_rgba(227,30,36,0.28)] transition-colors hover:bg-[#B5151B] disabled:opacity-50"
                >
                  <Save size={13} />
                  {saving ? "Saving…" : "Save Settings"}
                </button>
              </div>
            )}
          </div>

          <fieldset disabled={!canUpdate} className="rounded-xl border border-[#E6E6E6] bg-white p-6 disabled:opacity-90">

            {/* ── General ── */}
            {activeTab === "general" && (
              <div className="space-y-4">
                <FieldRow label="Website Name"><AdminInput value={g("general.site_name")} onChange={(e) => set("general.site_name", e.target.value)} placeholder="Modern Orthodontics" /></FieldRow>
                <FieldRow label="Website URL"><AdminInput value={g("general.site_url")} onChange={(e) => set("general.site_url", e.target.value)} placeholder="https://modortho.com" /></FieldRow>
                <FieldRow label="Company Name"><AdminInput value={g("general.company_name")} onChange={(e) => set("general.company_name", e.target.value)} /></FieldRow>
                <FieldRow label="Contact Email"><AdminInput type="email" value={g("general.email")} onChange={(e) => set("general.email", e.target.value)} /></FieldRow>
                <FieldRow label="Phone"><AdminInput value={g("general.phone")} onChange={(e) => set("general.phone", e.target.value)} /></FieldRow>
                <FieldRow label="Address"><AdminTextarea value={g("general.address")} onChange={(e) => set("general.address", e.target.value)} rows={2} /></FieldRow>

                {/* ── Logo & Branding Section ── */}
                <div className="my-6 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                    <div>
                      <h4 className="text-[14.5px] font-bold text-[#1A1A1A]">Storefront Logo & Branding</h4>
                      <p className="text-[12px] text-[#6B7280]">Manage desktop and mobile header logos, alt text, and fallback behavior.</p>
                    </div>
                    {(g("general.logo") || g("general.mobile_logo")) && (
                      <button
                        type="button"
                        onClick={() => {
                          set("general.logo", "");
                          set("general.mobile_logo", "");
                          showToast("Logo reset to static SVG/text fallback.", "info");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#E31E24] shadow-2xs hover:bg-[#FEF2F2]"
                      >
                        <RefreshCw size={13} /> Reset to Default Fallback
                      </button>
                    )}
                  </div>

                  {isLogoDirty ? (
                    <div className="flex items-center gap-2 rounded-md border border-[#FDE68A] bg-[#FEF3C7] px-3.5 py-2 text-xs text-[#92400E]">
                      <AlertCircle size={15} className="shrink-0 text-[#D97706]" />
                      <span>Unsaved logo changes. Click <strong>Save Settings</strong> at the top right to publish your changes live to the website.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-md border border-[#BBF7D0] bg-[#F0FDF4] px-3.5 py-2 text-xs text-[#166534]">
                      <CheckCircle2 size={15} className="shrink-0 text-[#16A34A]" />
                      <span>Storefront logo settings are saved and active on the website.</span>
                    </div>
                  )}

                  {/* Logo Live Previews */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3.5 shadow-2xs">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Desktop Header Preview</span>
                      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-[#D1D5DB] bg-[#FAFAFA] p-2">
                        <Logo src={g("general.logo")} alt={g("general.logo_alt") || g("general.site_name")} />
                      </div>
                    </div>

                    <div className="rounded-lg border border-[#E5E7EB] bg-white p-3.5 shadow-2xs">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Mobile Header Preview</span>
                      <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-[#D1D5DB] bg-[#FAFAFA] p-2">
                        <Logo src={g("general.logo")} mobileSrc={g("general.mobile_logo")} alt={g("general.logo_alt") || g("general.site_name")} isMobile />
                      </div>
                    </div>
                  </div>

                  {/* Desktop Logo Upload & Input */}
                  <FieldRow label="Desktop Logo URL" hint="Full URL or /uploads/... path">
                    <div className="flex items-center gap-2">
                      <AdminInput
                        value={g("general.logo")}
                        onChange={(e) => set("general.logo", e.target.value)}
                        placeholder="e.g. /uploads/modortho/branding/logo.png"
                      />
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-semibold text-[#374151] shadow-2xs hover:bg-[#F9FAFB]">
                        <Upload size={14} />
                        <span>{uploadingKey === "general.logo" ? "Uploading…" : "Upload"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleSettingImageUpload("general.logo", e)}
                          disabled={Boolean(uploadingKey)}
                        />
                      </label>
                    </div>
                  </FieldRow>

                  {/* Logo Alt Text */}
                  <FieldRow label="Logo Alt Text" hint="Alternative text for accessibility & SEO">
                    <AdminInput
                      value={g("general.logo_alt")}
                      onChange={(e) => set("general.logo_alt", e.target.value)}
                      placeholder="Modern Orthodontics"
                    />
                  </FieldRow>

                  {/* Mobile Logo Upload & Input */}
                  <FieldRow label="Mobile Logo URL (Optional)" hint="Leave blank to use desktop logo on mobile header">
                    <div className="flex items-center gap-2">
                      <AdminInput
                        value={g("general.mobile_logo")}
                        onChange={(e) => set("general.mobile_logo", e.target.value)}
                        placeholder="e.g. /uploads/modortho/branding/mobile-logo.png"
                      />
                      <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-xs font-semibold text-[#374151] shadow-2xs hover:bg-[#F9FAFB]">
                        <Upload size={14} />
                        <span>{uploadingKey === "general.mobile_logo" ? "Uploading…" : "Upload"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => void handleSettingImageUpload("general.mobile_logo", e)}
                          disabled={Boolean(uploadingKey)}
                        />
                      </label>
                    </div>
                  </FieldRow>
                </div>

                <FieldRow label="Favicon URL"><AdminInput value={g("general.favicon")} onChange={(e) => set("general.favicon", e.target.value)} /></FieldRow>
                <FieldRow label="Default Currency">
                  <AdminSelect value={g("general.default_currency")} onChange={(e) => set("general.default_currency", e.target.value)}
                    options={[{ value: "INR", label: "INR — Indian Rupee" }, { value: "USD", label: "USD — US Dollar" }, { value: "EUR", label: "EUR — Euro" }, { value: "GBP", label: "GBP — British Pound" }]} />
                </FieldRow>
                <FieldRow label="Timezone">
                  <AdminSelect value={g("general.timezone")} onChange={(e) => set("general.timezone", e.target.value)}
                    options={[{ value: "Asia/Kolkata", label: "Asia/Kolkata (IST)" }, { value: "UTC", label: "UTC" }, { value: "America/New_York", label: "America/New_York (EST)" }]} />
                </FieldRow>
              </div>
            )}

            {/* ── SEO ── */}
            {activeTab === "seo" && (
              <div>
                <FieldRow label="Default Meta Title" hint="Shown in browser tab and search results"><AdminInput value={g("seo.default_title")} onChange={(e) => set("seo.default_title", e.target.value)} /></FieldRow>
                <FieldRow label="Default Meta Description"><AdminTextarea value={g("seo.default_description")} onChange={(e) => set("seo.default_description", e.target.value)} rows={3} /></FieldRow>
                <FieldRow label="Default Keywords"><AdminInput value={g("seo.default_keywords")} onChange={(e) => set("seo.default_keywords", e.target.value)} placeholder="orthodontic, brackets, wires" /></FieldRow>
                <FieldRow label="OG Title"><AdminInput value={g("seo.og_title")} onChange={(e) => set("seo.og_title", e.target.value)} /></FieldRow>
                <FieldRow label="OG Description"><AdminTextarea value={g("seo.og_description")} onChange={(e) => set("seo.og_description", e.target.value)} rows={2} /></FieldRow>
                <FieldRow label="OG Image URL"><AdminInput value={g("seo.og_image")} onChange={(e) => set("seo.og_image", e.target.value)} /></FieldRow>
                <FieldRow label="Twitter Card Image"><AdminInput value={g("seo.twitter_image")} onChange={(e) => set("seo.twitter_image", e.target.value)} /></FieldRow>
                <FieldRow label="Canonical Domain"><AdminInput value={g("seo.canonical_domain")} onChange={(e) => set("seo.canonical_domain", e.target.value)} placeholder="https://modortho.com" /></FieldRow>
                <FieldRow label="robots.txt" hint="Leave blank to use default (allow all, block /admin/)">
                  <AdminTextarea value={g("seo.robots_txt")} onChange={(e) => set("seo.robots_txt", e.target.value)} rows={6} placeholder={`User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: https://modortho.com/sitemap.xml`} />
                </FieldRow>
                <div className="mt-4 border-t border-[#F4F4F4] pt-4">
                  <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">Sitemap Configuration</div>
                  {([
                    { key: "seo.sitemap_include_products",   label: "Include Products" },
                    { key: "seo.sitemap_include_categories", label: "Include Categories" },
                    { key: "seo.sitemap_include_blogs",      label: "Include Blogs" },
                    { key: "seo.sitemap_include_cms_pages",  label: "Include CMS Pages" },
                  ] as const).map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-2.5 border-b border-[#F4F4F4] last:border-0">
                      <span className="text-[13.5px] text-[#444]">{item.label}</span>
                      <Toggle value={b(item.key)} onChange={(v) => tog(item.key, v)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Analytics ── */}
            {activeTab === "analytics" && (
              <div className="space-y-5">
                <IntegrationCard title="Google Analytics 4" subtitle="Track page views, events, and conversions" enabled={b("analytics.ga4_enabled")} onToggle={(v) => tog("analytics.ga4_enabled", v)}>
                  <AdminInput label="Measurement ID" value={g("analytics.ga4_measurement_id")} onChange={(e) => set("analytics.ga4_measurement_id", e.target.value)} placeholder="G-XXXXXXXXXX" />
                </IntegrationCard>

                <IntegrationCard title="Google Tag Manager" subtitle="Manage all tags from one place (replaces standalone GA4)" enabled={b("analytics.gtm_enabled")} onToggle={(v) => tog("analytics.gtm_enabled", v)}>
                  <AdminInput label="Container ID" value={g("analytics.gtm_container_id")} onChange={(e) => set("analytics.gtm_container_id", e.target.value)} placeholder="GTM-XXXXXXX" />
                </IntegrationCard>

                <IntegrationCard title="Microsoft Clarity" subtitle="Session recordings and heatmaps" enabled={b("analytics.clarity_enabled")} onToggle={(v) => tog("analytics.clarity_enabled", v)}>
                  <AdminInput label="Project ID" value={g("analytics.clarity_project_id")} onChange={(e) => set("analytics.clarity_project_id", e.target.value)} placeholder="xxxxxxxxxx" />
                </IntegrationCard>

                <IntegrationCard title="Hotjar" subtitle="Heatmaps, session recordings, and feedback widgets" enabled={b("analytics.hotjar_enabled")} onToggle={(v) => tog("analytics.hotjar_enabled", v)}>
                  <AdminInput label="Site ID" value={g("analytics.hotjar_site_id")} onChange={(e) => set("analytics.hotjar_site_id", e.target.value)} placeholder="1234567" />
                </IntegrationCard>

                <IntegrationCard title="HubSpot" subtitle="CRM tracking and lead capture" enabled={b("analytics.hubspot_enabled")} onToggle={(v) => tog("analytics.hubspot_enabled", v)}>
                  <AdminInput label="HubSpot Portal ID" value={g("analytics.hubspot_tracking_code")} onChange={(e) => set("analytics.hubspot_tracking_code", e.target.value)} placeholder="12345678" />
                </IntegrationCard>
              </div>
            )}

            {/* ── Pixels ── */}
            {activeTab === "pixels" && (
              <div className="space-y-5">
                <IntegrationCard title="Meta (Facebook) Pixel" subtitle="Track website visitors for retargeting and ad conversion" enabled={b("pixels.meta_pixel_enabled")} onToggle={(v) => tog("pixels.meta_pixel_enabled", v)}>
                  <AdminInput label="Pixel ID" value={g("pixels.meta_pixel_id")} onChange={(e) => set("pixels.meta_pixel_id", e.target.value)} placeholder="123456789012345" />
                </IntegrationCard>

                <IntegrationCard title="Meta Conversions API (CAPI)" subtitle="Server-side event tracking — more reliable than browser pixels. Access token is encrypted." enabled={b("pixels.meta_capi_enabled")} onToggle={(v) => tog("pixels.meta_capi_enabled", v)}>
                  <div>
                    <div className="mb-1.5 text-[12.5px] font-medium text-[#444]">Access Token</div>
                    <SecretInput value={g("pixels.meta_capi_access_token")} onChange={(v) => set("pixels.meta_capi_access_token", v)} />
                  </div>
                  <AdminInput label="Test Event Code" value={g("pixels.meta_capi_test_event_code")} onChange={(e) => set("pixels.meta_capi_test_event_code", e.target.value)} placeholder="TEST12345 (remove in production)" />
                </IntegrationCard>

                <IntegrationCard title="LinkedIn Insight Tag" subtitle="B2B audience insights and retargeting" enabled={b("pixels.linkedin_enabled")} onToggle={(v) => tog("pixels.linkedin_enabled", v)}>
                  <AdminInput label="Partner ID" value={g("pixels.linkedin_partner_id")} onChange={(e) => set("pixels.linkedin_partner_id", e.target.value)} placeholder="1234567" />
                </IntegrationCard>

                <IntegrationCard title="Twitter / X Pixel" subtitle="Track conversions from Twitter ad campaigns" enabled={b("pixels.twitter_enabled")} onToggle={(v) => tog("pixels.twitter_enabled", v)}>
                  <AdminInput label="Pixel ID" value={g("pixels.twitter_pixel_id")} onChange={(e) => set("pixels.twitter_pixel_id", e.target.value)} placeholder="xxxxxx" />
                </IntegrationCard>

                <IntegrationCard title="Pinterest Tag" subtitle="Measure performance of Pinterest ad campaigns" enabled={b("pixels.pinterest_enabled")} onToggle={(v) => tog("pixels.pinterest_enabled", v)}>
                  <AdminInput label="Tag ID" value={g("pixels.pinterest_tag_id")} onChange={(e) => set("pixels.pinterest_tag_id", e.target.value)} placeholder="1234567890123" />
                </IntegrationCard>

                <IntegrationCard title="TikTok Pixel" subtitle="Track events from TikTok ad campaigns" enabled={b("pixels.tiktok_enabled")} onToggle={(v) => tog("pixels.tiktok_enabled", v)}>
                  <AdminInput label="Pixel ID" value={g("pixels.tiktok_pixel_id")} onChange={(e) => set("pixels.tiktok_pixel_id", e.target.value)} placeholder="CXXXXXXXXXXXXXXX" />
                </IntegrationCard>
              </div>
            )}

            {/* ── Social Media ── */}
            {activeTab === "social" && (
              <div>
                {([
                  { key: "social.facebook_url",  label: "Facebook URL",   placeholder: "https://facebook.com/modortho" },
                  { key: "social.instagram_url", label: "Instagram URL",  placeholder: "https://instagram.com/modortho" },
                  { key: "social.linkedin_url",  label: "LinkedIn URL",   placeholder: "https://linkedin.com/company/modortho" },
                  { key: "social.youtube_url",   label: "YouTube URL",    placeholder: "https://youtube.com/@modortho" },
                  { key: "social.twitter_url",   label: "Twitter / X URL",placeholder: "https://twitter.com/modortho" },
                  { key: "social.pinterest_url", label: "Pinterest URL",  placeholder: "https://pinterest.com/modortho" },
                ] as const).map((item) => (
                  <FieldRow key={item.key} label={item.label}>
                    <AdminInput value={g(item.key)} onChange={(e) => set(item.key, e.target.value)} placeholder={item.placeholder} />
                  </FieldRow>
                ))}
              </div>
            )}

            {/* ── Verification ── */}
            {activeTab === "verification" && (
              <div>
                <p className="mb-4 text-[13px] text-[#8B8B8B]">These values are injected as <code className="bg-gray-100 px-1 rounded text-[11px]">&lt;meta&gt;</code> tags automatically into every page.</p>
                <FieldRow label="Google Search Console" hint="google-site-verification content value">
                  <AdminInput value={g("verification.google")} onChange={(e) => set("verification.google", e.target.value)} placeholder="xxxxxxxxxxxxx" />
                </FieldRow>
                <FieldRow label="Bing Webmaster" hint="msvalidate.01 content value">
                  <AdminInput value={g("verification.bing")} onChange={(e) => set("verification.bing", e.target.value)} placeholder="xxxxxxxxxxxxxxxxxx" />
                </FieldRow>
                <FieldRow label="Pinterest" hint="p:domain_verify content value">
                  <AdminInput value={g("verification.pinterest")} onChange={(e) => set("verification.pinterest", e.target.value)} placeholder="xxxxxxxxxxxxxxxxxx" />
                </FieldRow>
                <FieldRow label="Facebook Domain" hint="facebook-domain-verification content value">
                  <AdminInput value={g("verification.facebook_domain")} onChange={(e) => set("verification.facebook_domain", e.target.value)} />
                </FieldRow>
                <FieldRow label="Custom" hint="Paste any raw HTML meta tag">
                  <AdminTextarea value={g("verification.custom")} onChange={(e) => set("verification.custom", e.target.value)} rows={3} placeholder={`<meta name="custom-verify" content="..." />`} />
                </FieldRow>
              </div>
            )}

            {/* ── Custom Scripts ── */}
            {activeTab === "scripts" && (
              <div>
                <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] text-amber-700">
                  Scripts are injected as-is on every page. Only add code from trusted sources.
                </div>
                <FieldRow label="Header Scripts" hint="Injected via next/script afterInteractive strategy">
                  <AdminTextarea value={g("scripts.header")} onChange={(e) => set("scripts.header", e.target.value)} rows={8} placeholder="// e.g. custom pixels, A/B testing, Optimize" />
                </FieldRow>
                <FieldRow label="Footer Scripts" hint="Injected lazily (lazyOnload) — good for chat widgets">
                  <AdminTextarea value={g("scripts.footer")} onChange={(e) => set("scripts.footer", e.target.value)} rows={8} placeholder="// e.g. live chat, support widgets" />
                </FieldRow>
              </div>
            )}

            {/* ── Cookie Consent ── */}
            {activeTab === "cookies" && (
              <div>
                <FieldRow label="Enable Cookie Banner">
                  <div className="flex items-center gap-3">
                    <Toggle value={b("cookies.enabled")} onChange={(v) => tog("cookies.enabled", v)} />
                    <span className="text-[13px] text-[#6B6B6B]">{b("cookies.enabled") ? "Banner shown to new visitors" : "Banner hidden"}</span>
                  </div>
                </FieldRow>
                <FieldRow label="Banner Title">
                  <AdminInput value={g("cookies.banner_title")} onChange={(e) => set("cookies.banner_title", e.target.value)} placeholder="We use cookies" />
                </FieldRow>
                <FieldRow label="Banner Description">
                  <AdminTextarea value={g("cookies.banner_description")} onChange={(e) => set("cookies.banner_description", e.target.value)} rows={3} />
                </FieldRow>
                <FieldRow label="Privacy Policy URL">
                  <AdminInput value={g("cookies.privacy_policy_url")} onChange={(e) => set("cookies.privacy_policy_url", e.target.value)} placeholder="/privacy-policy" />
                </FieldRow>
              </div>
            )}

            {/* ── Auth Pages ── */}
            {activeTab === "auth" && (
              <div>
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Upload slider images here or paste an existing media URL. These settings control the customer login page.
                </div>

                <FieldRow label="Login Form Heading">
                  <AdminInput
                    value={g("auth.login_heading")}
                    onChange={(e) => set("auth.login_heading", e.target.value)}
                    placeholder="Customer Login"
                  />
                </FieldRow>

                <FieldRow label="Login Form Sub Heading">
                  <AdminInput
                    value={g("auth.login_sub_heading")}
                    onChange={(e) => set("auth.login_sub_heading", e.target.value)}
                    placeholder="Login to access your account"
                  />
                </FieldRow>

                <FieldRow label="Show Login Slider">
                  <div className="flex items-center gap-3">
                    <Toggle
                      value={authSliderEnabled}
                      onChange={(v) => tog("auth.login_slider_enabled", v)}
                    />
                    <span className="text-[13px] text-[#6B6B6B]">
                      {authSliderEnabled
                        ? "Slider visible on login page"
                        : "Slider hidden on login page"}
                    </span>
                  </div>
                </FieldRow>

                <div className="mt-5 flex items-center justify-between">
                  <div>
                    <div className="text-[14px] font-semibold text-[#1A1A1A]">
                      Login Slider Slides
                    </div>
                    <div className="text-[12px] text-[#8B8B8B]">
                      Add as many slides as needed. Empty slides will not be useful on the login page.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={addLoginSlide}
                    className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B]"
                  >
                    <Plus size={14} />
                    Add Slide
                  </button>
                </div>

                {!authSliderEnabled && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-700">
                    The login slider is hidden. Slides will appear only after enabling Show Login Slider and saving
                  </div>
                )}

                {loginSlides.length === 0 && (
                  <div className="mt-4 rounded-xl border border-dashed border-[#D8D8D8] bg-[#FAFAFA] px-4 py-8 text-center text-[13px] text-[#8B8B8B]">
                    No slides added yet. Click Add Slide to create one.
                  </div>
                )}

                {loginSlides.map((slide, index) => {
                  const uploadKey = `auth.login_slide_${index}_image`;
                  const isSlideVisibleOnLogin = authSliderEnabled && slide.isVisible;

                  return (
                    <div
                      key={index}
                      ref={index === loginSlides.length - 1 ? newestSlideRef : null}
                      className={cn(
                        "mt-5 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 transition-opacity",
                        !isSlideVisibleOnLogin && "opacity-60",
                      )}
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[14px] font-semibold text-[#1A1A1A]">
                            Slide {index + 1}
                          </div>
                          <div className="text-[11.5px] text-[#8B8B8B]">
                            {!authSliderEnabled
                              ? "Hidden because login slider is turned off"
                              : slide.isVisible
                                ? "Visible on login page"
                                : "Hidden from login page"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateLoginSlide(index, "isVisible", !slide.isVisible)
                            }
                            disabled={!authSliderEnabled}
                            className={cn(
                              "rounded-md border bg-white p-2 hover:bg-[#F2F2F2] disabled:cursor-not-allowed disabled:opacity-50",
                              isSlideVisibleOnLogin
                                ? "border-emerald-100 text-emerald-600"
                                : "border-[#E6E6E6] text-[#8B8B8B]",
                            )}
                            title={
                              !authSliderEnabled
                                ? "Enable login slider to manage slide visibility"
                                : slide.isVisible
                                  ? "Hide slide"
                                  : "Show slide"
                            }
                          >
                            {isSlideVisibleOnLogin ? <Eye size={14} /> : <EyeOff size={14} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLoginSlide(index, "up")}
                            disabled={index === 0}
                            className="rounded-md border border-[#E6E6E6] bg-white p-2 text-[#6B6B6B] hover:bg-[#F2F2F2] disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveLoginSlide(index, "down")}
                            disabled={index === loginSlides.length - 1}
                            className="rounded-md border border-[#E6E6E6] bg-white p-2 text-[#6B6B6B] hover:bg-[#F2F2F2] disabled:cursor-not-allowed disabled:opacity-40"
                            title="Move down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeLoginSlide(index)}
                            className="rounded-md border border-red-100 bg-white p-2 text-red-600 hover:bg-red-50"
                            title="Remove slide"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      <FieldRow
                        label="Image"
                        hint="Upload a new image or paste an existing /uploads or Cloudinary URL."
                      >
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <AdminInput
                              value={slide.image}
                              onChange={(e) =>
                                updateLoginSlide(index, "image", e.target.value)
                              }
                              placeholder="/auth/login1.jpg"
                            />
                            <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#1A1A1A] px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#333]">
                              <Upload size={14} />
                              {uploadingKey === uploadKey ? "Uploading…" : "Upload"}
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingKey === uploadKey}
                                onChange={(event) =>
                                  handleSlideImageUpload(index, event)
                                }
                              />
                            </label>
                          </div>

                          {slide.image && (
                            <div
                              className="h-28 overflow-hidden rounded-lg border border-[#E6E6E6] bg-cover bg-center"
                              style={{ backgroundImage: `url(${slide.image})` }}
                            />
                          )}
                        </div>
                      </FieldRow>

                      <FieldRow label="Heading">
                        <AdminInput
                          value={slide.heading}
                          onChange={(e) =>
                            updateLoginSlide(index, "heading", e.target.value)
                          }
                          placeholder="Slide heading"
                        />
                      </FieldRow>

                      <FieldRow label="Sub Heading">
                        <AdminTextarea
                          value={slide.subHeading}
                          onChange={(e) =>
                            updateLoginSlide(index, "subHeading", e.target.value)
                          }
                          rows={2}
                          placeholder="Short supporting text"
                        />
                      </FieldRow>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── WhatsApp ── */}
            {activeTab === "whatsapp" && (
              <div>
                <FieldRow label="Show Floating Button">
                  <div className="flex items-center gap-3">
                    <Toggle value={b("whatsapp.floating_button_enabled")} onChange={(v) => tog("whatsapp.floating_button_enabled", v)} />
                    <span className="text-[13px] text-[#6B6B6B]">{b("whatsapp.floating_button_enabled") ? "Green button visible on all pages" : "Button hidden"}</span>
                  </div>
                </FieldRow>
                <FieldRow label="WhatsApp Number" hint="Include country code, digits only. E.g. 919876543210">
                  <AdminInput value={g("whatsapp.number")} onChange={(e) => set("whatsapp.number", e.target.value)} placeholder="919876543210" />
                </FieldRow>
                <FieldRow label="Default Message" hint="Pre-filled message when visitor opens WhatsApp">
                  <AdminTextarea value={g("whatsapp.default_message")} onChange={(e) => set("whatsapp.default_message", e.target.value)} rows={2} />
                </FieldRow>
              </div>
            )}

            {/* ── Email / SMTP ── */}
            {activeTab === "email" && (
              <div>
                <p className="mb-4 text-[13px] text-[#8B8B8B]">Used for transactional emails. SMTP password is AES-256-GCM encrypted at rest — never exposed to the frontend.</p>
                <FieldRow label="SMTP Host">
                  <AdminInput value={g("email.smtp_host")} onChange={(e) => set("email.smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
                </FieldRow>
                <FieldRow label="SMTP Port">
                  <AdminInput value={g("email.smtp_port")} onChange={(e) => set("email.smtp_port", e.target.value)} placeholder="587" />
                </FieldRow>
                <FieldRow label="SMTP Username">
                  <AdminInput value={g("email.smtp_user")} onChange={(e) => set("email.smtp_user", e.target.value)} />
                </FieldRow>
                <FieldRow label="SMTP Password">
                  <SecretInput value={g("email.smtp_password")} onChange={(v) => set("email.smtp_password", v)} />
                </FieldRow>
                <FieldRow label="From Name">
                  <AdminInput value={g("email.from_name")} onChange={(e) => set("email.from_name", e.target.value)} placeholder="Modern Orthodontics" />
                </FieldRow>
                <FieldRow label="From Email">
                  <AdminInput type="email" value={g("email.from_email")} onChange={(e) => set("email.from_email", e.target.value)} placeholder="noreply@modortho.com" />
                </FieldRow>
              </div>
            )}

          </fieldset>
        </div>
      </div>
    </AdminLayout>
  );
}
