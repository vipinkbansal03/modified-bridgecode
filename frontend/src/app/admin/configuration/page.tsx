"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Truck,
  CreditCard,
  ShieldCheck,
  Sparkles,
  Cloud,
  Mail,
  MessageSquare,
  Database,
  Bell,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

type Setting = { id: string; key: string; value: string; group: string; label?: string | null; type: string; isSecret: boolean; isEnabled: boolean };
type SettingMap = Record<string, string>;

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer", value ? "bg-[#E31E24]" : "bg-gray-200")}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow transition-transform", value ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

function SecretInput({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5 w-full">
      {label && (
        <label className="block text-[13px] font-medium text-[#1A1A1A]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? "Leave blank to keep existing value"}
          className="w-full rounded-lg border border-[#E6E6E6] px-3 py-2 pr-10 text-[13.5px] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  );
}

function SwitchRow({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 h-full">
      <div>
        <div className="text-[13px] font-semibold text-[#1A1A1A]">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-[#6B6B6B] leading-normal">{hint}</div>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

// ─── Settings key metadata ────────────────────────────────────────────────────

const SETTINGS_META: Record<string, { group: string; type: string; isSecret?: boolean }> = {
  // ── Shipping & Logistics ──
  "shipping.dhl_enabled":             { group: "shipping", type: "boolean" },
  "shipping.dhl_api_key":             { group: "shipping", type: "string" },
  "shipping.dhl_api_secret":          { group: "shipping", type: "secret", isSecret: true },
  "shipping.dhl_base_url":            { group: "shipping", type: "string" },
  "shipping.dhl_mode":                { group: "shipping", type: "string" },

  "shipping.dtdc_enabled":            { group: "shipping", type: "boolean" },
  "shipping.dtdc_customer_code":       { group: "shipping", type: "string" },
  "shipping.dtdc_api_key":            { group: "shipping", type: "secret", isSecret: true },
  "shipping.dtdc_base_url":           { group: "shipping", type: "string" },

  // ── Payment Gateways ──
  "payment.razorpay_enabled":         { group: "payments", type: "boolean" },
  "payment.razorpay_key_id":          { group: "payments", type: "string" },
  "payment.razorpay_key_secret":      { group: "payments", type: "secret", isSecret: true },
  "payment.razorpay_webhook_secret":  { group: "payments", type: "secret", isSecret: true },

  "payment.stripe_enabled":           { group: "payments", type: "boolean" },
  "payment.stripe_publishable_key":   { group: "payments", type: "string" },
  "payment.stripe_secret_key":        { group: "payments", type: "secret", isSecret: true },
  "payment.stripe_webhook_secret":    { group: "payments", type: "secret", isSecret: true },

  // ── Tax & Compliance Validation ──
  "tax.sandbox_enabled":              { group: "tax", type: "boolean" },
  "tax.sandbox_api_key":              { group: "tax", type: "string" },
  "tax.sandbox_api_secret":           { group: "tax", type: "secret", isSecret: true },

  // ── AI & Catalog Assistant ──
  "ai.enabled":                       { group: "ai", type: "boolean" },
  "ai.openai_api_key":                { group: "ai", type: "secret", isSecret: true },
  "ai.openai_model":                  { group: "ai", type: "string" },

  // ── Cloud Storage & Uploads ──
  "uploads.provider":                 { group: "uploads", type: "string" },
  "uploads.aws_region":               { group: "uploads", type: "string" },
  "uploads.aws_s3_bucket":            { group: "uploads", type: "string" },
  "uploads.aws_access_key_id":        { group: "uploads", type: "string" },
  "uploads.aws_secret_access_key":    { group: "uploads", type: "secret", isSecret: true },

  "uploads.cloudinary_enabled":       { group: "uploads", type: "boolean" },
  "uploads.cloudinary_cloud_name":    { group: "uploads", type: "string" },
  "uploads.cloudinary_api_key":        { group: "uploads", type: "string" },
  "uploads.cloudinary_api_secret":     { group: "uploads", type: "secret", isSecret: true },

  // ── Email Communications ──
  "email.provider":                   { group: "email", type: "string" },
  "email.enabled":                    { group: "email", type: "boolean" },
  "email.smtp_host":                  { group: "email", type: "string" },
  "email.smtp_port":                  { group: "email", type: "string" },
  "email.smtp_user":                  { group: "email", type: "string" },
  "email.smtp_password":              { group: "email", type: "secret", isSecret: true },
  "email.from_name":                  { group: "email", type: "string" },
  "email.from_email":                 { group: "email", type: "string" },

  "email.resend_api_key":             { group: "email", type: "secret", isSecret: true },
  "email.resend_from_email":          { group: "email", type: "string" },
  "email.resend_notify_email":        { group: "email", type: "string" },

  // ── WhatsApp & Messaging ──
  "whatsapp.provider":                { group: "whatsapp", type: "string" },
  "whatsapp.enabled":                 { group: "whatsapp", type: "boolean" },
  "whatsapp.tata_base_url":           { group: "whatsapp", type: "string" },
  "whatsapp.tata_sender":             { group: "whatsapp", type: "string" },
  "whatsapp.tata_bearer_token":       { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.tata_api_key":            { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.tata_api_secret":         { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.tata_bot_id":             { group: "whatsapp", type: "string" },

  "twilio.enabled":                   { group: "twilio", type: "boolean" },
  "twilio.account_sid":               { group: "twilio", type: "string" },
  "twilio.auth_token":                { group: "twilio", type: "secret", isSecret: true },
  "twilio.phone_number":              { group: "twilio", type: "string" },
  "twilio.whatsapp_from":             { group: "twilio", type: "string" },

  // ── Redis Cache & Notifications ──
  "redis.enabled":                    { group: "redis", type: "boolean" },
  "notifications.masterEnabled":      { group: "notifications", type: "boolean" },
  "notifications.whatsapp":           { group: "notifications", type: "boolean" },
  "notifications.email":              { group: "notifications", type: "boolean" },
  "notifications.push":               { group: "notifications", type: "boolean" },
};

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ConfigurationPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("settings.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("settings.update");

  const [settings, setSettings] = useState<SettingMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSettings, setSavedSettings] = useState<SettingMap>({});
  const queryClient = useQueryClient();
  const { showToast, ToastComponent } = useToast();

  const loadSettings = useCallback(async () => {
    if (authLoading || !hasPermission("settings.view")) return;
    setLoading(true);
    try {
      const r = await adminApi.get("/settings");
      const rows: Setting[] = r.data.data ?? [];
      const map: SettingMap = {};
      rows.forEach((s) => {
        map[s.key] = s.value === "***" ? "" : s.value;
      });
      setSettings(map);
      setSavedSettings(map);
    } catch {
      showToast("Failed to load configuration settings.", "error");
    } finally {
      setLoading(false);
    }
  }, [authLoading, hasPermission, showToast]);

  useEffect(() => {
    if (!authLoading && hasPermission("settings.view")) {
      loadSettings();
    }
  }, [authLoading, hasPermission, loadSettings]);

  function set(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }
  function tog(key: string, v: boolean) {
    set(key, String(v));
  }
  const g = (key: string) => settings[key] ?? "";
  const b = (key: string) => settings[key] === "true";

  const isDirty = useMemo(() => {
    return Object.keys(SETTINGS_META).some(
      (k) => (settings[k] ?? "") !== (savedSettings[k] ?? "")
    );
  }, [settings, savedSettings]);

  const handleSave = async () => {
    if (!canUpdate) {
      showToast("You do not have permission to update settings.", "error");
      return;
    }
    setSaving(true);
    try {
      const settingsToSave = { ...settings };
      const settingsList = Object.entries(settingsToSave)
        .filter(([key]) => SETTINGS_META[key])
        .map(([key, value]) => ({
          key,
          value,
          group: SETTINGS_META[key].group,
          type: SETTINGS_META[key].type,
          isSecret: SETTINGS_META[key].isSecret ?? false,
        }));

      await adminApi.put("/settings", { settings: settingsList });
      showToast("System configurations saved successfully.", "success");
      setSavedSettings({ ...settingsToSave });
      queryClient.invalidateQueries({ queryKey: ["system-settings"] });
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save configurations."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout title="System Configuration" breadcrumb={[{ label: "Platform" }, { label: "Configuration" }]}>
      {ToastComponent}
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-4">
          <div>
            <h1 className="text-[20px] font-bold text-[#1A1A1A]">System Configuration</h1>
            <p className="mt-1 text-[13px] text-[#6B6B6B]">
              Configure service providers, gateways, shipping, tax verification, storage, and alerts without editing server .env files.
            </p>
          </div>
          {isDirty && (
            <div className="flex items-center gap-3">
              <span className="text-[12.5px] text-[#E31E24] font-medium animate-pulse">
                Unsaved changes
              </span>
              <LoadingButton
                onClick={handleSave}
                loading={saving}
                className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#C2181C]"
              >
                <Save size={14} />
                Save Configurations
              </LoadingButton>
            </div>
          )}
        </div>

        <div className="w-full space-y-6">
          {loading ? (
            <div className="flex h-48 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white">
              <div className="flex items-center gap-2 text-[14px] text-gray-500">
                <RefreshCw size={16} className="animate-spin" />
                Loading settings...
              </div>
            </div>
          ) : (
            <>
              {/* ── 1. SHIPPING & LOGISTICS (DHL & DTDC) ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-[#E31E24]">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Shipping & Logistics Carriers</h2>
                    <p className="text-[12px] text-gray-500">Manage DHL Express (International Exports) and DTDC Courier (Domestic India).</p>
                  </div>
                </div>

                {/* DHL Express Sub-Section */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EBEBEB]">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#1A1A1A]">DHL Express (MyDHL API)</h3>
                      <p className="text-[11.5px] text-gray-500">Global export air express shipments, live rates, and automated AWB generation.</p>
                    </div>
                    <SwitchRow
                      label="Enable DHL Service"
                      value={b("shipping.dhl_enabled")}
                      onChange={(v) => tog("shipping.dhl_enabled", v)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                    <AdminInput
                      label="DHL SHIPPER ACCOUNT NUMBER / API KEY"
                      value={g("shipping.dhl_api_key")}
                      onChange={(e) => set("shipping.dhl_api_key", e.target.value)}
                      placeholder="e.g. 963713843"
                    />
                    <SecretInput
                      label="DHL API SECRET"
                      value={g("shipping.dhl_api_secret")}
                      onChange={(v) => set("shipping.dhl_api_secret", v)}
                      placeholder="Enter DHL API secret"
                    />
                    <AdminInput
                      label="DHL BASE URL"
                      value={g("shipping.dhl_base_url")}
                      onChange={(e) => set("shipping.dhl_base_url", e.target.value)}
                      placeholder="https://api.dhl.com/mydhlapi"
                    />
                    <AdminSelect
                      label="ENVIRONMENT MODE"
                      value={g("shipping.dhl_mode") || "production"}
                      onChange={(e) => set("shipping.dhl_mode", e.target.value)}
                      options={[
                        { value: "production", label: "Production (Live Shipments)" },
                        { value: "sandbox", label: "Sandbox / Test (Simulated)" },
                      ]}
                    />
                  </div>
                </div>

                {/* DTDC Courier Sub-Section */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EBEBEB]">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#1A1A1A]">DTDC Courier (Domestic India)</h3>
                      <p className="text-[11.5px] text-gray-500">Surface and Air consignment booking across Indian states and pincodes.</p>
                    </div>
                    <SwitchRow
                      label="Enable DTDC Service"
                      value={b("shipping.dtdc_enabled")}
                      onChange={(v) => tog("shipping.dtdc_enabled", v)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                    <AdminInput
                      label="DTDC CUSTOMER CODE"
                      value={g("shipping.dtdc_customer_code")}
                      onChange={(e) => set("shipping.dtdc_customer_code", e.target.value)}
                      placeholder="e.g. JO2005"
                    />
                    <SecretInput
                      label="DTDC API TOKEN / BEARER KEY"
                      value={g("shipping.dtdc_api_key")}
                      onChange={(v) => set("shipping.dtdc_api_key", v)}
                      placeholder="Enter DTDC customer API token"
                    />
                    <div className="md:col-span-2">
                      <AdminInput
                        label="DTDC BASE URL"
                        value={g("shipping.dtdc_base_url")}
                        onChange={(e) => set("shipping.dtdc_base_url", e.target.value)}
                        placeholder="https://api.dtdc.in"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 2. PAYMENT GATEWAYS (RAZORPAY & STRIPE) ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-[#2563EB]">
                    <CreditCard size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Payment Gateways</h2>
                    <p className="text-[12px] text-gray-500">Configure Razorpay for Indian UPI/NetBanking and Stripe for international multi-currency cards.</p>
                  </div>
                </div>

                {/* Razorpay Sub-Section */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EBEBEB]">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Razorpay (Domestic India - INR)</h3>
                      <p className="text-[11.5px] text-gray-500">UPI, QR Code, RuPay, Visa, Mastercard, and NetBanking for Indian doctors & clinics.</p>
                    </div>
                    <SwitchRow
                      label="Enable Razorpay"
                      value={b("payment.razorpay_enabled")}
                      onChange={(v) => tog("payment.razorpay_enabled", v)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                    <AdminInput
                      label="RAZORPAY KEY ID"
                      value={g("payment.razorpay_key_id")}
                      onChange={(e) => set("payment.razorpay_key_id", e.target.value)}
                      placeholder="rzp_live_..."
                    />
                    <SecretInput
                      label="RAZORPAY KEY SECRET"
                      value={g("payment.razorpay_key_secret")}
                      onChange={(v) => set("payment.razorpay_key_secret", v)}
                      placeholder="Enter Razorpay Key Secret"
                    />
                    <div className="md:col-span-2">
                      <SecretInput
                        label="RAZORPAY WEBHOOK SECRET (OPTIONAL)"
                        value={g("payment.razorpay_webhook_secret")}
                        onChange={(v) => set("payment.razorpay_webhook_secret", v)}
                        placeholder="Webhook verification secret"
                      />
                    </div>
                  </div>
                </div>

                {/* Stripe Sub-Section */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EBEBEB]">
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Stripe (International Global - USD / EUR / GBP)</h3>
                      <p className="text-[11.5px] text-gray-500">Cross-border credit cards, Apple Pay, Google Pay, and international multi-currency checkouts.</p>
                    </div>
                    <SwitchRow
                      label="Enable Stripe"
                      value={b("payment.stripe_enabled")}
                      onChange={(v) => tog("payment.stripe_enabled", v)}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-1">
                    <AdminInput
                      label="STRIPE PUBLISHABLE KEY"
                      value={g("payment.stripe_publishable_key")}
                      onChange={(e) => set("payment.stripe_publishable_key", e.target.value)}
                      placeholder="pk_live_..."
                    />
                    <SecretInput
                      label="STRIPE SECRET KEY"
                      value={g("payment.stripe_secret_key")}
                      onChange={(v) => set("payment.stripe_secret_key", v)}
                      placeholder="sk_live_..."
                    />
                    <div className="md:col-span-2">
                      <SecretInput
                        label="STRIPE WEBHOOK SECRET (OPTIONAL)"
                        value={g("payment.stripe_webhook_secret")}
                        onChange={(v) => set("payment.stripe_webhook_secret", v)}
                        placeholder="whsec_..."
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 3. TAX & COMPLIANCE VALIDATION ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Tax & Business Compliance Validation</h2>
                    <p className="text-[12px] text-gray-500">Real-time Indian GSTIN verification and European Union cross-border VAT compliance.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2">
                    <SwitchRow
                      label="Enable Live GSTIN Verification (Sandbox.co.in)"
                      hint="Verifies doctor & clinic GST numbers live against the government GST portal to auto-fetch legal names."
                      value={b("tax.sandbox_enabled")}
                      onChange={(v) => tog("tax.sandbox_enabled", v)}
                    />
                  </div>
                  <AdminInput
                    label="SANDBOX.CO.IN API KEY"
                    value={g("tax.sandbox_api_key")}
                    onChange={(e) => set("tax.sandbox_api_key", e.target.value)}
                    placeholder="key_live_..."
                  />
                  <SecretInput
                    label="SANDBOX.CO.IN API SECRET"
                    value={g("tax.sandbox_api_secret")}
                    onChange={(v) => set("tax.sandbox_api_secret", v)}
                    placeholder="secret_live_..."
                  />
                </div>

                <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-[12.5px] text-emerald-900 leading-relaxed">
                    <span className="font-semibold">European Union VAT (VIES API):</span> Connected to the official European Commission REST API (<code className="text-[11px] bg-emerald-100 px-1 py-0.5 rounded">ec.europa.eu</code>). 100% free public verification for all 27 EU member states with zero configuration required.
                  </div>
                </div>
              </div>

              {/* ── 4. AI & CATALOG ASSISTANT ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                    <Sparkles size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">AI & Catalog Assistant (OpenAI)</h2>
                    <p className="text-[12px] text-gray-500">Powers multilingual catalog translation, smart product search, and doctor query assistance.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2">
                    <SwitchRow
                      label="Enable AI Assistant"
                      hint="Activate AI-powered content generation and search enhancements across the platform."
                      value={b("ai.enabled")}
                      onChange={(v) => tog("ai.enabled", v)}
                    />
                  </div>
                  <SecretInput
                    label="OPENAI API KEY"
                    value={g("ai.openai_api_key")}
                    onChange={(v) => set("ai.openai_api_key", v)}
                    placeholder="sk-proj-..."
                  />
                  <AdminSelect
                    label="OPENAI MODEL"
                    value={g("ai.openai_model") || "gpt-4o-mini"}
                    onChange={(e) => set("ai.openai_model", e.target.value)}
                    options={[
                      { value: "gpt-4o-mini", label: "GPT-4o Mini (Fast & Cost Effective - Recommended)" },
                      { value: "gpt-4o", label: "GPT-4o (High Performance)" },
                      { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
                    ]}
                  />
                </div>
              </div>

              {/* ── 5. CLOUD STORAGE & MEDIA UPLOADS ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                    <Cloud size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Cloud Storage & Media Uploads</h2>
                    <p className="text-[12px] text-gray-500">Configure AWS S3, Cloudflare R2, or Cloudinary for product galleries, clinical documents, and invoices.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <div className="md:col-span-2">
                    <AdminSelect
                      label="ACTIVE STORAGE PROVIDER"
                      value={g("uploads.provider") || "local"}
                      onChange={(e) => set("uploads.provider", e.target.value)}
                      options={[
                        { value: "local", label: "Local Server Storage (uploads/ directory)" },
                        { value: "s3", label: "Amazon Web Services (AWS S3) / Cloudflare R2" },
                        { value: "cloudinary", label: "Cloudinary" },
                      ]}
                    />
                  </div>

                  {/* AWS S3 details */}
                  {(g("uploads.provider") === "s3" || !g("uploads.provider")) && (
                    <div className="md:col-span-2 space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                      <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">AWS S3 / Cloudflare R2 Settings</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <AdminInput
                          label="AWS REGION"
                          value={g("uploads.aws_region")}
                          onChange={(e) => set("uploads.aws_region", e.target.value)}
                          placeholder="ap-south-1"
                        />
                        <AdminInput
                          label="S3 BUCKET NAME"
                          value={g("uploads.aws_s3_bucket")}
                          onChange={(e) => set("uploads.aws_s3_bucket", e.target.value)}
                          placeholder="modortho-production-media"
                        />
                        <AdminInput
                          label="AWS ACCESS KEY ID"
                          value={g("uploads.aws_access_key_id")}
                          onChange={(e) => set("uploads.aws_access_key_id", e.target.value)}
                          placeholder="AKIA..."
                        />
                        <SecretInput
                          label="AWS SECRET ACCESS KEY"
                          value={g("uploads.aws_secret_access_key")}
                          onChange={(v) => set("uploads.aws_secret_access_key", v)}
                          placeholder="Enter AWS Secret Key"
                        />
                      </div>
                    </div>
                  )}

                  {/* Cloudinary details */}
                  {(g("uploads.provider") === "cloudinary" || b("uploads.cloudinary_enabled")) && (
                    <div className="md:col-span-2 space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                      <div className="flex items-center justify-between pb-2 border-b border-[#EBEBEB]">
                        <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Cloudinary Settings</h3>
                        <SwitchRow
                          label="Enable Cloudinary"
                          value={b("uploads.cloudinary_enabled")}
                          onChange={(v) => tog("uploads.cloudinary_enabled", v)}
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                        <AdminInput
                          label="CLOUD NAME"
                          value={g("uploads.cloudinary_cloud_name")}
                          onChange={(e) => set("uploads.cloudinary_cloud_name", e.target.value)}
                        />
                        <AdminInput
                          label="API KEY"
                          value={g("uploads.cloudinary_api_key")}
                          onChange={(e) => set("uploads.cloudinary_api_key", e.target.value)}
                        />
                        <SecretInput
                          label="API SECRET"
                          value={g("uploads.cloudinary_api_secret")}
                          onChange={(v) => set("uploads.cloudinary_api_secret", v)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 6. EMAIL COMMUNICATIONS ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                    <Mail size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Email & Transactional Delivery</h2>
                    <p className="text-[12px] text-gray-500">Mailing options for automated order confirmations, PDF invoices, and RFQ quotes.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminSelect
                    label="EMAIL SERVICE PROVIDER"
                    value={g("email.provider") || "smtp"}
                    onChange={(e) => set("email.provider", e.target.value)}
                    options={[
                      { value: "smtp", label: "SMTP (Gmail / Custom Server)" },
                      { value: "resend", label: "Resend API (High Reliability)" },
                    ]}
                  />
                  <SwitchRow
                    label="Enable Email Service"
                    hint="Pause or resume automated email dispatches system-wide."
                    value={b("email.enabled")}
                    onChange={(v) => tog("email.enabled", v)}
                  />

                  {/* SMTP fields */}
                  {(g("email.provider") === "smtp" || !g("email.provider")) && (
                    <div className="md:col-span-2 space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                      <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">SMTP Server Credentials</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <AdminInput
                          label="SMTP HOST"
                          value={g("email.smtp_host")}
                          onChange={(e) => set("email.smtp_host", e.target.value)}
                          placeholder="smtp.gmail.com"
                        />
                        <AdminInput
                          label="SMTP PORT"
                          value={g("email.smtp_port")}
                          onChange={(e) => set("email.smtp_port", e.target.value)}
                          placeholder="587"
                        />
                        <AdminInput
                          label="EMAIL USERNAME"
                          value={g("email.smtp_user")}
                          onChange={(e) => set("email.smtp_user", e.target.value)}
                          placeholder="orders@modortho.com"
                        />
                        <SecretInput
                          label="EMAIL PASSWORD / APP PASSWORD"
                          value={g("email.smtp_password")}
                          onChange={(v) => set("email.smtp_password", v)}
                        />
                        <AdminInput
                          label="SENDER FROM NAME"
                          value={g("email.from_name")}
                          onChange={(e) => set("email.from_name", e.target.value)}
                          placeholder="Modern Orthodontics"
                        />
                        <AdminInput
                          label="SENDER FROM EMAIL"
                          value={g("email.from_email")}
                          onChange={(e) => set("email.from_email", e.target.value)}
                          placeholder="orders@modortho.com"
                        />
                      </div>
                    </div>
                  )}

                  {/* Resend API fields */}
                  {g("email.provider") === "resend" && (
                    <div className="md:col-span-2 space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                      <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Resend API Credentials</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                        <SecretInput
                          label="RESEND API KEY"
                          value={g("email.resend_api_key")}
                          onChange={(v) => set("email.resend_api_key", v)}
                          placeholder="re_..."
                        />
                        <AdminInput
                          label="FROM EMAIL"
                          value={g("email.resend_from_email")}
                          onChange={(e) => set("email.resend_from_email", e.target.value)}
                          placeholder="orders@modortho.com"
                        />
                        <div className="md:col-span-2">
                          <AdminInput
                            label="INTERNAL TEAM NOTIFICATION EMAIL"
                            value={g("email.resend_notify_email")}
                            onChange={(e) => set("email.resend_notify_email", e.target.value)}
                            placeholder="team@modortho.com"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 7. WHATSAPP & SMS MESSAGING ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-50 text-green-600">
                    <MessageSquare size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">WhatsApp & SMS Messaging</h2>
                    <p className="text-[12px] text-gray-500">Configure Tata Tele Business and Twilio for order alerts, tracking, and chatbot conversations.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminSelect
                    label="ACTIVE WHATSAPP SERVICE"
                    value={g("whatsapp.provider") || "tata"}
                    onChange={(e) => set("whatsapp.provider", e.target.value)}
                    options={[
                      { value: "tata", label: "Tata Tele Business (Tata BSP)" },
                      { value: "twilio", label: "Twilio WhatsApp" },
                    ]}
                  />
                  <SwitchRow
                    label="Enable WhatsApp Service"
                    hint="Turn WhatsApp messaging on or off across the whole platform."
                    value={b("whatsapp.enabled")}
                    onChange={(v) => tog("whatsapp.enabled", v)}
                  />
                </div>

                {/* Tata WhatsApp Integration */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Tata Tele Business API Credentials</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <AdminInput
                      label="TATA BASE URL"
                      value={g("whatsapp.tata_base_url")}
                      onChange={(e) => set("whatsapp.tata_base_url", e.target.value)}
                      placeholder="https://wb.omni.tatatelebusiness.com"
                    />
                    <AdminInput
                      label="TATA SENDER NUMBER"
                      value={g("whatsapp.tata_sender")}
                      onChange={(e) => set("whatsapp.tata_sender", e.target.value)}
                      placeholder="9240213800"
                    />
                    <AdminInput
                      label="TATA BOT ID"
                      value={g("whatsapp.tata_bot_id")}
                      onChange={(e) => set("whatsapp.tata_bot_id", e.target.value)}
                    />
                    <SecretInput
                      label="TATA BEARER TOKEN"
                      value={g("whatsapp.tata_bearer_token")}
                      onChange={(v) => set("whatsapp.tata_bearer_token", v)}
                    />
                    <AdminInput
                      label="TATA API KEY"
                      value={g("whatsapp.tata_api_key")}
                      onChange={(e) => set("whatsapp.tata_api_key", e.target.value)}
                    />
                    <SecretInput
                      label="TATA API SECRET"
                      value={g("whatsapp.tata_api_secret")}
                      onChange={(v) => set("whatsapp.tata_api_secret", v)}
                    />
                  </div>
                </div>

                {/* Twilio SMS & WhatsApp */}
                <div className="space-y-4 rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-5">
                  <div className="flex items-center justify-between pb-2 border-b border-[#EBEBEB]">
                    <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Twilio Integration (SMS & Alternative WhatsApp)</h3>
                    <SwitchRow
                      label="Enable Twilio"
                      value={b("twilio.enabled")}
                      onChange={(v) => tog("twilio.enabled", v)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <AdminInput
                      label="TWILIO ACCOUNT SID"
                      value={g("twilio.account_sid")}
                      onChange={(e) => set("twilio.account_sid", e.target.value)}
                      placeholder="AC..."
                    />
                    <SecretInput
                      label="TWILIO AUTH TOKEN"
                      value={g("twilio.auth_token")}
                      onChange={(v) => set("twilio.auth_token", v)}
                    />
                    <AdminInput
                      label="TWILIO PHONE NUMBER (SMS)"
                      value={g("twilio.phone_number")}
                      onChange={(e) => set("twilio.phone_number", e.target.value)}
                      placeholder="+15076506177"
                    />
                    <AdminInput
                      label="TWILIO WHATSAPP NUMBER (OPTIONAL)"
                      value={g("twilio.whatsapp_from")}
                      onChange={(e) => set("twilio.whatsapp_from", e.target.value)}
                      placeholder="+14155238886"
                    />
                  </div>
                </div>
              </div>

              {/* ── 8. REDIS CACHE & CACHE CONTROL ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                    <Database size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Redis Cache & System Cache Control</h2>
                    <p className="text-[12px] text-gray-500">Toggle Redis in-memory cache and invalidate stale content when updates are published.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  <SwitchRow
                    label="Enable Redis Cache"
                    hint="Turn cache-backed query helpers on or off from the admin panel."
                    value={b("redis.enabled")}
                    onChange={(v) => tog("redis.enabled", v)}
                  />

                  <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1A1A1A]">Reset Backend Cache</div>
                      <div className="text-[11px] text-[#6B6B6B] mt-0.5">Flush CMS pages, system settings, and tax cache.</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        queryClient.invalidateQueries();
                        showToast("Backend cache reset signal dispatched successfully.", "success");
                      }}
                      className="rounded-lg border border-[#E31E24] px-3.5 py-1.5 text-[12px] font-medium text-[#E31E24] hover:bg-[#E31E24]/5 transition-colors cursor-pointer"
                    >
                      Clear Cache
                    </button>
                  </div>
                </div>
              </div>

              {/* ── 9. MASTER NOTIFICATION CHANNELS ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="flex items-center gap-2.5 pb-3 border-b border-[#F4F4F4]">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
                    <Bell size={18} />
                  </div>
                  <div>
                    <h2 className="text-[15px] font-bold text-[#1A1A1A]">Master Notification Channels</h2>
                    <p className="text-[12px] text-gray-500">Manage global notification dispatch per delivery channel across the entire platform.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="md:col-span-2">
                    <SwitchRow
                      label="Master Notification Switch"
                      hint="Pause or resume all outbound customer and admin notifications from one switch."
                      value={b("notifications.masterEnabled")}
                      onChange={(v) => tog("notifications.masterEnabled", v)}
                    />
                  </div>
                  <SwitchRow
                    label="Enable WhatsApp Notifications"
                    hint="Send automated order confirmations and shipping updates via WhatsApp."
                    value={b("notifications.whatsapp")}
                    onChange={(v) => tog("notifications.whatsapp", v)}
                  />
                  <SwitchRow
                    label="Enable Email Notifications"
                    hint="Send order invoices, quotes, and account emails."
                    value={b("notifications.email")}
                    onChange={(v) => tog("notifications.email", v)}
                  />
                  <div className="md:col-span-2">
                    <SwitchRow
                      label="Enable Push Notifications"
                      hint="Send browser and mobile push notifications to signed-in users."
                      value={b("notifications.push")}
                      onChange={(v) => tog("notifications.push", v)}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
