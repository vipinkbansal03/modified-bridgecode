"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Smartphone,
  Send,
  CheckCircle2,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
  Save,
  FileCode,
  X,
  ExternalLink,
  ShieldCheck,
  Phone,
  MessageSquare,
  Bell,
} from "lucide-react";
import {
  AdminTextarea,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

interface WhatsAppSettingsStudioProps {
  embedded?: boolean;
}

export function WhatsAppSettingsStudio({ embedded = false }: WhatsAppSettingsStudioProps) {
  const { showToast } = useToast();

  // Settings State
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modals & Gateway Config State
  const [activeGatewayKey, setActiveGatewayKey] = useState<"msg91" | "tata" | "twilio">("msg91");
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  // Test Outbound State
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [testCustomMessage, setTestCustomMessage] = useState(
    "Hello from Modern Orthodontics! This is a test WhatsApp notification confirming your gateway setup."
  );
  const [sendingTestWhatsapp, setSendingTestWhatsapp] = useState(false);

  // Load Settings from API
  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await adminApi.get("/settings?group=whatsapp");
      const rows = res.data?.data || [];
      const map: Record<string, string> = {};
      rows.forEach((s: any) => {
        map[s.key] = s.value === "***" ? "" : s.value;
      });
      setSettings(map);
    } catch (err) {
      showToast("Failed to load WhatsApp gateway settings.", "error");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Helper getters
  const g = (key: string) => settings[key] || "";
  const setField = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  // Save Settings
  const saveWhatsAppSettings = async () => {
    const businessNumber = g("whatsapp.number").trim();
    if (businessNumber && businessNumber.includes("@")) {
      showToast("Please enter a valid business phone number with country code (e.g. 919876543210), not an email address.", "error");
      return;
    }

    try {
      setSavingSettings(true);
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        group: "whatsapp",
      }));
      await adminApi.put("/settings", { settings: payload });
      showToast("WhatsApp gateway & widget settings saved successfully.", "success");
      setGatewayModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update WhatsApp settings."), "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger Test WhatsApp
  const handleSendTestWhatsapp = async () => {
    if (!testRecipientPhone || testRecipientPhone.length < 8) {
      showToast("Please enter a valid recipient phone number with country code (e.g. 919876543210).", "error");
      return;
    }
    try {
      setSendingTestWhatsapp(true);
      const res = await adminApi.post("/settings/test-whatsapp", {
        phone: testRecipientPhone.trim(),
        message: testCustomMessage.trim(),
      });
      showToast(res.data?.message || `Test WhatsApp message sent to ${testRecipientPhone}!`, "success");
      setTestModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to dispatch test WhatsApp message."), "error");
    } finally {
      setSendingTestWhatsapp(false);
    }
  };

  const isMsg91Connected = Boolean(g("whatsapp.msg91_auth_key") || g("email.msg91_auth_key"));
  const isTataConnected = Boolean(g("whatsapp.tata_bearer_token") || g("whatsapp.tata_sender"));
  const isTwilioConnected = Boolean(g("whatsapp.twilio_account_sid") && g("whatsapp.twilio_auth_token"));
  const currentProvider = g("whatsapp.provider") || "msg91";
  const isNotificationsEnabled = g("whatsapp.enabled") !== "false";
  const isFloatingButtonEnabled = g("whatsapp.floating_button_enabled") === "true";

  return (
    <div className="space-y-6 pb-6">
      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-600" />
            WhatsApp Management Studio
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure gateways (MSG91, Tata Tele Business, Twilio), live test dispatch, and storefront floating chat widget.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <Link
            href="/admin/notifications/templates"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 hover:border-gray-300 transition-all"
          >
            <Bell className="h-3.5 w-3.5 text-blue-600" />
            <span>Notification Templates</span>
            <ExternalLink className="h-3 w-3 text-gray-400" />
          </Link>

          <LoadingButton
            type="button"
            onClick={saveWhatsAppSettings}
            loading={savingSettings}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#B5151B] cursor-pointer transition-all"
          >
            <Save className="h-3.5 w-3.5" />
            Save Settings
          </LoadingButton>
        </div>
      </div>

      {/* ─── Gateway Section ──────────────────────────────────────────────── */}
      <div className="space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900">WhatsApp Gateway Integrations</h3>
            <p className="text-xs text-gray-500">
              Active primary provider: <span className="font-semibold text-gray-800 uppercase">{currentProvider}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">WhatsApp Notification Service:</span>
            <button
              type="button"
              onClick={() => {
                const nextVal = isNotificationsEnabled ? "false" : "true";
                setField("whatsapp.enabled", nextVal);
                saveWhatsAppSettings();
              }}
              className={cn(
                "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isNotificationsEnabled ? "bg-emerald-600" : "bg-gray-200"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  isNotificationsEnabled ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>

        {/* Gateway Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* 1. MSG91 WhatsApp (Primary Default) */}
          <div
            className={cn(
              "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
              currentProvider === "msg91" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-gray-200"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
                {isMsg91Connected || currentProvider === "msg91" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    <AlertCircle className="h-3 w-3" />
                    Not Configured
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-gray-900">MSG91 WhatsApp API</h4>
                <span className="inline-flex items-center rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                  Default
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Enterprise official WhatsApp Business Solution Provider (BSP) for real-time automated order notifications and customer messaging.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGatewayKey("msg91");
                    setGatewayModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E31E24] hover:underline cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure MSG91
                </button>

                <button
                  type="button"
                  onClick={() => setTestModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer"
                >
                  <Send className="h-3 w-3 text-emerald-600" />
                  Test WhatsApp
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-gray-500">
                  {currentProvider === "msg91" ? "Primary Gateway" : "Set Primary"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setField("whatsapp.provider", "msg91");
                    saveWhatsAppSettings();
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    currentProvider === "msg91" ? "bg-emerald-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      currentProvider === "msg91" ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 2. Tata Tele Business (Tata BSP) */}
          <div
            className={cn(
              "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
              currentProvider === "tata" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-gray-200"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                {isTataConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    <AlertCircle className="h-3 w-3" />
                    Not Configured
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-gray-900">Tata Tele Business (Tata BSP)</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Enterprise Omni-channel Tata Telecommunications WhatsApp Business API with dedicated bot routing.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGatewayKey("tata");
                    setGatewayModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E31E24] hover:underline cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure Tata
                </button>

                <button
                  type="button"
                  onClick={() => setTestModalOpen(true)}
                  className="inline-flex items-center gap-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer"
                >
                  <Send className="h-3 w-3 text-emerald-600" />
                  Test WhatsApp
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-gray-500">
                  {currentProvider === "tata" ? "Primary Gateway" : "Set Primary"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setField("whatsapp.provider", "tata");
                    saveWhatsAppSettings();
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    currentProvider === "tata" ? "bg-emerald-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      currentProvider === "tata" ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* 3. Twilio WhatsApp */}
          <div
            className={cn(
              "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
              currentProvider === "twilio" ? "border-emerald-500 ring-1 ring-emerald-500/20" : "border-gray-200"
            )}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="h-11 w-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                  <Smartphone className="h-5 w-5" />
                </div>
                {isTwilioConnected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    <AlertCircle className="h-3 w-3" />
                    Not Configured
                  </span>
                )}
              </div>

              <h4 className="text-sm font-bold text-gray-900">Twilio WhatsApp</h4>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                Global Twilio Conversations & Programmable Messaging API for international WhatsApp delivery.
              </p>
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGatewayKey("twilio");
                    setGatewayModalOpen(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#E31E24] hover:underline cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Configure Twilio
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-medium text-gray-500">
                  {currentProvider === "twilio" ? "Primary Gateway" : "Set Primary"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setField("whatsapp.provider", "twilio");
                    saveWhatsAppSettings();
                  }}
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    currentProvider === "twilio" ? "bg-emerald-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      currentProvider === "twilio" ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 2: Website Floating WhatsApp Chat Button ─── */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                Storefront Floating WhatsApp Chat Widget
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Display an interactive green WhatsApp chat button on the live storefront so visiting dentists and distributors can start an instant conversation with your sales team.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">
                {isFloatingButtonEnabled ? "Widget Visible" : "Widget Hidden"}
              </span>
              <button
                type="button"
                onClick={() => {
                  const nextVal = isFloatingButtonEnabled ? "false" : "true";
                  setField("whatsapp.floating_button_enabled", nextVal);
                }}
                className={cn(
                  "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                  isFloatingButtonEnabled ? "bg-emerald-600" : "bg-gray-200"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    isFloatingButtonEnabled ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Form inputs (2 cols) */}
            <div className="lg:col-span-2 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Business WhatsApp Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    type="tel"
                    value={g("whatsapp.number")}
                    onChange={(e) => {
                      // Allow only numbers, +, and hyphens (prevent typing email addresses)
                      const cleaned = e.target.value.replace(/[^\d+ -]/g, "");
                      setField("whatsapp.number", cleaned);
                    }}
                    placeholder="919876543210 (Country code + Mobile number)"
                    className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>
                <p className="text-[11px] text-gray-500 mt-1">
                  Enter the full mobile phone number with international country code (e.g. <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">919876543210</code> for India, <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">15553498201</code> for US). Do not enter an email address.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Default Pre-filled Chat Greeting Message
                </label>
                <AdminTextarea
                  value={g("whatsapp.default_message")}
                  onChange={(e) => setField("whatsapp.default_message", e.target.value)}
                  rows={3}
                  placeholder="Hi Modern Orthodontics, I would like to inquire about your precision archwires and brackets catalog."
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  When a customer clicks the WhatsApp button on your website, this text will automatically be filled in their WhatsApp chat input.
                </p>
              </div>

              <div className="pt-2">
                <LoadingButton
                  type="button"
                  onClick={saveWhatsAppSettings}
                  loading={savingSettings}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#B5151B] cursor-pointer"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save WhatsApp Settings
                </LoadingButton>
              </div>
            </div>

            {/* Live Preview Card (1 col) */}
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-5 flex flex-col items-center justify-center text-center space-y-4">
              <div className="text-xs font-bold text-gray-800">Live Website Button Mockup</div>
              
              <div className="relative group cursor-pointer">
                {/* Floating WhatsApp Bubble Mockup */}
                <div className="h-14 w-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                  <MessageCircle className="h-7 w-7" />
                  <span className="absolute top-0 right-0 h-3.5 w-3.5 rounded-full bg-emerald-400 border-2 border-white animate-pulse" />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs font-semibold text-gray-900">
                  {g("whatsapp.number") ? `+${g("whatsapp.number").replace(/\+/g, "")}` : "No Number Configured"}
                </div>
                <p className="text-[11px] text-gray-600 line-clamp-2 italic px-2">
                  "{g("whatsapp.default_message") || "Hi Modern Orthodontics, I would like to inquire..."}"
                </p>
              </div>

              <div className="text-[10.5px] text-emerald-800 bg-emerald-100/70 border border-emerald-200 rounded-md px-2.5 py-1">
                {isFloatingButtonEnabled ? "✅ Active on Storefront" : "⏸️ Widget Currently Hidden"}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 3: Notification Templates Notice & Shortcut Card ─── */}
        <div className="rounded-xl border border-blue-100 bg-linear-to-r from-blue-50/60 via-white to-white p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900">Manage Automated WhatsApp Notification Templates</h4>
              <p className="text-xs text-gray-600 mt-0.5 max-w-2xl leading-relaxed">
                Dynamic WhatsApp message bodies, tag variables (<code className="text-blue-700 font-mono bg-blue-50 px-1 py-0.5 rounded">{"{{customer_name}}"}</code>, <code className="text-blue-700 font-mono bg-blue-50 px-1 py-0.5 rounded">{"{{order_number}}"}</code>), and role-based notification triggers are centrally managed in the Notification Center.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start md:self-auto">
            <Link
              href="/admin/notifications/manager"
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors"
            >
              <span>Channel Rules</span>
            </Link>
            <Link
              href="/admin/notifications/templates"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-colors"
            >
              <FileCode className="h-3.5 w-3.5" />
              <span>Open Template Studio</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: TEST WHATSAPP DISPATCHER ───────────────────────────────── */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                  <MessageCircle className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Send Test WhatsApp Message</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-gray-500">
              Dispatches a live test message using your configured active WhatsApp provider (<strong className="uppercase">{currentProvider}</strong>).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Recipient WhatsApp Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={testRecipientPhone}
                  onChange={(e) => setTestRecipientPhone(e.target.value)}
                  placeholder="e.g. 919876543210 (Country code + Phone)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Custom Test Message
                </label>
                <textarea
                  rows={3}
                  value={testCustomMessage}
                  onChange={(e) => setTestCustomMessage(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 p-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                loading={sendingTestWhatsapp}
                onClick={handleSendTestWhatsapp}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                Send Test Now
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: GATEWAY CREDENTIALS CONFIGURATION ──────────────────────── */}
      {gatewayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-700">
                  <Settings className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">
                  {activeGatewayKey === "msg91" && "Configure MSG91 WhatsApp API"}
                  {activeGatewayKey === "tata" && "Configure Tata Tele Business (Tata BSP)"}
                  {activeGatewayKey === "twilio" && "Configure Twilio WhatsApp"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* MSG91 Fields */}
            {activeGatewayKey === "msg91" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    MSG91 AuthKey <span className="text-gray-400 font-normal">(Leave blank to use Email MSG91 Key)</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={g("whatsapp.msg91_auth_key")}
                      onChange={(e) => setField("whatsapp.msg91_auth_key", e.target.value)}
                      placeholder="Enter MSG91 AuthKey"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">
                    MSG91 Integrated WhatsApp Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={g("whatsapp.msg91_integrated_number")}
                    onChange={(e) => setField("whatsapp.msg91_integrated_number", e.target.value)}
                    placeholder="e.g. 919240213800"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                  <p className="text-[11px] text-gray-500 mt-1">
                    The verified WhatsApp business phone number connected in your MSG91 control panel with country code.
                  </p>
                </div>
              </div>
            )}

            {/* Tata Fields */}
            {activeGatewayKey === "tata" && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tata Base URL</label>
                    <input
                      type="text"
                      value={g("whatsapp.tata_base_url")}
                      onChange={(e) => setField("whatsapp.tata_base_url", e.target.value)}
                      placeholder="https://wb.omni.tatatelebusiness.com"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tata Sender Number</label>
                    <input
                      type="text"
                      value={g("whatsapp.tata_sender")}
                      onChange={(e) => setField("whatsapp.tata_sender", e.target.value)}
                      placeholder="9240213800"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Tata Bearer Token</label>
                  <input
                    type="password"
                    value={g("whatsapp.tata_bearer_token")}
                    onChange={(e) => setField("whatsapp.tata_bearer_token", e.target.value)}
                    placeholder="Enter Tata Bearer Token"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tata API Key</label>
                    <input
                      type="text"
                      value={g("whatsapp.tata_api_key")}
                      onChange={(e) => setField("whatsapp.tata_api_key", e.target.value)}
                      placeholder="API Key"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tata Bot ID</label>
                    <input
                      type="text"
                      value={g("whatsapp.tata_bot_id")}
                      onChange={(e) => setField("whatsapp.tata_bot_id", e.target.value)}
                      placeholder="Bot ID"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Twilio Fields */}
            {activeGatewayKey === "twilio" && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Twilio Account SID</label>
                  <input
                    type="text"
                    value={g("whatsapp.twilio_account_sid")}
                    onChange={(e) => setField("whatsapp.twilio_account_sid", e.target.value)}
                    placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Twilio Auth Token</label>
                  <input
                    type="password"
                    value={g("whatsapp.twilio_auth_token")}
                    onChange={(e) => setField("whatsapp.twilio_auth_token", e.target.value)}
                    placeholder="Enter Twilio Auth Token"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Twilio WhatsApp Sender Number</label>
                  <input
                    type="text"
                    value={g("whatsapp.twilio_phone_number")}
                    onChange={(e) => setField("whatsapp.twilio_phone_number", e.target.value)}
                    placeholder="whatsapp:+14155238886"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                loading={savingSettings}
                onClick={saveWhatsAppSettings}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-3.5 py-1.5 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                <Save className="h-3.5 w-3.5" />
                Save Credentials
              </LoadingButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
