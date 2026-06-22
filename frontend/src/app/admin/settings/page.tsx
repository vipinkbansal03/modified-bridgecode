"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Globe, Search, BarChart2, Megaphone, Share2, ShieldCheck, Code2, Cookie, MessageCircle, Mail,
  CheckCircle2, AlertCircle, Eye, EyeOff, Save, RefreshCw,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";
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
  { id: "whatsapp",     label: "WhatsApp",          icon: MessageCircle },
  { id: "email",        label: "Email / SMTP",      icon: Mail },
];

type Setting = { id: string; key: string; value: string; group: string; label?: string | null; type: string; isSecret: boolean; isEnabled: boolean };
type SettingMap = Record<string, string>;

// ─── Sub-components ───────────────────────────────────────────────────────────

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
  const [activeTab, setActiveTab] = useState("general");
  const [settings, setSettings] = useState<SettingMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const r = await adminApi.get("/settings");
      const rows: Setting[] = r.data.data ?? [];
      const map: SettingMap = {};
      rows.forEach((s) => { map[s.key] = s.value === "***" ? "" : s.value; });
      setSettings(map);
    } catch { showToast("Failed to load settings.", "error"); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  function set(key: string, value: string) { setSettings((s) => ({ ...s, [key]: value })); }
  function tog(key: string, v: boolean)    { set(key, String(v)); }
  const g = (key: string) => settings[key] ?? "";
  const b = (key: string) => settings[key] === "true";

  const handleSave = async () => {
    setSaving(true);
    try {
      const settingsList = Object.entries(settings)
        .filter(([key]) => SETTINGS_META[key])
        .map(([key, value]) => ({
          key,
          value,
          group:    SETTINGS_META[key]!.group,
          type:     SETTINGS_META[key]!.type,
          isSecret: SETTINGS_META[key]!.isSecret ?? false,
        }));
      await adminApi.put("/settings", { settings: settingsList });
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
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{TABS.find((t) => t.id === activeTab)?.label}</h2>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-50">
              <Save size={13} />{saving ? "Saving…" : "Save Settings"}
            </button>
          </div>

          <div className="rounded-xl border border-[#E6E6E6] bg-white p-6">

            {/* ── General ── */}
            {activeTab === "general" && (
              <div>
                <FieldRow label="Website Name"><AdminInput value={g("general.site_name")} onChange={(e) => set("general.site_name", e.target.value)} placeholder="Modern Orthodontics" /></FieldRow>
                <FieldRow label="Website URL"><AdminInput value={g("general.site_url")} onChange={(e) => set("general.site_url", e.target.value)} placeholder="https://modortho.com" /></FieldRow>
                <FieldRow label="Company Name"><AdminInput value={g("general.company_name")} onChange={(e) => set("general.company_name", e.target.value)} /></FieldRow>
                <FieldRow label="Contact Email"><AdminInput type="email" value={g("general.email")} onChange={(e) => set("general.email", e.target.value)} /></FieldRow>
                <FieldRow label="Phone"><AdminInput value={g("general.phone")} onChange={(e) => set("general.phone", e.target.value)} /></FieldRow>
                <FieldRow label="Address"><AdminTextarea value={g("general.address")} onChange={(e) => set("general.address", e.target.value)} rows={2} /></FieldRow>
                <FieldRow label="Logo URL" hint="Full URL or /uploads/... path"><AdminInput value={g("general.logo")} onChange={(e) => set("general.logo", e.target.value)} /></FieldRow>
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

          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
