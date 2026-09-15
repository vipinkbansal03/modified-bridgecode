"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Globe, Search, BarChart2, Megaphone, Share2, ShieldCheck, Code2, Cookie, MessageCircle, Mail,
  CheckCircle2, AlertCircle, Eye, EyeOff, Save, RefreshCw, Lock, Upload, Plus, Trash2, ArrowUp, ArrowDown, Scale, Info, ImageIcon,
} from "lucide-react";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminTextarea, AdminSelect, useToast, LoadingButton, AdminStickySaveBar } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { Logo } from "@/components/ui/Logo";
import { cn } from "@/utils/cn";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { useAdminCountries, useAdminCmsPages } from "@/hooks/admin/useAdminHooks";

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
  { id: "tax",          label: "Tax & Compliance",  icon: Scale },
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
  // Tax & Compliance
  "tax.seller_name":         { group: "tax",      type: "string" },
  "tax.seller_gstin":        { group: "tax",      type: "string" },
  "tax.seller_iec":          { group: "tax",      type: "string" },
  "tax.ship_from_state":     { group: "tax",      type: "string" },
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
  "auth.otp_test_mode":             { group: "auth", type: "boolean" },
  // WhatsApp
  "whatsapp.provider":                { group: "whatsapp", type: "string" },
  "whatsapp.number":                  { group: "whatsapp", type: "string" },
  "whatsapp.default_message":         { group: "whatsapp", type: "string" },
  "whatsapp.floating_button_enabled": { group: "whatsapp", type: "boolean" },
  "whatsapp.enabled":                 { group: "whatsapp", type: "boolean" },
  "whatsapp.msg91_auth_key":          { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.msg91_integrated_number": { group: "whatsapp", type: "string" },
  "whatsapp.tata_base_url":           { group: "whatsapp", type: "string" },
  "whatsapp.tata_sender":             { group: "whatsapp", type: "string" },
  "whatsapp.tata_bearer_token":       { group: "whatsapp", type: "secret", isSecret: true },
  // Email
  "email.enabled":                 { group: "email", type: "boolean" },
  "email.country_routing_enabled": { group: "email", type: "boolean" },
  "email.provider":                { group: "email", type: "string" },
  "email.msg91_enabled":           { group: "email", type: "boolean" },
  "email.smtp_enabled":            { group: "email", type: "boolean" },
  "email.resend_enabled":          { group: "email", type: "boolean" },
  "email.from_name":               { group: "email", type: "string" },
  "email.from_email":              { group: "email", type: "string" },
  "email.notify_email":            { group: "email", type: "string" },
  "email.msg91_auth_key":          { group: "email", type: "secret", isSecret: true },
  "email.msg91_domain":            { group: "email", type: "string" },
  "email.smtp_host":               { group: "email", type: "string" },
  "email.smtp_port":               { group: "email", type: "string" },
  "email.smtp_user":               { group: "email", type: "string" },
  "email.smtp_password":           { group: "email", type: "secret", isSecret: true },
  "email.smtp_secure":             { group: "email", type: "boolean" },
  "email.resend_api_key":          { group: "email", type: "secret", isSecret: true },
  // SMS Settings
  "sms.enabled":              { group: "sms", type: "boolean" },
  "sms.provider":             { group: "sms", type: "string" },
  "sms.msg91_auth_key":       { group: "sms", type: "secret", isSecret: true },
  "sms.msg91_sender_id":      { group: "sms", type: "string" },
  "sms.msg91_otp_template_id": { group: "sms", type: "string" },
  "sms.msg91_flow_id":        { group: "sms", type: "string" },
  "sms.twilio_account_sid":   { group: "sms", type: "string" },
  "sms.twilio_auth_token":    { group: "sms", type: "secret", isSecret: true },
  "sms.twilio_phone":         { group: "sms", type: "string" },
  // Payments
  "payment.razorpay_enabled":    { group: "payments", type: "boolean" },
  "payment.razorpay_key_id":     { group: "payments", type: "string" },
  "payment.razorpay_key_secret": { group: "payments", type: "secret", isSecret: true },
  // Uploads
  "uploads.cloudinary_enabled":    { group: "uploads", type: "boolean" },
  "uploads.cloudinary_cloud_name": { group: "uploads", type: "string" },
  "uploads.cloudinary_api_key":     { group: "uploads", type: "string" },
  "uploads.cloudinary_api_secret":  { group: "uploads", type: "secret", isSecret: true },
  // Redis Cache
  "redis.enabled": { group: "redis", type: "boolean" },
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
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
    if (containerRef.current) {
      const scrollParent = containerRef.current.closest("main");
      if (scrollParent) {
        scrollParent.scrollTop = 0;
      }
    }
  };

  const { data: countries = [] } = useAdminCountries();
  const defaultCountry = countries.find((c: any) => c.isDefault);
  const [selectedCountryCode, setSelectedCountryCode] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const searchParams = new URLSearchParams(window.location.search);
      const tabParam = searchParams.get("tab");
      if (tabParam) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  useEffect(() => {
    if (countries.length > 0 && !selectedCountryCode) {
      const defaultCountry = countries.find((c: any) => c.isDefault) ?? countries[0];
      if (defaultCountry) {
        setSelectedCountryCode(defaultCountry.code);
      }
    }
  }, [countries, selectedCountryCode]);

  const { data: cmsPagesResponse } = useAdminCmsPages();

  const privacyPageOptions = useMemo(() => {
    const defaultPages = [
      { label: "Privacy Policy", value: "/privacy-policy" },
      { label: "Terms & Conditions", value: "/terms-and-conditions" },
      { label: "Home", value: "/" },
      { label: "About Us", value: "/about" },
      { label: "Contact Us", value: "/contact" },
      { label: "Quality & Certifications", value: "/quality-certifications" },
      { label: "Manufacturing Services", value: "/manufacturing-services" },
      { label: "OEM Services", value: "/oem-services" },
      { label: "Design & Engineering", value: "/design-and-engineering" },
      { label: "Custom Packaging", value: "/custom-packaging" },
      { label: "Products Catalog", value: "/products" },
    ];

    const raw = cmsPagesResponse as { data?: any[] } | any[] | undefined;
    const cmsPagesArray = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);

    const cmsList = cmsPagesArray
      .filter((p: any) => p && p.slug && p.title)
      .map((p: any) => ({
        label: p.title || p.slug,
        value: p.slug.startsWith("/") ? p.slug : `/${p.slug}`,
      }));

    const map = new Map<string, string>();
    [...defaultPages, ...cmsList].forEach((opt) => {
      if (!map.has(opt.value)) map.set(opt.value, opt.label);
    });

    return Array.from(map.entries()).map(([value, label]) => ({ label, value }));
  }, [cmsPagesResponse]);

  const [settings, setSettings] = useState<SettingMap>({});
  const [loginSlides, setLoginSlides] = useState<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [mediaTarget, setMediaTarget] = useState<
    { type: "setting"; key: "general.logo" | "general.mobile_logo" | "general.favicon" } | { type: "slide"; index: number } | null
  >(null);
  const shouldScrollToNewSlideRef = useRef(false);
  const newestSlideRef = useRef<HTMLDivElement | null>(null);
  const [savedSettings, setSavedSettings] = useState<SettingMap>({});
  const savedLoginSlidesRef = useRef<LoginSlide[]>(DEFAULT_LOGIN_SLIDES);
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const queryClient = useQueryClient();
  const { showToast, ToastComponent } = useToast();

  const handleSendTestEmail = async (provider?: string) => {
    if (!testEmailAddress || !testEmailAddress.includes("@")) {
      showToast("Please enter a valid recipient email address to send test email.", "error");
      return;
    }
    setTestingEmail(true);
    try {
      const res = await adminApi.post("/settings/test-email", {
        toEmail: testEmailAddress.trim(),
        provider: provider || g("email.provider") || "msg91",
      });
      showToast(res.data.message || "Test email sent successfully!", "success");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to send test email."), "error");
    } finally {
      setTestingEmail(false);
    }
  };

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
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const uploadKey = `auth.login_slide_${index}_image`;

    try {
      setUploadingKey(uploadKey);
      const results = await uploadMediaFiles([file], {
        entityType: "SYSTEM",
        purpose: "LOGIN_SLIDE"
      });
      const url = results[0]?.url;

      if (!url) {
        throw new Error("Upload response did not include an image URL.");
      }

      updateLoginSlide(index, "image", url);
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

    try {
      setUploadingKey(key);
      const results = await uploadMediaFiles([file], {
        entityType: "SYSTEM",
        purpose: "BRANDING"
      });
      const url = results[0]?.url;

      if (!url) {
        throw new Error("Upload response did not include an image URL.");
      }

      set(key, url);
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
        .filter(([key]) => SETTINGS_META[key] || key.startsWith("social.") || key.startsWith("email."))
        .map(([key, value]) => ({
          key,
          value,
          group:    SETTINGS_META[key]?.group ?? (key.startsWith("email.") ? "email" : "social"),
          type:     SETTINGS_META[key]?.type ?? (key.endsWith("_enabled") || key.endsWith(".enabled") ? "boolean" : "string"),
          isSecret: SETTINGS_META[key]?.isSecret ?? (key.includes("password") || key.includes("auth_key") || key.includes("api_key") || key.includes("token")),
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
      <div ref={containerRef} className="flex items-start gap-6">

        {/* ── Sidebar ── */}
        <aside className="w-[200px] flex-none sticky top-0">
          <nav className="space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3.5 py-2.5 text-[13px] font-medium text-left transition-colors",
                    activeTab === tab.id ? "bg-[#E31E24] text-white shadow-xs" : "text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
                  )}>
                  <Icon size={14} className="flex-none" />{tab.label}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* ── Content ── */}
        <div className="flex-1 min-w-0">
          <AdminStickySaveBar
            title={TABS.find((t) => t.id === activeTab)?.label}
            subtitle={canUpdate ? "Changes are not applied until you save." : undefined}
            isReadOnly={!canUpdate}
            readOnlyMessage="Read-only mode. You do not have permissions to edit store settings."
            isDirty={isDirty}
            saving={saving}
            savingText="Saving…"
            saveLabel="Save Settings"
            onSave={handleSave}
            showSave={canUpdate}
            stickyOffsetClass="-top-5 sm:-top-6"
          />

          <fieldset disabled={!canUpdate} className="rounded-xl border border-[#E6E6E6] bg-white p-6 disabled:opacity-90">

            {/* ── General ── */}
            {activeTab === "general" && (
              <div className="space-y-6">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Manage core website identity, canonical domain URL, brand logos, favicon, and customer support contact details.
                </div>

                {/* Card 1: Storefront Identity & Branding */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-5">
                  <div className="border-b border-[#E5E7EB] pb-3">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                      Storefront Identity & Branding
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Configure public website identity, canonical URLs, header/footer logos, and browser favicon.
                    </p>
                  </div>

                  <FieldRow label="Website Name" hint="Live browser tab title suffix, OpenGraph site identity, and brand alt text">
                    <AdminInput
                      value={g("general.site_name")}
                      onChange={(e) => set("general.site_name", e.target.value)}
                      placeholder="Modern Orthodontics"
                    />
                  </FieldRow>

                  <FieldRow label="Website URL" hint="Canonical site address for sitemaps and share links">
                    <AdminInput
                      value={g("general.site_url")}
                      onChange={(e) => set("general.site_url", e.target.value)}
                      placeholder="https://modortho.com"
                    />
                  </FieldRow>

                  {/* ── Logo & Branding Section ── */}
                  <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                      <div>
                        <h4 className="text-[14px] font-bold text-[#1A1A1A]">Header & Footer Brand Logos</h4>
                        <p className="text-[12px] text-[#6B7280]">Manage desktop and mobile logos rendered across the storefront.</p>
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
                        <button
                          type="button"
                          onClick={() => setMediaTarget({ type: "setting", key: "general.logo" })}
                          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#B5151B] transition-colors"
                        >
                          <ImageIcon size={14} />
                          <span>Browse Media Library</span>
                        </button>
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
                        <button
                          type="button"
                          onClick={() => setMediaTarget({ type: "setting", key: "general.mobile_logo" })}
                          className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#B5151B] transition-colors"
                        >
                          <ImageIcon size={14} />
                          <span>Browse Media Library</span>
                        </button>
                      </div>
                    </FieldRow>
                  </div>

                  {/* Favicon URL */}
                  <FieldRow label="Favicon URL" hint="Browser tab icon image (.ico, .png, .svg). When blank, defaults to standard red MO icon.">
                    <div className="flex items-center gap-3">
                      {g("general.favicon") ? (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-1.5 shadow-2xs" title="Custom Favicon Preview">
                          <img src={g("general.favicon")} alt="Favicon Preview" className="h-full w-full object-contain" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E31E24] text-white font-bold text-xs shadow-2xs select-none" title="Default System Favicon (MO)">
                          MO
                        </div>
                      )}
                      <AdminInput
                        value={g("general.favicon")}
                        onChange={(e) => set("general.favicon", e.target.value)}
                        placeholder="Default: Standard MO Icon (/icon)"
                      />
                      {g("general.favicon") && (
                        <button
                          type="button"
                          onClick={() => {
                            set("general.favicon", "");
                            showToast("Favicon reset to default MO icon.", "info");
                          }}
                          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#E5E7EB] bg-white px-2.5 py-2 text-xs font-semibold text-[#E31E24] shadow-2xs hover:bg-[#FEF2F2]"
                          title="Reset to default MO icon"
                        >
                          <RefreshCw size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setMediaTarget({ type: "setting", key: "general.favicon" })}
                        className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-[#B5151B] transition-colors"
                      >
                        <ImageIcon size={14} />
                        <span>Browse Media Library</span>
                      </button>
                    </div>
                  </FieldRow>
                </div>

                {/* Card 2: Corporate & Contact Details */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#E5E7EB] pb-3">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                      Corporate & Contact Details
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Global corporate headquarters contact details. Automatically displayed on the Contact Us page (<span className="font-mono text-[11px]">/contact</span>), Storefront Footer, and generated Invoice/Quote PDFs.
                    </p>
                  </div>

                  <FieldRow label="Company Legal Name" hint="Corporate entity name displayed in invoices, receipts, and legal copyright">
                    <AdminInput
                      value={g("general.company_name")}
                      onChange={(e) => set("general.company_name", e.target.value)}
                      placeholder="Modern Orthodontics Pvt Ltd"
                    />
                  </FieldRow>

                  <FieldRow label="Primary Contact Email" hint="Default email for inquiries and customer contact">
                    <AdminInput
                      type="email"
                      value={g("general.email")}
                      onChange={(e) => set("general.email", e.target.value)}
                      placeholder="orders@modortho.com"
                    />
                  </FieldRow>

                  <FieldRow label="Primary Contact Phone" hint="Main corporate phone number">
                    <AdminInput
                      value={g("general.phone")}
                      onChange={(e) => set("general.phone", e.target.value)}
                      placeholder="+91 161 2432024"
                    />
                  </FieldRow>

                  <FieldRow label="Registered Company Address" hint="Official headquarters address">
                    <AdminTextarea
                      value={g("general.address")}
                      onChange={(e) => set("general.address", e.target.value)}
                      rows={2}
                      placeholder="2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India"
                    />
                  </FieldRow>
                </div>

                {/* Card 3: System Timezone & Localization */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#E5E7EB] pb-3">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">
                      System Timezone & Localization
                    </h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Server timezone for timestamps, scheduling, activity logs, and financial exports.
                    </p>
                  </div>

                  <FieldRow label="System Timezone" hint="Server operating timezone for admin logs and scheduling">
                    <AdminSelect
                      value={g("general.timezone")}
                      onChange={(e) => set("general.timezone", e.target.value)}
                      options={[
                        { value: "Asia/Kolkata", label: "Asia/Kolkata (IST — UTC+5:30)" },
                        { value: "UTC", label: "UTC (Coordinated Universal Time)" },
                        { value: "America/New_York", label: "America/New_York (EST — UTC-5:00)" },
                        { value: "Europe/London", label: "Europe/London (GMT/BST)" },
                      ]}
                    />
                  </FieldRow>

                  <div className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-3 text-[12px] text-[#6B7280]">
                    💡 Regional currencies, live exchange rates, and base currencies are managed under <Link href="/admin/currencies" className="font-medium text-[#0F6CBD] underline hover:text-[#0c4a80]">Admin → Currencies</Link>. Default storefront countries and mappings are managed under <Link href="/admin/countries" className="font-medium text-[#0F6CBD] underline hover:text-[#0c4a80]">Admin → Countries</Link>.
                  </div>
                </div>
              </div>
            )}

            {/* ── SEO ── */}
            {activeTab === "seo" && (
              <div>
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Configure global search engine optimization (SEO), OpenGraph social preview cards, XML sitemaps, and robots.txt crawling rules.
                </div>

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
                    {
                      key: "seo.sitemap_include_products",
                      label: "Include Products",
                      hint: "Adds all active product detail URLs (/products/:slug) to /sitemap.xml for Google indexing.",
                    },
                    {
                      key: "seo.sitemap_include_categories",
                      label: "Include Categories",
                      hint: "Adds public catalog category collection URLs (/products?category=:slug) to the sitemap.",
                    },
                    {
                      key: "seo.sitemap_include_blogs",
                      label: "Include Blogs",
                      hint: "Adds all published articles and educational blogs (/blog/:slug) to the sitemap.",
                    },
                    {
                      key: "seo.sitemap_include_cms_pages",
                      label: "Include CMS Pages",
                      hint: "Adds all active CMS pages (/about, /contact, /quality-certifications, etc.) to the sitemap.",
                    },
                  ] as const).map((item) => {
                    const isEnabled = b(item.key);
                    return (
                      <div key={item.key} className="flex items-center justify-between py-3 border-b border-[#F4F4F4] last:border-0">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[13.5px] font-medium text-[#1A1A1A]">{item.label}</span>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                                isEnabled
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-gray-100 text-gray-600 border border-gray-200"
                              )}
                            >
                              {isEnabled ? "Included in /sitemap.xml" : "Excluded from sitemap"}
                            </span>
                          </div>
                          <p className="mt-0.5 text-[12px] text-[#6B7280]">{item.hint}</p>
                        </div>
                        <Toggle value={isEnabled} onChange={(v) => tog(item.key, v)} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Analytics ── */}
            {activeTab === "analytics" && (
              <div className="space-y-5">
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Connect Google Analytics, GTM, Clarity, and Hotjar to track website visitors, view behavior heatmaps, and monitor customer traffic.
                </div>

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
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Connect ad tracking pixels (Meta, LinkedIn, Twitter/X, TikTok, Pinterest) to measure ad conversions and run retargeting campaigns.
                </div>

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
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Connect official brand social channels (Facebook, Instagram, LinkedIn, YouTube, X, Pinterest) per country with automatic global fallback.
                </div>

                {countries.length > 0 && (
                  <div className="mb-6 space-y-4">
                    {defaultCountry && (
                      <div className="rounded-lg border border-[#E31E24]/20 bg-[#E31E24]/[0.02] p-3 text-[13px] text-[#1A1A1A] leading-relaxed flex gap-2.5">
                        <Info size={16} className="mt-0.5 shrink-0 text-[#E31E24]" />
                        <div>
                          <strong className="text-[#1A1A1A]">Default Country: {defaultCountry.name} ({defaultCountry.code.toUpperCase()})</strong>
                          <span className="text-[#6B6B6B]"> — Used as the fallback when a country has no social media links configured. You can change the default country in <Link href="/admin/countries" className="underline font-semibold hover:text-[#E31E24] transition-colors">Countries Management</Link>.</span>
                        </div>
                      </div>
                    )}
                    <div className="max-w-xs">
                      <AdminSelect
                        label="Country / Region"
                        value={selectedCountryCode}
                        onChange={(e) => setSelectedCountryCode(e.target.value)}
                        options={countries.map((c: any) => ({
                          value: c.code,
                          label: `${c.name} (${c.code.toUpperCase()})`
                        }))}
                      />
                    </div>
                  </div>
                )}
                {([
                  { platform: "facebook",  label: "Facebook URL",   placeholder: "https://facebook.com/modortho" },
                  { platform: "instagram", label: "Instagram URL",  placeholder: "https://instagram.com/modortho" },
                  { platform: "linkedin",  label: "LinkedIn URL",   placeholder: "https://linkedin.com/company/modortho" },
                  { platform: "youtube",   label: "YouTube URL",    placeholder: "https://youtube.com/@modortho" },
                  { platform: "twitter",   label: "Twitter / X URL",placeholder: "https://twitter.com/modortho" },
                  { platform: "pinterest", label: "Pinterest URL",  placeholder: "https://pinterest.com/modortho" },
                ] as const).map((item) => {
                  const key = selectedCountryCode ? `social.${selectedCountryCode.toUpperCase()}.${item.platform}_url` : `social.${item.platform}_url`;
                  
                  let placeholder: string = item.placeholder;
                  const isCurrentDefault = defaultCountry && selectedCountryCode.toUpperCase() === defaultCountry.code.toUpperCase();
                  if (!isCurrentDefault && defaultCountry) {
                    const fallbackVal = g(`social.${defaultCountry.code.toUpperCase()}.${item.platform}_url`) || g(`social.${item.platform}_url`);
                    if (fallbackVal) {
                      placeholder = `${fallbackVal} (Fallback from ${defaultCountry.name})`;
                    }
                  }

                  return (
                    <FieldRow key={item.platform} label={item.label}>
                      <AdminInput value={g(key)} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} />
                    </FieldRow>
                  );
                })}
              </div>
            )}

            {/* ── Verification ── */}
            {activeTab === "verification" && (
              <div>
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Prove domain ownership to search engines and platforms (Google Search Console, Bing, Facebook, Pinterest) to activate indexing and security.
                </div>

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
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Paste custom JavaScript codes or third-party widgets (such as Live Chat, A/B testing, or surveys) to inject them into the website.
                </div>

                <FieldRow label="Header Scripts" hint="Injected into page header (afterInteractive) — best for A/B testing & custom tracking">
                  <AdminTextarea value={g("scripts.header")} onChange={(e) => set("scripts.header", e.target.value)} rows={8} placeholder="// e.g. custom pixels, A/B testing, Optimize" />
                </FieldRow>
                <FieldRow label="Footer Scripts" hint="Injected at page bottom (lazyOnload) — best for Live Chat & Support widgets">
                  <AdminTextarea value={g("scripts.footer")} onChange={(e) => set("scripts.footer", e.target.value)} rows={8} placeholder="// e.g. live chat, support widgets" />
                </FieldRow>
              </div>
            )}

            {/* ── Cookie Consent ── */}
            {activeTab === "cookies" && (
              <div>
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Enable a GDPR & CCPA compliant cookie notice for visitors. If a visitor clicks Reject, analytics and tracking scripts are automatically blocked.
                </div>

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
                <FieldRow label="Privacy Policy Page" hint="Select the legal privacy page linked inside the banner">
                  <AdminSelect
                    value={g("cookies.privacy_policy_url") || "/privacy-policy"}
                    onChange={(e) => set("cookies.privacy_policy_url", e.target.value)}
                    options={privacyPageOptions}
                  />
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

                <FieldRow
                  label="OTP Test Mode"
                  hint="When enabled, the 6-digit verification code is displayed directly in the verification modal with a 1-click Auto-fill button, and standard code 123456 is accepted. Recommended during staging, development, and testing before live SMS credits."
                >
                  <div className="flex items-center gap-3">
                    <Toggle
                      value={b("auth.otp_test_mode")}
                      onChange={(v) => tog("auth.otp_test_mode", v)}
                    />
                    <span className="text-[13px] text-[#6B6B6B]">
                      {b("auth.otp_test_mode")
                        ? "Active (Shows test OTP on screen & accepts 123456)"
                        : "Disabled (Dispatches live SMS to mobile)"}
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
                            <button
                              type="button"
                              onClick={() => setMediaTarget({ type: "slide", index })}
                              className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B] shadow-2xs"
                            >
                              <ImageIcon size={14} />
                              <span>Browse Media Library</span>
                            </button>
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
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Enable a floating WhatsApp chat button on the website to let prospective doctors and distributors contact your sales team directly.
                </div>

                <FieldRow label="Show Floating Button">
                  <div className="flex items-center gap-3">
                    <Toggle value={b("whatsapp.floating_button_enabled")} onChange={(v) => tog("whatsapp.floating_button_enabled", v)} />
                    <span className="text-[13px] text-[#6B6B6B]">
                      {b("whatsapp.floating_button_enabled")
                        ? g("whatsapp.number").trim()
                          ? "Green button visible on all pages"
                          : "Enabled (requires Business Mobile Number below to display)"
                        : "Button hidden"}
                    </span>
                  </div>
                </FieldRow>

                {b("whatsapp.floating_button_enabled") && !g("whatsapp.number").trim() && (
                  <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12.5px] leading-relaxed text-amber-800 flex items-center gap-2">
                    <AlertCircle size={15} className="shrink-0 text-amber-600" />
                    <span>Please enter your <strong>Business Mobile Number</strong> below so the button knows which phone receives customer chats.</span>
                  </div>
                )}

                <FieldRow label="Business Mobile Number" hint="Enter phone number with country code (e.g. 919876543210). Customers will chat directly with this number.">
                  <AdminInput value={g("whatsapp.number")} onChange={(e) => set("whatsapp.number", e.target.value)} placeholder="919876543210" />
                </FieldRow>
                <FieldRow label="Default Chat Greeting" hint="Optional pre-filled message that appears in the customer's chat box when they click the button">
                  <AdminTextarea value={g("whatsapp.default_message")} onChange={(e) => set("whatsapp.default_message", e.target.value)} rows={2} placeholder="Hi Modern Orthodontics, I would like to inquire about your products." />
                </FieldRow>

                <div className="mt-8 pt-6 border-t border-[#E6E6E6]">
                  <h3 className="text-[14.5px] font-semibold text-[#1A1A1A] mb-4">WhatsApp Notification Service Settings</h3>
                  
                  <FieldRow label="Enable WhatsApp Notifications">
                    <div className="flex items-center gap-3">
                      <Toggle value={b("whatsapp.enabled")} onChange={(v) => tog("whatsapp.enabled", v)} />
                      <span className="text-[13px] text-[#6B6B6B]">
                        {b("whatsapp.enabled") ? "Active (Sends transaction alerts to customers)" : "Disabled"}
                      </span>
                    </div>
                  </FieldRow>

                  <FieldRow label="Active WhatsApp Provider">
                    <AdminSelect
                      value={g("whatsapp.provider") || "msg91"}
                      onChange={(e) => set("whatsapp.provider", e.target.value)}
                      options={[
                        { value: "msg91", label: "MSG91 WhatsApp (Recommended)" },
                        { value: "tata", label: "Tata Tele Business (Tata BSP)" },
                      ]}
                    />
                  </FieldRow>

                  {(g("whatsapp.provider") === "msg91" || !g("whatsapp.provider")) ? (
                    <>
                      <FieldRow label="MSG91 AuthKey" hint="Leave blank to automatically use the MSG91 AuthKey configured under Email / SMTP">
                        <SecretInput value={g("whatsapp.msg91_auth_key")} onChange={(v) => set("whatsapp.msg91_auth_key", v)} placeholder="Inherited from Email MSG91 AuthKey if blank" />
                      </FieldRow>
                      <FieldRow label="MSG91 WhatsApp Integrated Number" hint="Registered WhatsApp business phone number with country code (e.g. 919240213800)">
                        <AdminInput value={g("whatsapp.msg91_integrated_number")} onChange={(e) => set("whatsapp.msg91_integrated_number", e.target.value)} placeholder="919240213800" />
                      </FieldRow>
                    </>
                  ) : (
                    <>
                      <FieldRow label="Tata Base URL">
                        <AdminInput value={g("whatsapp.tata_base_url")} onChange={(e) => set("whatsapp.tata_base_url", e.target.value)} placeholder="https://wb.omni.tatatelebusiness.com" />
                      </FieldRow>
                      <FieldRow label="Tata Sender / Bot ID">
                        <AdminInput value={g("whatsapp.tata_sender")} onChange={(e) => set("whatsapp.tata_sender", e.target.value)} placeholder="1073459305848682" />
                      </FieldRow>
                      <FieldRow label="Tata Bearer Token">
                        <SecretInput value={g("whatsapp.tata_bearer_token")} onChange={(v) => set("whatsapp.tata_bearer_token", v)} />
                      </FieldRow>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ── Email & Communications ── */}
            {activeTab === "email" && (
              <div className="space-y-6">
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Configure outgoing transactional email service, choose your active provider with 1-click toggles, map dedicated senders for specific events (forgot password, orders, quotes, support), and define country-specific sender routing. Passwords and API keys are securely encrypted at rest.
                </div>

                {/* Section 1A: Master Automated Email Switch */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">Master Outgoing Email Service</h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Global switch to enable or pause all outgoing emails (order updates, password resets, quotes).
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-[#1A1A1A]">System Email Status:</span>
                    <Toggle value={b("email.enabled")} onChange={(v) => tog("email.enabled", v)} />
                    <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full", b("email.enabled") ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-500")}>
                      {b("email.enabled") ? "Emails Active" : "Emails Paused"}
                    </span>
                  </div>
                </div>

                {/* Section 1B: Active Email Provider Selection */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-4">
                  <div className="border-b border-[#E5E7EB] pb-3">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">Active Email Service Provider</h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Select the single engine that delivers your emails. Only the chosen engine is used; all other providers remain inactive.
                    </p>
                  </div>

                  {/* Provider Dropdown */}
                  <div>
                    <label className="block text-[13px] font-semibold text-[#1A1A1A] mb-1.5">
                      Choose Active Engine:
                    </label>
                    <AdminSelect
                      value={g("email.provider") || "msg91"}
                      onChange={(e) => set("email.provider", e.target.value)}
                      options={[
                        { value: "msg91", label: "MSG91 Email API (Default & Recommended)" },
                        { value: "nodemailer", label: "Nodemailer SMTP (Gmail / Custom Server Relay)" },
                        { value: "resend", label: "Resend API (Developer Email Delivery Platform)" },
                      ]}
                    />
                  </div>

                  {/* Active Engine Notice */}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3 text-[12.5px] text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                    <span>
                      <strong>Currently Selected: {((g("email.provider") || "msg91") === "msg91" ? "MSG91 Email API" : (g("email.provider") === "nodemailer" ? "Nodemailer SMTP" : "Resend API"))}.</strong> Only this provider will dispatch outgoing emails. Other providers are completely inactive.
                    </span>
                  </div>

                  {/* Provider Credentials Form */}
                  <div className="pt-2 space-y-4">
                    {(g("email.provider") === "msg91" || !g("email.provider")) && (
                      <div className="rounded-xl border border-[#E31E24]/20 bg-[#FAFAFA] p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-bold text-[#1A1A1A]">MSG91 API Authentication & Credentials</span>
                              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                                Selected Engine
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              {g("email.msg91_enabled") !== "false"
                                ? "● MSG91 is Enabled and will dispatch outgoing emails."
                                : "✕ MSG91 is Disabled. Turn on the switch to start sending emails via MSG91."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-xs shrink-0">
                            <span className="text-xs font-semibold text-[#1A1A1A]">Enable MSG91:</span>
                            <Toggle
                              value={g("email.msg91_enabled") !== "false"}
                              onChange={(v) => tog("email.msg91_enabled", v)}
                            />
                          </div>
                        </div>

                        <FieldRow label="MSG91 AuthKey" hint="Secret AuthKey from your MSG91 Dashboard (Top-right Profile > API Keys / AuthKey)">
                          <SecretInput value={g("email.msg91_auth_key")} onChange={(v) => set("email.msg91_auth_key", v)} placeholder="Enter your MSG91 AuthKey" />
                        </FieldRow>
                        <FieldRow label="Verified Sending Domain" hint="Domain verified in your MSG91 Email Channel (e.g. modortho.com or mail.modortho.com)">
                          <AdminInput value={g("email.msg91_domain")} onChange={(e) => set("email.msg91_domain", e.target.value)} placeholder="e.g. modortho.com" />
                        </FieldRow>
                        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 text-[12px] text-blue-800">
                          <strong>Note:</strong> Make sure your sender email in Section 3 (e.g. <code>orders@modortho.com</code> or <code>auth@modortho.com</code>) belongs to your verified domain in your MSG91 control panel.
                        </div>
                      </div>
                    )}

                    {g("email.provider") === "nodemailer" && (
                      <div className="rounded-xl border border-blue-200 bg-[#FAFAFA] p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-bold text-[#1A1A1A]">SMTP Server Credentials</span>
                              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                                Selected Engine
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              {b("email.smtp_enabled")
                                ? "● SMTP Nodemailer is Enabled and will dispatch outgoing emails."
                                : "✕ SMTP is Disabled. Turn on the switch to start sending emails via SMTP."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-xs shrink-0">
                            <span className="text-xs font-semibold text-[#1A1A1A]">Enable SMTP:</span>
                            <Toggle
                              value={b("email.smtp_enabled")}
                              onChange={(v) => tog("email.smtp_enabled", v)}
                            />
                          </div>
                        </div>

                        <FieldRow label="SMTP Host">
                          <AdminInput value={g("email.smtp_host")} onChange={(e) => set("email.smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
                        </FieldRow>
                        <FieldRow label="SMTP Port">
                          <AdminInput value={g("email.smtp_port")} onChange={(e) => set("email.smtp_port", e.target.value)} placeholder="587" />
                        </FieldRow>
                        <FieldRow label="SMTP Username">
                          <AdminInput value={g("email.smtp_user")} onChange={(e) => set("email.smtp_user", e.target.value)} placeholder="user@example.com" />
                        </FieldRow>
                        <FieldRow label="SMTP Password">
                          <SecretInput value={g("email.smtp_password")} onChange={(v) => set("email.smtp_password", v)} />
                        </FieldRow>
                        <FieldRow label="Use SSL / TLS (Port 465)" hint="Enable for SSL port 465 (leave off for STARTTLS port 587)">
                          <div className="flex items-center gap-3">
                            <Toggle value={b("email.smtp_secure")} onChange={(v) => tog("email.smtp_secure", v)} />
                            <span className="text-[13px] text-[#6B6B6B]">{b("email.smtp_secure") ? "SSL Enabled (Port 465)" : "Standard (Port 587 / 25)"}</span>
                          </div>
                        </FieldRow>
                      </div>
                    )}

                    {g("email.provider") === "resend" && (
                      <div className="rounded-xl border border-purple-200 bg-[#FAFAFA] p-4 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-gray-200 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[13.5px] font-bold text-[#1A1A1A]">Resend API Authentication</span>
                              <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md">
                                Selected Engine
                              </span>
                            </div>
                            <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                              {b("email.resend_enabled")
                                ? "● Resend API is Enabled and will dispatch outgoing emails."
                                : "✕ Resend is Disabled. Turn on the switch to start sending emails via Resend."}
                            </p>
                          </div>
                          <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-xs shrink-0">
                            <span className="text-xs font-semibold text-[#1A1A1A]">Enable Resend:</span>
                            <Toggle
                              value={b("email.resend_enabled")}
                              onChange={(v) => tog("email.resend_enabled", v)}
                            />
                          </div>
                        </div>

                        <FieldRow label="Resend API Key">
                          <SecretInput value={g("email.resend_api_key")} onChange={(v) => set("email.resend_api_key", v)} placeholder="re_123456789..." />
                        </FieldRow>
                      </div>
                    )}

                    {/* Test Email Connection Diagnostic Tool */}
                    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <div className="text-[13px] font-bold text-[#1A1A1A] flex items-center gap-2">
                            <span>Test Email Connection (Live Diagnostics)</span>
                          </div>
                          <p className="text-[11.5px] text-[#6B7280] mt-0.5">
                            Send a real test email using your active provider (<strong>{(g("email.provider") || "msg91").toUpperCase()}</strong>) to verify your credentials.
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="email"
                            value={testEmailAddress}
                            onChange={(e) => setTestEmailAddress(e.target.value)}
                            placeholder="Enter recipient email..."
                            className="rounded-lg border border-[#E6E6E6] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#E31E24] w-52"
                          />
                          <LoadingButton
                            type="button"
                            onClick={() => handleSendTestEmail()}
                            loading={testingEmail}
                            className="rounded-lg bg-[#1A1A1A] px-3 py-1.5 text-xs font-semibold text-white hover:bg-black transition-colors shrink-0"
                          >
                            Send Test Email
                          </LoadingButton>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Section 2: Country-Specific Email Enable / Disable */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                    <div>
                      <h3 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
                        <span>Country-Specific Email Delivery</span>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">Multi-Country</span>
                      </h3>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">
                        Enable or disable outgoing transactional emails on a per-country basis (e.g. India, United States, United Kingdom, UAE).
                      </p>
                    </div>

                    {/* Master Switch for all countries (ON by default) */}
                    <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2 shrink-0">
                      <div className="text-right">
                        <div className="text-xs font-bold text-[#1A1A1A]">Master Country Routing:</div>
                        <div className="text-[11px] text-[#6B7280]">
                          {g("email.country_routing_enabled") !== "false" ? "Active globally (Default)" : "Disabled globally"}
                        </div>
                      </div>
                      <Toggle
                        value={g("email.country_routing_enabled") !== "false"}
                        onChange={(v) => tog("email.country_routing_enabled", v)}
                      />
                    </div>
                  </div>

                  {g("email.country_routing_enabled") === "false" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-[12.5px] text-amber-800 flex items-center gap-2.5">
                      <AlertCircle size={16} className="shrink-0 text-amber-600" />
                      <span>
                        <strong>Master Country Routing is currently OFF.</strong> Country-level filtering is bypassed and emails are dispatched globally via the Event Senders below.
                      </span>
                    </div>
                  )}

                  {/* Country Selector for scalable 20+ countries */}
                  {countries.length > 0 ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[12.5px] font-semibold text-[#1A1A1A] mb-1.5">
                          Select Destination Country ({countries.length} active destinations):
                        </label>
                        <AdminSelect
                          value={selectedCountryCode || countries[0]?.code}
                          onChange={(e) => setSelectedCountryCode(e.target.value)}
                          options={countries.map((c: any) => {
                            const code = c.code.toUpperCase();
                            const isCountryOn = g(`email.country.${code}.enabled`) !== "false";
                            return {
                              value: c.code,
                              label: `${c.name} (${code}) — ${isCountryOn ? "✓ Emails Enabled" : "✕ Disabled"}`,
                            };
                          })}
                        />
                      </div>

                      {/* Selected Country Toggle Card */}
                      {(() => {
                        const activeCountry = countries.find((c: any) => c.code === (selectedCountryCode || countries[0]?.code)) || countries[0];
                        if (!activeCountry) return null;
                        const code = activeCountry.code.toUpperCase();
                        const isCountryOn = g(`email.country.${code}.enabled`) !== "false";
                        const isMasterActive = g("email.country_routing_enabled") !== "false";

                        return (
                          <div className={cn(
                            "rounded-xl border p-4.5 transition-colors",
                            isCountryOn && isMasterActive
                              ? "border-emerald-200 bg-emerald-50/25"
                              : "border-[#E6E6E6] bg-[#FAFAFA]"
                          )}>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2.5">
                                  <h4 className="text-[14.5px] font-bold text-[#1A1A1A]">
                                    Email Delivery for {activeCountry.name} ({code})
                                  </h4>
                                  <span className={cn(
                                    "text-[11px] font-semibold px-2.5 py-0.5 rounded-full",
                                    isCountryOn && isMasterActive
                                      ? "bg-emerald-100 text-emerald-800"
                                      : !isMasterActive
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-red-100 text-red-700"
                                  )}>
                                    {isCountryOn && isMasterActive
                                      ? "● Active (Emails will be sent)"
                                      : !isMasterActive
                                      ? "Master Switch Off"
                                      : "✕ Disabled (Emails paused)"}
                                  </span>
                                </div>
                                <p className="text-[12px] text-[#6B7280] mt-1 leading-relaxed">
                                  {isCountryOn
                                    ? `Customers and dental clinics in ${activeCountry.name} will receive automated emails (Order confirmations, Password resets, RFQ quotes).`
                                    : `Automated emails to recipients in ${activeCountry.name} are currently paused.`}
                                </p>
                              </div>

                              <div className="flex items-center gap-3 shrink-0 bg-white border border-gray-200 rounded-lg px-3.5 py-2 shadow-xs">
                                <span className="text-xs font-semibold text-[#1A1A1A]">Enable for {code}:</span>
                                <Toggle
                                  value={isCountryOn}
                                  onChange={(v) => tog(`email.country.${code}.enabled`, v)}
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="text-xs text-[#6B7280]">Loading active countries...</div>
                  )}
                </div>

                {/* Section 3: Event / Purpose-Specific Email Senders */}
                <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-5">
                  <div className="border-b border-[#E5E7EB] pb-3">
                    <h3 className="text-[15px] font-bold text-[#1A1A1A]">Event & Purpose-Specific Email Senders</h3>
                    <p className="text-[12px] text-[#6B7280]">
                      Specify distinct sender names and email addresses for each specific event type (e.g. security/passwords from auth@, invoices from orders@).
                    </p>
                  </div>

                  {/* Global Fallback Sender */}
                  <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-[#1A1A1A] flex items-center gap-2">
                      <span>🌐 Global Default Sender (Fallback)</span>
                    </div>
                    <FieldRow label="Default From Name" hint="Used if no specific event or country sender is configured">
                      <AdminInput value={g("email.from_name")} onChange={(e) => set("email.from_name", e.target.value)} placeholder="Modern Orthodontics" />
                    </FieldRow>
                    <FieldRow label="Default From Email" hint="Default outgoing email address">
                      <AdminInput type="email" value={g("email.from_email")} onChange={(e) => set("email.from_email", e.target.value)} placeholder="orders@modortho.com" />
                    </FieldRow>
                    <FieldRow label="Admin Notification Email" hint="Receives incoming RFQ quote submissions & contact form inquiries">
                      <AdminInput type="email" value={g("email.notify_email")} onChange={(e) => set("email.notify_email", e.target.value)} placeholder="team@modortho.com" />
                    </FieldRow>
                  </div>

                  {/* 1. Auth & Password Reset */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-amber-900 flex items-center gap-2">
                      <span>🔐 Forgot Password & Customer Account Authentication</span>
                    </div>
                    <FieldRow label="Auth From Name" hint="e.g. Modern Orthodontics Security">
                      <AdminInput value={g("email.events.auth.from_name")} onChange={(e) => set("email.events.auth.from_name", e.target.value)} placeholder="Modern Orthodontics Security" />
                    </FieldRow>
                    <FieldRow label="Auth From Email" hint="Sender address for forgot password, reset links, and approval emails">
                      <AdminInput type="email" value={g("email.events.auth.from_email")} onChange={(e) => set("email.events.auth.from_email", e.target.value)} placeholder="auth@modortho.com" />
                    </FieldRow>
                  </div>

                  {/* 2. Orders & Invoices */}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-emerald-900 flex items-center gap-2">
                      <span>📦 Orders, Invoices & Order Status Updates</span>
                    </div>
                    <FieldRow label="Orders From Name" hint="e.g. Modern Orthodontics Orders">
                      <AdminInput value={g("email.events.orders.from_name")} onChange={(e) => set("email.events.orders.from_name", e.target.value)} placeholder="Modern Orthodontics Orders" />
                    </FieldRow>
                    <FieldRow label="Orders From Email" hint="Sender address for order confirmations, shipping tracking, and invoices">
                      <AdminInput type="email" value={g("email.events.orders.from_email")} onChange={(e) => set("email.events.orders.from_email", e.target.value)} placeholder="orders@modortho.com" />
                    </FieldRow>
                  </div>

                  {/* 3. Quotes & RFQ */}
                  <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-blue-900 flex items-center gap-2">
                      <span>💬 Quotes & RFQ Inquiry Proposals</span>
                    </div>
                    <FieldRow label="Quotes From Name" hint="e.g. Modern Orthodontics Quotes">
                      <AdminInput value={g("email.events.quotes.from_name")} onChange={(e) => set("email.events.quotes.from_name", e.target.value)} placeholder="Modern Orthodontics Quotes" />
                    </FieldRow>
                    <FieldRow label="Quotes From Email" hint="Sender address for quote receipts, approved quotes, and price proposals">
                      <AdminInput type="email" value={g("email.events.quotes.from_email")} onChange={(e) => set("email.events.quotes.from_email", e.target.value)} placeholder="quotes@modortho.com" />
                    </FieldRow>
                  </div>

                  {/* 4. Support & Contact Us */}
                  <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-indigo-900 flex items-center gap-2">
                      <span>🎧 Customer Support & Contact Us Inquiries</span>
                    </div>
                    <FieldRow label="Support From Name" hint="e.g. Modern Orthodontics Support">
                      <AdminInput value={g("email.events.support.from_name")} onChange={(e) => set("email.events.support.from_name", e.target.value)} placeholder="Modern Orthodontics Support" />
                    </FieldRow>
                    <FieldRow label="Support From Email" hint="Sender address for contact form auto-replies and support communications">
                      <AdminInput type="email" value={g("email.events.support.from_email")} onChange={(e) => set("email.events.support.from_email", e.target.value)} placeholder="support@modortho.com" />
                    </FieldRow>
                  </div>

                  {/* 5. Newsletter & Announcements */}
                  <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3">
                    <div className="text-[13px] font-bold text-purple-900 flex items-center gap-2">
                      <span>📰 Newsletter & Product Announcements</span>
                    </div>
                    <FieldRow label="Newsletter From Name" hint="e.g. Modern Orthodontics Updates">
                      <AdminInput value={g("email.events.newsletter.from_name")} onChange={(e) => set("email.events.newsletter.from_name", e.target.value)} placeholder="Modern Orthodontics Updates" />
                    </FieldRow>
                    <FieldRow label="Newsletter From Email" hint="Sender address for welcome letters and newsletter campaigns">
                      <AdminInput type="email" value={g("email.events.newsletter.from_email")} onChange={(e) => set("email.events.newsletter.from_email", e.target.value)} placeholder="newsletter@modortho.com" />
                    </FieldRow>
                  </div>
                </div>
              </div>
            )}

            {/* ── Tax & Compliance ── */}
            {activeTab === "tax" && (
              <div>
                <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-[12.5px] leading-relaxed text-blue-700">
                  Manage seller legal identity, corporate GSTIN / IEC registrations, and fulfillment warehouse state for dynamic tax invoices.
                </div>

                <FieldRow label="Seller Legal Name">
                  <AdminInput value={g("tax.seller_name")} onChange={(e) => set("tax.seller_name", e.target.value)} placeholder="Modern Orthodontics Pvt Ltd" />
                </FieldRow>
                <FieldRow label="Seller GSTIN" hint="15-character GSTIN format for India domestic operations">
                  <AdminInput value={g("tax.seller_gstin")} onChange={(e) => set("tax.seller_gstin", e.target.value)} placeholder="03AAAAA1111A1Z1" />
                </FieldRow>
                <FieldRow label="Seller Import Export Code (IEC)">
                  <AdminInput value={g("tax.seller_iec")} onChange={(e) => set("tax.seller_iec", e.target.value)} placeholder="0300000000" />
                </FieldRow>
                <FieldRow label="Fulfillment Origin State" hint="Dynamic state code used for CGST/SGST vs IGST split calculations">
                  <AdminInput value={g("tax.ship_from_state")} onChange={(e) => set("tax.ship_from_state", e.target.value)} placeholder="Punjab" />
                </FieldRow>
              </div>
            )}

          </fieldset>
        </div>
      </div>

      <MediaSelectorModal
        isOpen={mediaTarget !== null}
        onClose={() => setMediaTarget(null)}
        onSelect={(media) => {
          if (!mediaTarget) return;
          if (mediaTarget.type === "setting") {
            set(mediaTarget.key, media.url);
            showToast("Image selected. Click 'Save Settings' to apply changes.", "success");
          } else if (mediaTarget.type === "slide") {
            updateLoginSlide(mediaTarget.index, "image", media.url);
            showToast("Slide image selected.", "success");
          }
        }}
        title="Select Media Image"
        acceptTypes={["IMAGE"]}
      />
    </AdminLayout>
  );
}
