"use client";

import { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Smartphone,
  Send,
  CheckCircle2,
  AlertCircle,
  Settings,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  Sparkles,
  ChevronDown,
  ChevronUp,
  FileCode,
  X,
  Plus,
  Info,
} from "lucide-react";
import {
  AdminInput,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import {
  useNotificationConfigs,
  useUpdateNotificationConfig,
  useNotificationTemplates,
  useUpdateNotificationTemplate,
} from "@/hooks/api";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

// ─── Default Sample Data for Previews ───────────────────────────────────────
const SAMPLE_MOCK_DATA: Record<string, string> = {
  customer_name: "Dr. Alexander Wright",
  phone: "+91 98765 43210",
  order_number: "MO-2026-9841",
  order_total: "1,450.00",
  currency: "USD",
  carrier_name: "FedEx",
  tracking_number: "784920194820",
  tracking_url: "https://fedex.com/track/784920194820",
  payment_status: "SUCCESSFUL",
  quote_number: "QT-2026-0412",
  quote_total: "3,200.00",
  otp_code: "482019",
};

// ─── Event Definitions ───────────────────────────────────────────────────────
const SMS_EVENTS = [
  {
    type: "USER_ONBOARDED",
    title: "Account Onboarding / Welcome SMS",
    category: "Customer Onboarding",
    description: "Dispatched to registered phone number when an account is approved.",
    defaultBody: "Hello {{customer_name}}, your Modern Orthodontics B2B customer account is active. Log in to place precision wire orders.",
    tags: ["customer_name"],
  },
  {
    type: "FORGOT_PASSWORD",
    title: "OTP & Password Reset SMS",
    category: "Security & Auth",
    description: "Dispatched when user requests an OTP code or instant password reset code.",
    defaultBody: "Your Modern Orthodontics verification code is {{otp_code}}. Valid for 10 minutes. Do not share this OTP with anyone.",
    tags: ["otp_code", "customer_name"],
  },
  {
    type: "ORDER_PLACED",
    title: "Order Confirmation SMS",
    category: "Orders & Sales",
    description: "Dispatched immediately upon successful order placement or RFQ checkout.",
    defaultBody: "Dear {{customer_name}}, your order #{{order_number}} of total {{currency}} {{order_total}} has been received and is being processed.",
    tags: ["customer_name", "order_number", "currency", "order_total"],
  },
  {
    type: "ORDER_SHIPPED",
    title: "Order Dispatched / Shipped SMS",
    category: "Fulfillment & Tracking",
    description: "Dispatched with courier name and package tracking ID upon shipment.",
    defaultBody: "Hi {{customer_name}}, order #{{order_number}} is shipped via {{carrier_name}}. Track: {{tracking_number}}",
    tags: ["customer_name", "order_number", "carrier_name", "tracking_number"],
  },
  {
    type: "ORDER_DELIVERED",
    title: "Order Delivered SMS",
    category: "Fulfillment & Tracking",
    description: "Dispatched once courier confirms package delivery at customer destination.",
    defaultBody: "Hello {{customer_name}}, order #{{order_number}} has been delivered via {{carrier_name}}. Thank you for choosing Modern Orthodontics.",
    tags: ["customer_name", "order_number", "carrier_name"],
  },
  {
    type: "ORDER_CANCELLED",
    title: "Order Cancelled SMS",
    category: "Orders & Sales",
    description: "Dispatched if an order is cancelled or refunded.",
    defaultBody: "Dear {{customer_name}}, order #{{order_number}} has been cancelled. Any eligible refund has been initiated.",
    tags: ["customer_name", "order_number"],
  },
  {
    type: "PAYMENT_SUCCESS",
    title: "Payment Receipt SMS",
    category: "Billing & Invoices",
    description: "Dispatched once payment confirmation is received.",
    defaultBody: "Hello {{customer_name}}, payment for order #{{order_number}} ({{currency}} {{order_total}}) was received successfully. Thank you!",
    tags: ["customer_name", "order_number", "currency", "order_total"],
  },
  {
    type: "QUOTE_PROPOSAL_SENT",
    title: "Quote Proposal SMS",
    category: "Quotations & RFQ",
    description: "Dispatched when a custom RFQ quotation has been published to customer account.",
    defaultBody: "Hello {{customer_name}}, your custom quotation #{{quote_number}} for {{currency}} {{quote_total}} is ready. Review & approve in your account.",
    tags: ["customer_name", "quote_number", "currency", "quote_total"],
  },
];

export function SmsSettingsStudio({ embedded = false }: { embedded?: boolean }) {
  const { showToast } = useToast();

  // Tab State
  const [activeTab, setActiveTab] = useState<"settings" | "templates">("settings");

  // Settings Data
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Test SMS Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testRecipientPhone, setTestRecipientPhone] = useState("");
  const [testOtpCode, setTestOtpCode] = useState("123456");
  const [sendingTestSms, setSendingTestSms] = useState(false);

  // Gateway Config Modal State
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [activeGatewayKey, setActiveGatewayKey] = useState<"msg91" | "twilio" | "twofactor">("msg91");
  const [showSecret, setShowSecret] = useState(false);

  // Notification Configs & Templates Data
  const { data: configs = [] } = useNotificationConfigs();
  const updateConfigMutation = useUpdateNotificationConfig();
  const { data: templates = [] } = useNotificationTemplates();
  const updateTemplateMutation = useUpdateNotificationTemplate();

  // Expanded Accordion State
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({
    USER_ONBOARDED: true,
  });

  // Local draft states
  const [templateDrafts, setTemplateDrafts] = useState<Record<string, { message: string }>>({});

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ title: string; text: string }>({
    title: "",
    text: "",
  });

  // Active cursor tracking for tag insertion
  const activeInputRef = useRef<{ eventType: string; element: HTMLTextAreaElement | null }>({
    eventType: "",
    element: null,
  });

  // Load Settings from API
  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await adminApi.get("/settings?group=sms");
      const rows = res.data?.data || [];
      const map: Record<string, string> = {};
      rows.forEach((s: any) => {
        map[s.key] = s.value === "***" ? "" : s.value;
      });
      setSettings(map);
    } catch (err) {
      showToast("Failed to load SMS gateway settings.", "error");
    } finally {
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Sync initial drafts when templates load
  useEffect(() => {
    if (templates.length > 0) {
      const initial: Record<string, { message: string }> = {};
      SMS_EVENTS.forEach((event) => {
        const found = templates.find(
          (t: any) => t.type?.toUpperCase() === event.type && t.channel?.toLowerCase() === "sms"
        );
        initial[event.type] = {
          message: found?.message ?? event.defaultBody,
        };
      });
      setTemplateDrafts(initial);
    } else {
      const initial: Record<string, { message: string }> = {};
      SMS_EVENTS.forEach((event) => {
        initial[event.type] = {
          message: event.defaultBody,
        };
      });
      setTemplateDrafts(initial);
    }
  }, [templates]);

  // Helper getters
  const g = (key: string) => settings[key] || "";
  const setField = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  // Save Settings
  const saveSmsSettings = async () => {
    try {
      setSavingSettings(true);
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        group: "sms",
      }));
      await adminApi.put("/settings", { settings: payload });
      showToast("SMS gateway settings saved successfully.", "success");
      setGatewayModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update SMS settings."), "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger Test SMS
  const handleSendTestSms = async () => {
    if (!testRecipientPhone || testRecipientPhone.length < 8) {
      showToast("Please enter a valid recipient phone number with country code.", "error");
      return;
    }
    try {
      setSendingTestSms(true);
      const res = await adminApi.post("/settings/test-sms", {
        phone: testRecipientPhone.trim(),
        otp: testOtpCode.trim() || "123456",
      });
      showToast(res.data?.message || `Test SMS dispatched successfully to ${testRecipientPhone}!`, "success");
      setTestModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to dispatch test SMS."), "error");
    } finally {
      setSendingTestSms(false);
    }
  };

  // Toggle Event SMS Enabled
  const handleToggleEventChannel = async (eventType: string, currentEnabled: boolean) => {
    const config = configs.find((c: any) => c.type === eventType);
    if (!config) {
      showToast("Notification rule not found.", "error");
      return;
    }
    try {
      const updatedChannels = {
        ...(config.channels || {}),
        sms: !currentEnabled,
      };
      await updateConfigMutation.mutateAsync({
        id: config.id,
        data: { channels: updatedChannels },
      });
      showToast(`${eventType} SMS notification ${!currentEnabled ? "enabled" : "disabled"}.`, "success");
    } catch (err) {
      showToast("Failed to update notification toggle.", "error");
    }
  };

  // Save specific template
  const handleSaveTemplate = async (eventType: string) => {
    const draft = templateDrafts[eventType];
    if (!draft) return;
    try {
      await updateTemplateMutation.mutateAsync({
        type: eventType,
        channel: "sms",
        data: {
          subject: "",
          message: draft.message,
          role: "GLOBAL",
        },
      });
      showToast("SMS template saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save SMS template.", "error");
    }
  };

  // Reset to Default Template
  const handleResetToDefault = (event: (typeof SMS_EVENTS)[0]) => {
    if (confirm(`Reset "${event.title}" template back to factory defaults?`)) {
      setTemplateDrafts((prev) => ({
        ...prev,
        [event.type]: {
          message: event.defaultBody,
        },
      }));
      showToast("Template reset to default. Click Save to persist.", "info");
    }
  };

  // Tag Insertion at cursor
  const handleInsertTag = (eventType: string, tag: string) => {
    const tagText = `{{${tag}}}`;
    const draft = templateDrafts[eventType] || { message: "" };

    const textareaEl = activeInputRef.current.element;
    if (textareaEl && activeInputRef.current.eventType === eventType) {
      const start = textareaEl.selectionStart || draft.message.length;
      const end = textareaEl.selectionEnd || draft.message.length;
      const newMessage = draft.message.substring(0, start) + tagText + draft.message.substring(end);
      setTemplateDrafts((prev) => ({
        ...prev,
        [eventType]: { message: newMessage },
      }));
      setTimeout(() => {
        textareaEl.focus();
        textareaEl.setSelectionRange(start + tagText.length, start + tagText.length);
      }, 10);
    } else {
      setTemplateDrafts((prev) => ({
        ...prev,
        [eventType]: { message: draft.message + " " + tagText },
      }));
    }
    showToast(`Tag ${tagText} inserted.`, "info");
  };

  // Open Live Preview Modal
  const handleOpenPreview = (event: (typeof SMS_EVENTS)[0]) => {
    const draft = templateDrafts[event.type] || { message: event.defaultBody };

    let compiledBody = draft.message;
    Object.entries(SAMPLE_MOCK_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      compiledBody = compiledBody.replace(regex, value);
    });

    setPreviewData({
      title: event.title,
      text: compiledBody,
    });
    setPreviewModalOpen(true);
  };

  const isMsg91Connected = Boolean(g("sms.msg91_auth_key"));
  const isTwilioConnected = Boolean(g("sms.twilio_account_sid") && g("sms.twilio_auth_token"));
  const currentProvider = g("sms.provider") || (isMsg91Connected ? "msg91" : "msg91");

  return (
    <div className="space-y-6 pb-6">
      {/* ─── Breadcrumb & Sub-nav Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#E31E24]" />
            SMS Management Studio
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage SMS gateways (MSG91, Twilio) and customize dynamic SMS text templates.
          </p>
        </div>

        {/* Sub-navigation Tabs */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeTab === "settings"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <Settings className="h-3.5 w-3.5" />
            SMS Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer",
              activeTab === "templates"
                ? "bg-[#E31E24] text-white shadow-xs"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            )}
          >
            <FileCode className="h-3.5 w-3.5" />
            SMS Templates
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: SMS SETTINGS (GATEWAYS)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div>
            <h3 className="text-sm font-bold text-gray-900">SMS Gateway Integrations</h3>
            <p className="text-xs text-gray-500">
              Active provider: <span className="font-semibold text-gray-800 uppercase">{currentProvider}</span>
            </p>
          </div>

          {/* Gateway Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. MSG91 SMS Gateway */}
            <div
              className={cn(
                "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
                currentProvider === "msg91" ? "border-green-500 ring-1 ring-green-500/20" : "border-gray-200"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  {isMsg91Connected ? (
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

                <h4 className="text-sm font-bold text-gray-900">MSG91 (India / Global)</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Primary gateway for high-speed SMS dispatch, DLT-approved templates, and instant OTP delivery.
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
                    <Send className="h-3 w-3" />
                    Test SMS
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-gray-500">
                    {currentProvider === "msg91" ? "Primary Gateway" : "Set Primary"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("sms.provider", "msg91");
                      saveSmsSettings();
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

            {/* 2. Twilio SMS Gateway */}
            <div
              className={cn(
                "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
                currentProvider === "twilio" ? "border-green-500 ring-1 ring-green-500/20" : "border-gray-200"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-[#E31E24]">
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

                <h4 className="text-sm font-bold text-gray-900">Twilio SMS</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Global communications gateway suitable for North American and European international routes.
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
                      setField("sms.provider", "twilio");
                      saveSmsSettings();
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

            {/* 3. 2Factor Gateway */}
            <div
              className={cn(
                "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
                currentProvider === "twofactor" ? "border-green-500 ring-1 ring-green-500/20" : "border-gray-200"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                    <AlertCircle className="h-3 w-3" />
                    Standby
                  </span>
                </div>

                <h4 className="text-sm font-bold text-gray-900">2Factor SMS</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Backup high-speed transactional SMS gateway for dedicated OTP validation failovers.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGatewayKey("twofactor");
                    setGatewayModalOpen(true);
                  }}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline cursor-pointer"
                >
                  View Details
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {currentProvider === "twofactor" ? "Active" : "Set Active"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("sms.provider", "twofactor");
                      saveSmsSettings();
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      currentProvider === "twofactor" ? "bg-emerald-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        currentProvider === "twofactor" ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: SMS TEMPLATES (ACCORDION STUDIO)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "templates" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">SMS Templates Studio</h3>
              <p className="text-xs text-gray-500">
                Expand each SMS notification event to edit concise text bodies and tag variables.
              </p>
            </div>
          </div>

          {/* Accordion List */}
          <div className="space-y-4">
            {SMS_EVENTS.map((event) => {
              const isExpanded = Boolean(expandedEvents[event.type]);
              const config = configs.find((c: any) => c.type === event.type);
              const isEnabled = config?.channels?.sms === true;
              const draft = templateDrafts[event.type] || { message: event.defaultBody };
              const charCount = draft.message.length;
              const smsSegments = Math.ceil(charCount / 160) || 1;

              return (
                <div
                  key={event.type}
                  className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden transition-all"
                >
                  {/* Header */}
                  <div className="p-4 sm:p-5 flex items-center justify-between gap-4 bg-white hover:bg-gray-50/50 transition-colors">
                    <div
                      className="flex-1 cursor-pointer flex items-center gap-3"
                      onClick={() =>
                        setExpandedEvents((prev) => ({
                          ...prev,
                          [event.type]: !prev[event.type],
                        }))
                      }
                    >
                      <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-gray-900">{event.title}</h4>
                          <span className="text-[11px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                            {event.type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{event.description}</p>
                      </div>
                    </div>

                    {/* Header Actions: Toggle + Chevron */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 hidden sm:inline">
                          {isEnabled ? "Active" : "Disabled"}
                        </span>
                        <button
                          type="button"
                          title="Toggle SMS notification on/off"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleEventChannel(event.type, isEnabled);
                          }}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            isEnabled ? "bg-emerald-600" : "bg-gray-200"
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                              isEnabled ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedEvents((prev) => ({
                            ...prev,
                            [event.type]: !prev[event.type],
                          }))
                        }
                        className="h-8 w-8 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Accordion Expanded Body */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-5 bg-gray-50/40 space-y-5">
                      {/* 2-Column Split: Left Editor + Right Tag Palette */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Left Column (8 cols): Editor */}
                        <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between border-b border-gray-200 pb-2.5 mb-3">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                SMS Message Content
                              </label>
                              <div className="text-xs font-medium text-gray-500">
                                <span className={cn("font-bold", charCount > 160 ? "text-amber-600" : "text-gray-800")}>
                                  {charCount}
                                </span>{" "}
                                characters &bull;{" "}
                                <span className="font-semibold text-gray-700">{smsSegments} SMS</span>
                              </div>
                            </div>

                            <textarea
                              rows={4}
                              value={draft.message}
                              onFocus={(e) => {
                                activeInputRef.current = {
                                  eventType: event.type,
                                  element: e.target,
                                };
                              }}
                              onChange={(e) =>
                                setTemplateDrafts((prev) => ({
                                  ...prev,
                                  [event.type]: { message: e.target.value },
                                }))
                              }
                              placeholder="Enter SMS text message..."
                              className="w-full text-sm text-gray-900 rounded-md border border-gray-300 p-3 leading-relaxed focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                            />
                          </div>

                          <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            Dynamic tags will be replaced with real order/customer details before dispatch.
                          </p>
                        </div>

                        {/* Right Column (4 cols): Tags Palette */}
                        <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                            <Sparkles className="h-4 w-4 text-[#E31E24]" />
                            Available &#123;Tags&#125;
                          </div>
                          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                            Click any tag to insert it into the SMS body:
                          </p>

                          <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-48 pr-1">
                            {event.tags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => handleInsertTag(event.type, tag)}
                                className="inline-flex items-center gap-1 rounded-md bg-gray-50 hover:bg-red-50 border border-gray-200 hover:border-red-200 px-2.5 py-1 text-xs font-mono text-gray-700 hover:text-[#E31E24] transition-all shadow-2xs group cursor-pointer"
                              >
                                <span>&#123;{tag}&#125;</span>
                                <Plus className="h-3 w-3 text-gray-400 group-hover:text-[#E31E24]" />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={() => handleResetToDefault(event)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs cursor-pointer"
                        >
                          <RotateCcw className="h-3.5 w-3.5 text-gray-500" />
                          Default Template
                        </button>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenPreview(event)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-xs cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5 text-blue-600" />
                            Preview SMS
                          </button>

                          <LoadingButton
                            onClick={() => handleSaveTemplate(event.type)}
                            loading={updateTemplateMutation.isPending}
                            className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-5 py-2 text-xs font-bold rounded-lg shadow-xs"
                          >
                            <Save className="h-3.5 w-3.5 mr-1" />
                            Save Template
                          </LoadingButton>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: CONFIGURE SMS GATEWAY
         ════════════════════════════════════════════════════════════════════ */}
      {gatewayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-red-50 text-[#E31E24] flex items-center justify-center font-bold">
                  <Settings className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">
                    {activeGatewayKey === "msg91" && "MSG91 SMS Gateway Configuration"}
                    {activeGatewayKey === "twilio" && "Twilio SMS Configuration"}
                    {activeGatewayKey === "twofactor" && "2Factor Configuration"}
                  </h3>
                  <p className="text-xs text-gray-500">Provide gateway keys to enable live delivery</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {activeGatewayKey === "msg91" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    MSG91 AuthKey (Secret)
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={g("sms.msg91_auth_key")}
                      onChange={(e) => setField("sms.msg91_auth_key", e.target.value)}
                      placeholder="Enter MSG91 AuthKey..."
                      className="w-full rounded-md border border-gray-300 px-3.5 py-2 pr-10 text-sm font-medium text-gray-900 shadow-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <AdminInput
                  label="Sender ID (DLT Header)"
                  placeholder="MODORT"
                  value={g("sms.msg91_sender_id")}
                  onChange={(e) => setField("sms.msg91_sender_id", e.target.value)}
                />

                <AdminInput
                  label="MSG91 OTP Template ID"
                  placeholder="63ab49..."
                  value={g("sms.msg91_otp_template_id")}
                  onChange={(e) => setField("sms.msg91_otp_template_id", e.target.value)}
                />
              </div>
            )}

            {activeGatewayKey === "twilio" && (
              <div className="space-y-4">
                <AdminInput
                  label="Twilio Account SID"
                  placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                  value={g("sms.twilio_account_sid")}
                  onChange={(e) => setField("sms.twilio_account_sid", e.target.value)}
                />

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Twilio Auth Token
                  </label>
                  <div className="relative">
                    <input
                      type={showSecret ? "text" : "password"}
                      value={g("sms.twilio_auth_token")}
                      onChange={(e) => setField("sms.twilio_auth_token", e.target.value)}
                      placeholder="Enter Twilio Auth Token..."
                      className="w-full rounded-md border border-gray-300 px-3.5 py-2 pr-10 text-sm font-medium text-gray-900 shadow-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret(!showSecret)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <AdminInput
                  label="Twilio Phone Number"
                  placeholder="+1234567890"
                  value={g("sms.twilio_phone")}
                  onChange={(e) => setField("sms.twilio_phone", e.target.value)}
                />
              </div>
            )}

            {activeGatewayKey === "twofactor" && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 leading-relaxed">
                2Factor configuration is managed automatically through system environment failover variables.
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setGatewayModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                loading={savingSettings}
                onClick={saveSmsSettings}
                className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-5 py-2 text-xs font-bold rounded-lg"
              >
                Save Integration
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: SEND TEST SMS
         ════════════════════════════════════════════════════════════════════ */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#E31E24]" />
                <h3 className="text-base font-bold text-gray-900">Send Test SMS</h3>
              </div>
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-gray-500 mb-4">
              Send a real test OTP message to verify MSG91 gateway credentials and phone delivery.
            </p>

            <div className="space-y-3">
              <AdminInput
                label="Recipient Phone Number (with Country Code)"
                placeholder="+919876543210"
                value={testRecipientPhone}
                onChange={(e) => setTestRecipientPhone(e.target.value)}
              />
              <AdminInput
                label="Test OTP Code"
                placeholder="123456"
                value={testOtpCode}
                onChange={(e) => setTestOtpCode(e.target.value)}
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-2 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setTestModalOpen(false)}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                loading={sendingTestSms}
                onClick={handleSendTestSms}
                className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-4 py-2 text-xs font-bold rounded-lg"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Dispatch Test SMS
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: SMS LIVE PREVIEW (PHONE MOCKUP)
         ════════════════════════════════════════════════════════════════════ */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border-4 border-gray-800 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Phone Speaker Notch */}
            <div className="bg-gray-800 p-2 flex justify-center">
              <div className="h-1 w-12 bg-gray-600 rounded-full" />
            </div>

            {/* Phone App Header */}
            <div className="bg-gray-100 border-b border-gray-200 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-[#E31E24] text-white flex items-center justify-center text-xs font-bold">
                  MO
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-900">MODORT</p>
                  <p className="text-[10px] text-gray-500">SMS Notification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-full p-1 text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Message Bubble Container */}
            <div className="p-4 bg-gray-50 flex-1 min-h-[220px] flex flex-col justify-end">
              <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-bl-xs text-xs shadow-xs leading-relaxed max-w-[90%]">
                {previewData.text}
                <div className="text-[9px] text-blue-200 mt-1 text-right">Just now &bull; Delivered</div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-3 bg-white border-t border-gray-200 flex justify-center">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="w-full rounded-lg bg-gray-900 text-white py-2 text-xs font-bold hover:bg-black transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
