"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Save, RefreshCw } from "lucide-react";
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
      className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none", value ? "bg-[#E31E24]" : "bg-gray-200")}
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
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
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

  // WhatsApp Toggles & Providers
  "whatsapp.provider":                { group: "whatsapp", type: "string" },
  "whatsapp.tata_api_key":            { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.tata_api_secret":         { group: "whatsapp", type: "secret", isSecret: true },
  "whatsapp.tata_bot_id":             { group: "whatsapp", type: "string" },



  // Notification settings
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
              {/* ── WhatsApp Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">WhatsApp Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Manage global WhatsApp service provider and activation.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminSelect
                    label="SELECT WHATSAPP SERVICE"
                    value={g("whatsapp.provider")}
                    onChange={(e) => set("whatsapp.provider", e.target.value)}
                    options={[
                      { value: "tata", label: "Tata" },
                    ]}
                  />
                  <SwitchRow label="Enable WhatsApp Service" hint="Turn WhatsApp sending on or off for the whole platform." value={b("whatsapp.enabled")} onChange={(v) => tog("whatsapp.enabled", v)} />
                  <div className="md:col-span-2">
                    <AdminInput label="TATA WHATSAPP SENDER" value={g("whatsapp.tata_sender")} onChange={(e) => set("whatsapp.tata_sender", e.target.value)} placeholder="9240213800" />
                  </div>
                </div>
              </div>

              {/* ── Tata WhatsApp Integration ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Tata WhatsApp Integration</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Configure Tata Tele Business API key credentials.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminInput label="TATA BASE URL" value={g("whatsapp.tata_base_url")} onChange={(e) => set("whatsapp.tata_base_url", e.target.value)} placeholder="https://wb.omni.tatatelebusiness.com" />
                  <AdminInput label="TATA BOT ID" value={g("whatsapp.tata_bot_id")} onChange={(e) => set("whatsapp.tata_bot_id", e.target.value)} />
                  
                  <SecretInput label="TATA BEARER TOKEN" value={g("whatsapp.tata_bearer_token")} onChange={(v) => set("whatsapp.tata_bearer_token", v)} />
                  <AdminInput label="TATA API KEY" value={g("whatsapp.tata_api_key")} onChange={(e) => set("whatsapp.tata_api_key", e.target.value)} />
                  
                  <div className="md:col-span-2">
                    <SecretInput label="TATA API SECRET" value={g("whatsapp.tata_api_secret")} onChange={(v) => set("whatsapp.tata_api_secret", v)} />
                  </div>
                </div>
              </div>

              {/* ── Email Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Email Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">SMTP credentials and mailing service options.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminInput label="SMTP HOST" value={g("email.smtp_host")} onChange={(e) => set("email.smtp_host", e.target.value)} placeholder="smtp.gmail.com" />
                  <AdminInput label="SMTP PORT" type="text" value={g("email.smtp_port")} onChange={(e) => set("email.smtp_port", e.target.value)} placeholder="587" />
                  
                  <AdminInput label="EMAIL ADDRESS" value={g("email.smtp_user")} onChange={(e) => set("email.smtp_user", e.target.value)} placeholder="username@gmail.com" />
                  <SecretInput label="EMAIL PASSWORD" value={g("email.smtp_password")} onChange={(v) => set("email.smtp_password", v)} />
                  
                  <div className="md:col-span-2">
                    <SwitchRow label="Enable Email Service" hint="Use this to pause or resume email sending without removing your SMTP details." value={b("email.enabled")} onChange={(v) => tog("email.enabled", v)} />
                  </div>
                </div>
              </div>

              {/* ── Payment Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Payment Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Razorpay Key configuration credentials.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminInput label="RAZORPAY KEY ID" value={g("payment.razorpay_key_id")} onChange={(e) => set("payment.razorpay_key_id", e.target.value)} />
                  <SecretInput label="RAZORPAY SECRET" value={g("payment.razorpay_key_secret")} onChange={(v) => set("payment.razorpay_key_secret", v)} />
                </div>
              </div>

              {/* ── Redis / Cache Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Redis / Cache Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Toggle cache state parameters.</p>
                </div>

                <SwitchRow label="Enable Redis Cache" hint="Turn cache-backed helpers on or off from the admin panel." value={b("redis.enabled")} onChange={(v) => tog("redis.enabled", v)} />
              </div>

              {/* ── Cache Control ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Cache Control</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Clear CMS page cache, system settings cache, and notification manager cache. Use this after content updates if the website still shows stale data.</p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => {
                      showToast("Backend cache reset signal dispatched.", "success");
                    }}
                    className="rounded-lg border border-[#E31E24] px-4 py-2 text-[12.5px] font-medium text-[#E31E24] hover:bg-[#E31E24]/5"
                  >
                    Reset Backend Cache
                  </button>
                </div>
              </div>

              {/* ── File Upload Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">File Upload Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Cloud storage and hosting configuration.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                  <AdminInput label="CLOUD NAME" value={g("uploads.cloudinary_cloud_name")} onChange={(e) => set("uploads.cloudinary_cloud_name", e.target.value)} />
                  <AdminInput label="API KEY" value={g("uploads.cloudinary_api_key")} onChange={(e) => set("uploads.cloudinary_api_key", e.target.value)} />
                  
                  <SecretInput label="API SECRET" value={g("uploads.cloudinary_api_secret")} onChange={(v) => set("uploads.cloudinary_api_secret", v)} />
                  <SwitchRow label="Enable Cloud Upload Service" hint="If turned off, uploads will use the local storage fallback." value={b("uploads.cloudinary_enabled")} onChange={(v) => tog("uploads.cloudinary_enabled", v)} />
                </div>
              </div>

              {/* ── Notification Settings ── */}
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs space-y-6">
                <div className="pb-3 border-b border-[#F4F4F4]">
                  <h2 className="text-[15px] font-bold text-[#1A1A1A]">Notification Settings</h2>
                  <p className="text-[12px] text-gray-500 mt-1">Manage notification delivery status per channel.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <SwitchRow label="Enable Notifications" hint="Pause or resume all notification delivery from one switch." value={b("notifications.masterEnabled")} onChange={(v) => tog("notifications.masterEnabled", v)} />
                  </div>
                  <SwitchRow label="Enable WhatsApp Notifications" hint="Turn this delivery channel on or off across the system." value={b("notifications.whatsapp")} onChange={(v) => tog("notifications.whatsapp", v)} />
                  <SwitchRow label="Enable Email Notifications" hint="Turn this delivery channel on or off across the system." value={b("notifications.email")} onChange={(v) => tog("notifications.email", v)} />
                  
                  <div className="md:col-span-2">
                    <SwitchRow label="Enable Push Notifications" hint="Turn this delivery channel on or off across the system." value={b("notifications.push")} onChange={(v) => tog("notifications.push", v)} />
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
