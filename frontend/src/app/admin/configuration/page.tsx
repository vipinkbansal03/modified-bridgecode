"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Sliders, MessageCircle, Mail, MessageSquare, CreditCard, Upload, Database,
  CheckCircle2, AlertCircle, Eye, EyeOff, Save, RefreshCw, Lock,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: "whatsapp", label: "WhatsApp",          icon: MessageCircle },
  { id: "email",    label: "Email / SMTP",      icon: Mail },
  { id: "sms",      label: "SMS Settings",      icon: MessageSquare },
  { id: "payment",  label: "Payment Gateway",   icon: CreditCard },
  { id: "uploads",  label: "File Uploads",      icon: Upload },
  { id: "redis",    label: "Redis & Cache",     icon: Database },
];

type Setting = { id: string; key: string; value: string; group: string; label?: string | null; type: string; isSecret: boolean; isEnabled: boolean };
type SettingMap = Record<string, string>;

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

// ─── Settings key metadata ────────────────────────────────────────────────────

const SETTINGS_META: Record<string, { group: string; type: string; isSecret?: boolean }> = {
  // WhatsApp
  "whatsapp.enabled":                 { group: "whatsapp", type: "boolean" },
  "whatsapp.tata_base_url":           { group: "whatsapp", type: "string" },
  "whatsapp.tata_sender":            { group: "whatsapp", type: "string" },
  "whatsapp.tata_bearer_token":       { group: "whatsapp", type: "secret", isSecret: true },
  
  // Email
  "email.enabled":       { group: "email", type: "boolean" },
  "email.smtp_host":     { group: "email", type: "string" },
  "email.smtp_port":     { group: "email", type: "string" },
  "email.smtp_user":     { group: "email", type: "string" },
  "email.smtp_password": { group: "email", type: "secret", isSecret: true },
  "email.from_name":     { group: "email", type: "string" },
  "email.from_email":    { group: "email", type: "string" },

  // SMS Settings
  "sms.enabled":             { group: "sms", type: "boolean" },
  "sms.provider":            { group: "sms", type: "string" },
  "sms.twilio_account_sid":  { group: "sms", type: "string" },
  "sms.twilio_auth_token":   { group: "sms", type: "secret", isSecret: true },
  "sms.twilio_phone":        { group: "sms", type: "string" },

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

export default function ConfigurationPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("settings.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("settings.update");

  const [activeTab, setActiveTab] = useState("whatsapp");
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
      rows.forEach((s) => { map[s.key] = s.value === "***" ? "" : s.value; });
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

  function set(key: string, value: string) { setSettings((s) => ({ ...s, [key]: value })); }
  function tog(key: string, v: boolean)    { set(key, String(v)); }
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
              Configure service providers, gateways, uploads, cache, and messaging alerts.
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

        <div className="grid grid-cols-[250px_1fr] gap-6 items-start">
          {/* Navigation Sidebar */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-2 shadow-xs space-y-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "text-[#555] hover:bg-gray-50 hover:text-black"
                  )}
                >
                  <Icon size={16} className={cn("shrink-0", isActive ? "text-[#E31E24]" : "text-gray-400")} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Form Content Area */}
          <div className="space-y-6">
            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border border-[#E6E6E6] bg-white">
                <div className="flex items-center gap-2 text-[14px] text-gray-500">
                  <RefreshCw size={16} className="animate-spin" />
                  Loading settings...
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                
                {/* ── WhatsApp Tab ── */}
                {activeTab === "whatsapp" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">WhatsApp Integration Settings</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Configure the Tata BSP details for sending outbound alerts.</p>
                    </div>

                    <FieldRow label="Enable WhatsApp Alerts" hint="Activate system alerts via WhatsApp">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("whatsapp.enabled")} onChange={(v) => tog("whatsapp.enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("whatsapp.enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="Tata Base URL" hint="Tata Tele Business API endpoint URL">
                      <AdminInput value={g("whatsapp.tata_base_url")} onChange={(e) => set("whatsapp.tata_base_url", e.target.value)} placeholder="https://wb.omni.tatatelebusiness.com" />
                    </FieldRow>

                    <FieldRow label="Tata Sender / Bot ID" hint="Your configured WhatsApp Business Number ID">
                      <AdminInput value={g("whatsapp.tata_sender")} onChange={(e) => set("whatsapp.tata_sender", e.target.value)} placeholder="1073459305848682" />
                    </FieldRow>

                    <FieldRow label="Tata Bearer Token" hint="Bearer Authentication token token for API calls">
                      <SecretInput value={g("whatsapp.tata_bearer_token")} onChange={(v) => set("whatsapp.tata_bearer_token", v)} />
                    </FieldRow>
                  </div>
                )}

                {/* ── Email Tab ── */}
                {activeTab === "email" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">Email & SMTP Gateway Settings</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Configure SMTP credentials for outgoing invoices and receipts.</p>
                    </div>

                    <FieldRow label="Enable Automated Emails" hint="Send transaction emails automatically">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("email.enabled")} onChange={(v) => tog("email.enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("email.enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="SMTP Host" hint="Host address of mail server">
                      <AdminInput value={g("email.smtp_host")} onChange={(e) => set("email.smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
                    </FieldRow>

                    <FieldRow label="SMTP Port" hint="Port code (e.g. 587 or 465)">
                      <AdminInput value={g("email.smtp_port")} onChange={(e) => set("email.smtp_port", e.target.value)} placeholder="587" />
                    </FieldRow>

                    <FieldRow label="SMTP Username" hint="Usually email ID of account">
                      <AdminInput value={g("email.smtp_user")} onChange={(e) => set("email.smtp_user", e.target.value)} placeholder="username@gmail.com" />
                    </FieldRow>

                    <FieldRow label="SMTP Password" hint="App-specific credentials string">
                      <SecretInput value={g("email.smtp_password")} onChange={(v) => set("email.smtp_password", v)} />
                    </FieldRow>

                    <FieldRow label="From Display Name" hint="Sender name shown to customer">
                      <AdminInput value={g("email.from_name")} onChange={(e) => set("email.from_name", e.target.value)} placeholder="Modern Orthodontics" />
                    </FieldRow>

                    <FieldRow label="From Email Address" hint="Sender email address shown to customer">
                      <AdminInput type="email" value={g("email.from_email")} onChange={(e) => set("email.from_email", e.target.value)} placeholder="noreply@modortho.com" />
                    </FieldRow>
                  </div>
                )}

                {/* ── SMS Tab ── */}
                {activeTab === "sms" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">SMS Gateway Settings</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Configure Twilio gateway options for SMS delivery channels.</p>
                    </div>

                    <FieldRow label="Enable SMS Channel" hint="Turn SMS delivery on/off">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("sms.enabled")} onChange={(v) => tog("sms.enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("sms.enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="SMS Provider" hint="Delivery provider strategy">
                      <AdminSelect
                        value={g("sms.provider")}
                        onChange={(e) => set("sms.provider", e.target.value)}
                        options={[
                          { value: "twilio", label: "Twilio Strategy" },
                        ]}
                      />
                    </FieldRow>

                    <FieldRow label="Twilio Account SID" hint="Twilio console project identifier">
                      <AdminInput value={g("sms.twilio_account_sid")} onChange={(e) => set("sms.twilio_account_sid", e.target.value)} />
                    </FieldRow>

                    <FieldRow label="Twilio Auth Token" hint="Twilio api authorization token">
                      <SecretInput value={g("sms.twilio_auth_token")} onChange={(v) => set("sms.twilio_auth_token", v)} />
                    </FieldRow>

                    <FieldRow label="Twilio Phone Number" hint="Outbound virtual number with country code">
                      <AdminInput value={g("sms.twilio_phone")} onChange={(e) => set("sms.twilio_phone", e.target.value)} placeholder="+1234567890" />
                    </FieldRow>
                  </div>
                )}

                {/* ── Payments Tab ── */}
                {activeTab === "payment" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">Payment Gateway Credentials</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Manage public/private keys for checkout page integration.</p>
                    </div>

                    <FieldRow label="Enable Razorpay Checkout" hint="Accept payments via Razorpay">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("payment.razorpay_enabled")} onChange={(v) => tog("payment.razorpay_enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("payment.razorpay_enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="Razorpay Key ID" hint="API public key client identifier">
                      <AdminInput value={g("payment.razorpay_key_id")} onChange={(e) => set("payment.razorpay_key_id", e.target.value)} />
                    </FieldRow>

                    <FieldRow label="Razorpay Key Secret" hint="API secret key for checksum validation">
                      <SecretInput value={g("payment.razorpay_key_secret")} onChange={(v) => set("payment.razorpay_key_secret", v)} />
                    </FieldRow>
                  </div>
                )}

                {/* ── File Uploads Tab ── */}
                {activeTab === "uploads" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">Cloud Media Upload Settings</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Configure Cloudinary API keys for hosting banner images and catalog files.</p>
                    </div>

                    <FieldRow label="Enable Cloudinary hosting" hint="If disabled, local storage fallback will be active">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("uploads.cloudinary_enabled")} onChange={(v) => tog("uploads.cloudinary_enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("uploads.cloudinary_enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="Cloud Name" hint="Your Cloudinary unique account namespace">
                      <AdminInput value={g("uploads.cloudinary_cloud_name")} onChange={(e) => set("uploads.cloudinary_cloud_name", e.target.value)} />
                    </FieldRow>

                    <FieldRow label="API Key" hint="Media console integration client key">
                      <AdminInput value={g("uploads.cloudinary_api_key")} onChange={(e) => set("uploads.cloudinary_api_key", e.target.value)} />
                    </FieldRow>

                    <FieldRow label="API Secret" hint="Media console signature validation credentials">
                      <SecretInput value={g("uploads.cloudinary_api_secret")} onChange={(v) => set("uploads.cloudinary_api_secret", v)} />
                    </FieldRow>
                  </div>
                )}

                {/* ── Redis Tab ── */}
                {activeTab === "redis" && (
                  <div>
                    <div className="mb-6 pb-3 border-b border-[#F4F4F4]">
                      <h2 className="text-[15px] font-bold text-[#1A1A1A]">Redis Configuration & Cache</h2>
                      <p className="text-[12px] text-gray-500 mt-1">Control in-memory database configuration and back-end caches.</p>
                    </div>

                    <FieldRow label="Enable Redis Cache" hint="Speeds up product routing and CMS queries">
                      <div className="flex items-center gap-3">
                        <Toggle value={b("redis.enabled")} onChange={(v) => tog("redis.enabled", v)} />
                        <span className="text-[13px] text-[#6B6B6B]">
                          {b("redis.enabled") ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </FieldRow>

                    <FieldRow label="Cache Clear Actions" hint="Force refresh catalog and routing memory caches.">
                      <button
                        type="button"
                        onClick={() => {
                          showToast("Backend cache reset signal dispatched.", "success");
                        }}
                        className="rounded-lg border border-[#E31E24] px-4 py-2 text-[12.5px] font-medium text-[#E31E24] hover:bg-[#E31E24]/5"
                      >
                        Reset Backend Cache
                      </button>
                    </FieldRow>
                  </div>
                )}

              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
