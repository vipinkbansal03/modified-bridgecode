"use client";

import { useState, useEffect, useRef } from "react";
import {
  Mail,
  Server,
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
  Code2,
  Type,
  FileCode,
  Globe,
  Lock,
  Package,
  MessageSquareQuote,
  Headphones,
  Newspaper,
  X,
  Plus,
  Info,
} from "lucide-react";
import {
  AdminInput,
  AdminSelect,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import {
  useNotificationConfigs,
  useUpdateNotificationConfig,
  useNotificationTemplates,
  useUpdateNotificationTemplate,
  useNotificationManagerSettings,
} from "@/hooks/api";
import { useAdminCountries } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

// ─── Default Sample Data for Previews ───────────────────────────────────────
const SAMPLE_MOCK_DATA: Record<string, string> = {
  customer_name: "Dr. Alexander Wright",
  email: "dr.wright@orthoclinic.com",
  phone: "+1 (555) 349-8201",
  order_number: "MO-2026-9841",
  order_total: "1,450.00",
  currency: "USD",
  carrier_name: "FedEx Priority",
  tracking_number: "784920194820",
  tracking_url: "https://fedex.com/track/784920194820",
  payment_status: "PAID / SUCCESSFUL",
  quote_number: "QT-2026-0412",
  quote_total: "3,200.00",
  reset_link: "https://modortho.com/reset-password?token=sample_token_123",
  company_name: "Modern Orthodontics",
};

// ─── Event Definitions ───────────────────────────────────────────────────────
const EMAIL_EVENTS = [
  {
    type: "USER_ONBOARDED",
    title: "Welcome Email",
    category: "Customer Onboarding",
    description: "Sent to newly registered dentists, distributors, or staff when their B2B account is activated.",
    defaultSubject: "Welcome to Modern Orthodontics!",
    defaultBody: `<p>Hello <strong>{{customer_name}}</strong>,</p>
<p>Welcome to Modern Orthodontics! Your B2B account has been successfully registered and approved.</p>
<p>Here are your registered account details:</p>
<ul>
  <li><strong>Email:</strong> {{email}}</li>
  <li><strong>Phone:</strong> {{phone}}</li>
</ul>
<p>You can now log in to the portal to browse our precision orthodontic catalog, configure bulk wire orders, and track your shipments.</p>
<p>Thank you,<br><strong>Modern Orthodontics Team</strong></p>`,
    tags: ["customer_name", "email", "phone", "company_name"],
  },
  {
    type: "CUSTOMER_APPROVAL",
    title: "Account Approved",
    category: "Customer Onboarding",
    description: "Sent when a B2B doctor or dealer account application has been reviewed and approved by admin.",
    defaultSubject: "Your Modern Orthodontics B2B Account is Approved!",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>We are pleased to inform you that your B2B account application for Modern Orthodontics has been approved.</p>
<p>You now have full access to wholesale tier pricing, online quotation generation, and distributor order management.</p>
<p>Welcome aboard,<br><strong>Modern Orthodontics Team</strong></p>`,
    tags: ["customer_name", "email", "company_name"],
  },
  {
    type: "FORGOT_PASSWORD",
    title: "Password Reset / OTP",
    category: "Security & Auth",
    description: "Sent when a doctor or clinic user requests a password reset or security verification link.",
    defaultSubject: "Reset your Modern Orthodontics password",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>We received a request to reset the password for your Modern Orthodontics account. Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.</p>
<div style="text-align: center; margin: 24px 0;">
  <a href="{{reset_link}}" style="background-color: #e31e24; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
</div>
<p style="font-size: 13px; color: #64748b;">If you did not request this password reset, no action is needed. Your account remains secure.</p>
<p>Warm regards,<br><strong>Modern Orthodontics Security Team</strong></p>`,
    tags: ["customer_name", "email", "reset_link", "company_name"],
  },
  {
    type: "ORDER_PLACED",
    title: "Order Confirmation",
    category: "Orders & Sales",
    description: "Sent immediately after a doctor or distributor places a new order or RFQ order is confirmed.",
    defaultSubject: "Order Confirmation #{{order_number}} - Modern Orthodontics",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>Thank you for your order! We have received order <strong>#{{order_number}}</strong> and are preparing it for manufacturing and dispatch.</p>
<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Order Number:</strong> {{order_number}}</p>
  <p style="margin: 0 0 8px 0;"><strong>Total Amount:</strong> {{currency}} {{order_total}}</p>
  <p style="margin: 0;"><strong>Status:</strong> Processing</p>
</div>
<p>You will receive another update with live courier tracking details as soon as your package ships.</p>
<p>Warm regards,<br><strong>Modern Orthodontics Team</strong></p>`,
    tags: ["customer_name", "order_number", "order_total", "currency", "company_name"],
  },
  {
    type: "ORDER_SHIPPED",
    title: "Order Dispatched / Shipped",
    category: "Fulfillment & Tracking",
    description: "Sent when an order is packed and dispatched with carrier information and tracking link.",
    defaultSubject: "Your order #{{order_number}} is on the way!",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>Great news! Your Modern Orthodontics order <strong>#{{order_number}}</strong> has been dispatched.</p>
<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Carrier:</strong> {{carrier_name}}</p>
  <p style="margin: 0 0 8px 0;"><strong>Tracking Number:</strong> {{tracking_number}}</p>
  <p style="margin: 0;"><a href="{{tracking_url}}" style="color: #0284c7; text-decoration: underline; font-weight: bold;">Track Package Live &rarr;</a></p>
</div>
<p>Please allow up to 24 hours for the carrier system to update initial checkpoint scans.</p>
<p>Regards,<br><strong>Modern Orthodontics Logistics</strong></p>`,
    tags: ["customer_name", "order_number", "carrier_name", "tracking_number", "tracking_url", "company_name"],
  },
  {
    type: "ORDER_DELIVERED",
    title: "Order Delivered",
    category: "Fulfillment & Tracking",
    description: "Sent when courier logs confirm the shipment has arrived at customer clinic or warehouse.",
    defaultSubject: "Delivered: Your order #{{order_number}} has arrived!",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>Our courier records confirm that your order <strong>#{{order_number}}</strong> has been successfully delivered.</p>
<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Carrier:</strong> {{carrier_name}}</p>
  <p style="margin: 0;"><strong>Tracking Number:</strong> {{tracking_number}}</p>
</div>
<p>Please inspect your package. If you have any inquiries regarding your orthodontic batch, contact our support desk.</p>
<p>Warm regards,<br><strong>Modern Orthodontics Logistics</strong></p>`,
    tags: ["customer_name", "order_number", "carrier_name", "tracking_number", "company_name"],
  },
  {
    type: "ORDER_CANCELLED",
    title: "Order Cancelled",
    category: "Orders & Sales",
    description: "Sent when an order is cancelled or refunded by customer request or admin action.",
    defaultSubject: "Order #{{order_number}} Cancellation Update - Modern Orthodontics",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>This email is to confirm that your order <strong>#{{order_number}}</strong> has been cancelled.</p>
<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Cancelled Order:</strong> #{{order_number}}</p>
  <p style="margin: 0;"><strong>Status:</strong> Cancelled / Refunded</p>
</div>
<p>If any payment was already processed, the refund will be credited to your original account within 3-5 business days.</p>
<p>Sincerely,<br><strong>Modern Orthodontics Support Team</strong></p>`,
    tags: ["customer_name", "order_number", "order_total", "currency", "company_name"],
  },
  {
    type: "PAYMENT_SUCCESS",
    title: "Payment Receipt",
    category: "Billing & Invoices",
    description: "Sent after payment is confirmed via payment gateway, wire transfer, or credit line approval.",
    defaultSubject: "Payment Receipt for Order #{{order_number}}",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>We have successfully processed your payment for order <strong>#{{order_number}}</strong>.</p>
<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Order ID:</strong> #{{order_number}}</p>
  <p style="margin: 0 0 8px 0;"><strong>Amount Paid:</strong> {{currency}} {{order_total}}</p>
  <p style="margin: 0;"><strong>Payment Status:</strong> <span style="color: #16a34a; font-weight: bold;">{{payment_status}}</span></p>
</div>
<p>Official tax invoices and export documentation can be downloaded anytime from your account dashboard.</p>
<p>Thank you,<br><strong>Modern Orthodontics Accounts</strong></p>`,
    tags: ["customer_name", "order_number", "order_total", "currency", "payment_status", "company_name"],
  },
  {
    type: "INQUIRY_RECEIVED",
    title: "Inquiry & RFQ Confirmation",
    category: "Quotations & RFQ",
    description: "Sent to prospective or existing clients when they submit an RFQ or contact request.",
    defaultSubject: "We received your inquiry - Modern Orthodontics",
    defaultBody: `<p>Hello <strong>{{customer_name}}</strong>,</p>
<p>Thank you for contacting Modern Orthodontics. We have received your inquiry / quotation request.</p>
<p>One of our product specialists will review your requirements and get back to you with custom pricing and technical specifications within 1 business day.</p>
<p>Best regards,<br><strong>Modern Orthodontics Sales Team</strong></p>`,
    tags: ["customer_name", "email", "phone", "company_name"],
  },
  {
    type: "QUOTE_PROPOSAL_SENT",
    title: "Quote Proposal Ready",
    category: "Quotations & RFQ",
    description: "Sent when sales team creates and delivers an official custom price quotation.",
    defaultSubject: "Your Quote Proposal #{{quote_number}} is Ready - Modern Orthodontics",
    defaultBody: `<p>Dear <strong>{{customer_name}}</strong>,</p>
<p>Our sales team has reviewed your quotation request and prepared a formal price proposal for your clinic.</p>
<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 16px 0;">
  <p style="margin: 0 0 8px 0;"><strong>Quotation Reference:</strong> #{{quote_number}}</p>
  <p style="margin: 0 0 8px 0;"><strong>Estimated Total:</strong> {{currency}} {{quote_total}}</p>
  <p style="margin: 0;"><strong>Validity:</strong> 15 Days</p>
</div>
<p>You can review line items, approve the quote, or request amendments directly in your customer dashboard.</p>
<p>Best regards,<br><strong>Modern Orthodontics Sales Team</strong></p>`,
    tags: ["customer_name", "quote_number", "quote_total", "currency", "company_name"],
  },
  {
    type: "NEWSLETTER_WELCOME",
    title: "Newsletter Welcome",
    category: "Marketing & Updates",
    description: "Sent when a doctor or visitor subscribes to receive product updates and clinical releases.",
    defaultSubject: "Welcome to Modern Orthodontics Insights",
    defaultBody: `<p>Hello <strong>{{customer_name}}</strong>,</p>
<p>Thank you for subscribing to the Modern Orthodontics newsletter.</p>
<p>You'll now receive regular updates on precision archwires, bracket innovations, clinical case studies, and exclusive B2B offers.</p>
<p>Best regards,<br><strong>Modern Orthodontics Team</strong></p>`,
    tags: ["customer_name", "email", "company_name"],
  },
  {
    type: "LOW_STOCK",
    title: "Low Stock Alert (Admin)",
    category: "Inventory Alerts",
    description: "Sent to admin staff when product variant inventory drops below the safety threshold.",
    defaultSubject: "Low Inventory Warning - Modern Orthodontics",
    defaultBody: `<p>Attention <strong>Inventory Team</strong>,</p>
<p>One or more SKU inventory counts have fallen below the configured safety threshold.</p>
<p>Please log in to the admin inventory dashboard to inspect pending demand and replenish safety stock.</p>
<p>System notification,<br><strong>Modern Orthodontics ERP</strong></p>`,
    tags: ["customer_name", "company_name"],
  },
];

// ─── Default Master Email Header / Footer ──────────────────────────────────
const DEFAULT_BRAND_HEADER = `<div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
  <div style="background-color: #1a1a1a; padding: 24px; text-align: center; border-bottom: 3px solid #b5151b;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0.5px;">Modern Orthodontics</h1>
  </div>
  <div style="padding: 32px 24px; background-color: #ffffff; color: #374151; line-height: 1.65; font-size: 14.5px;">`;

const DEFAULT_BRAND_FOOTER = `  </div>
  <div style="background-color: #f9fafb; padding: 20px 24px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #6b7280;">
    <p style="margin: 0 0 6px 0; font-weight: 600; color: #374151;">Modern Orthodontics &bull; Precision Manufacturing</p>
    <p style="margin: 0 0 8px 0;">ISO 13485 &amp; CE Certified Orthodontic Appliances</p>
    <p style="margin: 0;">Need support? Email us at <a href="mailto:support@modortho.com" style="color: #b5151b; text-decoration: none; font-weight: 500;">support@modortho.com</a></p>
  </div>
</div>`;

export function EmailSettingsStudio({ embedded = false }: { embedded?: boolean }) {
  const { showToast } = useToast();

  // Tab State
  const [activeTab, setActiveTab] = useState<"settings" | "templates">("settings");

  // Settings Data
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  // Countries Data for Multi-Country Routing
  const { data: countries = [] } = useAdminCountries();
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("");

  // Test Email Modal State
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testModalProvider, setTestModalProvider] = useState<string>("smtp");
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [sendingTestEmail, setSendingTestEmail] = useState(false);

  // Gateway Config Modal State
  const [gatewayModalOpen, setGatewayModalOpen] = useState(false);
  const [activeGatewayKey, setActiveGatewayKey] = useState<"smtp" | "msg91" | "system">("smtp");
  const [showPassword, setShowPassword] = useState(false);

  // Notification Configs & Templates Data
  const { data: configs = [] } = useNotificationConfigs();
  const updateConfigMutation = useUpdateNotificationConfig();
  const { data: templates = [] } = useNotificationTemplates();
  const updateTemplateMutation = useUpdateNotificationTemplate();
  const { data: managerSettings } = useNotificationManagerSettings();

  // Expanded Accordion State
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({
    USER_ONBOARDED: true,
  });

  // Local draft states for templates being edited
  const [templateDrafts, setTemplateDrafts] = useState<
    Record<string, { subject: string; message: string; activeTab: "visual" | "html" }>
  >({});

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ title: string; subject: string; html: string }>({
    title: "",
    subject: "",
    html: "",
  });

  // Active cursor/selection tracking for tag insertion
  const activeInputRef = useRef<{ eventType: string; field: "subject" | "message"; element: HTMLInputElement | HTMLTextAreaElement | null }>({
    eventType: "",
    field: "message",
    element: null,
  });

  // Load Settings from API
  const loadSettings = async () => {
    try {
      setLoadingSettings(true);
      const res = await adminApi.get("/settings?group=email");
      const rows = res.data?.data || [];
      const map: Record<string, string> = {};
      rows.forEach((s: any) => {
        map[s.key] = s.value === "***" ? "" : s.value;
      });
      setSettings(map);
    } catch (err) {
      showToast("Failed to load email gateway settings.", "error");
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
      const initial: Record<string, { subject: string; message: string; activeTab: "visual" | "html" }> = {};
      EMAIL_EVENTS.forEach((event) => {
        const found = templates.find(
          (t: any) => t.type?.toUpperCase() === event.type && t.channel?.toLowerCase() === "email"
        );
        initial[event.type] = {
          subject: found?.subject ?? event.defaultSubject,
          message: found?.message ?? event.defaultBody,
          activeTab: "visual",
        };
      });
      setTemplateDrafts(initial);
    } else {
      const initial: Record<string, { subject: string; message: string; activeTab: "visual" | "html" }> = {};
      EMAIL_EVENTS.forEach((event) => {
        initial[event.type] = {
          subject: event.defaultSubject,
          message: event.defaultBody,
          activeTab: "visual",
        };
      });
      setTemplateDrafts(initial);
    }
  }, [templates]);

  // Set default selected country
  useEffect(() => {
    if (countries.length > 0 && !selectedCountryCode) {
      setSelectedCountryCode(countries[0].code);
    }
  }, [countries, selectedCountryCode]);

  // Helper getters
  const g = (key: string) => settings[key] || "";
  const setField = (key: string, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  // Save Settings
  const saveEmailSettings = async () => {
    try {
      setSavingSettings(true);
      const payload = Object.entries(settings).map(([key, value]) => ({
        key,
        value,
        group: "email",
      }));
      await adminApi.put("/settings", { settings: payload });
      showToast("Email gateway & routing settings updated successfully.", "success");
      setGatewayModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update email settings."), "error");
    } finally {
      setSavingSettings(false);
    }
  };

  // Trigger Test Email
  const handleSendTestEmail = async () => {
    if (!testRecipientEmail || !testRecipientEmail.includes("@")) {
      showToast("Please enter a valid recipient email address.", "error");
      return;
    }
    try {
      setSendingTestEmail(true);
      const res = await adminApi.post("/settings/test-email", {
        toEmail: testRecipientEmail.trim(),
        provider: testModalProvider,
      });
      showToast(res.data?.message || `Test email dispatched successfully to ${testRecipientEmail}!`, "success");
      setTestModalOpen(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to dispatch test email."), "error");
    } finally {
      setSendingTestEmail(false);
    }
  };

  // Toggle Event Email Enabled
  const handleToggleEventChannel = async (eventType: string, currentEnabled: boolean) => {
    const config = configs.find((c: any) => c.type === eventType);
    if (!config) {
      showToast("Notification rule not found.", "error");
      return;
    }
    try {
      const updatedChannels = {
        ...(config.channels || {}),
        email: !currentEnabled,
      };
      await updateConfigMutation.mutateAsync({
        id: config.id,
        data: { channels: updatedChannels },
      });
      showToast(`${eventType} email notification ${!currentEnabled ? "enabled" : "disabled"}.`, "success");
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
        channel: "email",
        data: {
          subject: draft.subject,
          message: draft.message,
          role: "GLOBAL",
        },
      });
      showToast("Email template saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save template.", "error");
    }
  };

  // Reset to Default Template
  const handleResetToDefault = (event: (typeof EMAIL_EVENTS)[0]) => {
    if (confirm(`Reset "${event.title}" template back to factory defaults?`)) {
      setTemplateDrafts((prev) => ({
        ...prev,
        [event.type]: {
          subject: event.defaultSubject,
          message: event.defaultBody,
          activeTab: prev[event.type]?.activeTab || "visual",
        },
      }));
      showToast("Template reset to factory defaults. Click Save to persist.", "info");
    }
  };

  // Tag Insertion at cursor
  const handleInsertTag = (eventType: string, tag: string) => {
    const tagText = `{{${tag}}}`;
    const draft = templateDrafts[eventType] || { subject: "", message: "", activeTab: "visual" };

    if (activeInputRef.current.eventType === eventType && activeInputRef.current.field === "subject") {
      const inputEl = activeInputRef.current.element as HTMLInputElement;
      if (inputEl) {
        const start = inputEl.selectionStart || draft.subject.length;
        const end = inputEl.selectionEnd || draft.subject.length;
        const newSubject = draft.subject.substring(0, start) + tagText + draft.subject.substring(end);
        setTemplateDrafts((prev) => ({
          ...prev,
          [eventType]: { ...draft, subject: newSubject },
        }));
        setTimeout(() => {
          inputEl.focus();
          inputEl.setSelectionRange(start + tagText.length, start + tagText.length);
        }, 10);
        return;
      }
    }

    const textareaEl = activeInputRef.current.element as HTMLTextAreaElement;
    if (textareaEl && activeInputRef.current.eventType === eventType && activeInputRef.current.field === "message") {
      const start = textareaEl.selectionStart || draft.message.length;
      const end = textareaEl.selectionEnd || draft.message.length;
      const newMessage = draft.message.substring(0, start) + tagText + draft.message.substring(end);
      setTemplateDrafts((prev) => ({
        ...prev,
        [eventType]: { ...draft, message: newMessage },
      }));
      setTimeout(() => {
        textareaEl.focus();
        textareaEl.setSelectionRange(start + tagText.length, start + tagText.length);
      }, 10);
    } else {
      setTemplateDrafts((prev) => ({
        ...prev,
        [eventType]: { ...draft, message: draft.message + " " + tagText },
      }));
    }
    showToast(`Tag ${tagText} inserted.`, "info");
  };

  // Open Live Preview Modal
  const handleOpenPreview = (event: (typeof EMAIL_EVENTS)[0]) => {
    const draft = templateDrafts[event.type] || { subject: event.defaultSubject, message: event.defaultBody };
    
    let compiledSubject = draft.subject;
    let compiledBody = draft.message;

    Object.entries(SAMPLE_MOCK_DATA).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
      compiledSubject = compiledSubject.replace(regex, value);
      compiledBody = compiledBody.replace(regex, value);
    });

    const header = managerSettings?.emailLayouts?.headerHtml || DEFAULT_BRAND_HEADER;
    const footer = managerSettings?.emailLayouts?.footerHtml || DEFAULT_BRAND_FOOTER;

    const fullHtml = `${header}\n${compiledBody}\n${footer}`;

    setPreviewData({
      title: event.title,
      subject: compiledSubject,
      html: fullHtml,
    });
    setPreviewModalOpen(true);
  };

  const isSmtpConnected = Boolean(g("email.smtp_host") && g("email.smtp_user"));
  const isMsg91Connected = Boolean(g("email.msg91_auth_key") || g("email.msg91_enabled") === "true");
  const currentProvider = g("email.provider") || "msg91";

  // Selected Country object
  const currentCountryCode = (selectedCountryCode || countries[0]?.code || "").toUpperCase();
  const isSelectedCountryEnabled = g(`email.country.${currentCountryCode}.enabled`) !== "false";
  const selectedCountryObj = countries.find((c: any) => c.code.toUpperCase() === currentCountryCode);

  return (
    <div className="space-y-6 pb-6">
      {/* ─── Tabs Header (DreamsPOS Sub-nav) ────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Mail className="h-5 w-5 text-[#E31E24]" />
            Email Management Studio
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure gateways (MSG91, SMTP, System Mailer), dedicated purpose senders, multi-country delivery, and customize dynamic HTML email templates.
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
            Email Settings
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
            Email Templates
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1: EMAIL SETTINGS (GATEWAYS + SENDER MAPPINGS + COUNTRIES)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "settings" && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Section 1: Gateways */}
          <div>
            <h3 className="text-sm font-bold text-gray-900">Email Gateway Integrations</h3>
            <p className="text-xs text-gray-500">
              Active primary gateway: <span className="font-semibold text-gray-800 uppercase">{currentProvider}</span>
            </p>
          </div>

          {/* Gateway Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. MSG91 Cloud Email API (Primary Default) */}
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
                  <h4 className="text-sm font-bold text-gray-900">MSG91 Send API</h4>
                  <span className="inline-flex items-center rounded-sm bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 border border-blue-200">
                    Default
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Cloud transactional email API with real-time webhooks, high inbox delivery rates, and analytics.
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
                    Configure API
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestModalProvider("msg91");
                      setTestModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    Test Email
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-gray-500">
                    {currentProvider === "msg91" ? "Primary Gateway" : "Set Primary"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("email.provider", "msg91");
                      saveEmailSettings();
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

            {/* 2. Custom SMTP Server */}
            <div
              className={cn(
                "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
                currentProvider === "smtp" ? "border-green-500 ring-1 ring-green-500/20" : "border-gray-200"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                    <Server className="h-5 w-5" />
                  </div>
                  {isSmtpConnected ? (
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

                <h4 className="text-sm font-bold text-gray-900">Custom SMTP</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Standard SMTP protocol using Google Workspace, Microsoft 365, or your company's dedicated mail server.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGatewayKey("smtp");
                      setGatewayModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#E31E24] hover:underline cursor-pointer"
                  >
                    <Settings className="h-3.5 w-3.5" />
                    Configure SMTP
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTestModalProvider("smtp");
                      setTestModalOpen(true);
                    }}
                    className="inline-flex items-center gap-1 rounded bg-gray-50 hover:bg-gray-100 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 cursor-pointer"
                  >
                    <Send className="h-3 w-3" />
                    Test Email
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-medium text-gray-500">
                    {currentProvider === "smtp" ? "Primary Gateway" : "Set Primary"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("email.provider", "smtp");
                      saveEmailSettings();
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      currentProvider === "smtp" ? "bg-emerald-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        currentProvider === "smtp" ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* 3. PHP Mailer / Nodemailer System */}
            <div
              className={cn(
                "relative rounded-xl border bg-white p-5 shadow-xs transition-all flex flex-col justify-between",
                currentProvider === "system" ? "border-green-500 ring-1 ring-green-500/20" : "border-gray-200"
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="h-11 w-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                    <Mail className="h-5 w-5" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3" />
                    Connected
                  </span>
                </div>

                <h4 className="text-sm font-bold text-gray-900">System Mailer</h4>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Direct local sendmail transport via Node.js server engine. Recommended for local/staging testing.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setActiveGatewayKey("system");
                    setGatewayModalOpen(true);
                  }}
                  className="text-xs font-semibold text-gray-600 hover:text-gray-900 underline cursor-pointer"
                >
                  View Details
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">
                    {currentProvider === "system" ? "Primary Gateway" : "Set Primary"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setField("email.provider", "system");
                      saveEmailSettings();
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      currentProvider === "system" ? "bg-emerald-600" : "bg-gray-200"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        currentProvider === "system" ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Global Sender Defaults */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs">
            <h4 className="text-sm font-bold text-gray-900 mb-1">Global Default Sender Address</h4>
            <p className="text-xs text-gray-500 mb-4">
              Default fallback address applied across customer emails when no specific purpose or country sender is configured.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <AdminInput
                label="Default From Name"
                placeholder="Modern Orthodontics"
                value={g("email.from_name")}
                onChange={(e) => setField("email.from_name", e.target.value)}
              />
              <AdminInput
                label="Default From Email"
                placeholder="orders@modortho.com"
                value={g("email.from_email")}
                onChange={(e) => setField("email.from_email", e.target.value)}
              />
              <AdminInput
                label="Admin Notification Copy (BCC / CC)"
                placeholder="admin-alerts@modortho.com"
                value={g("email.notify_email")}
                onChange={(e) => setField("email.notify_email", e.target.value)}
              />
            </div>
          </div>

          {/* Section 3: Event & Purpose-Specific Email Senders */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
            <div className="border-b border-gray-100 pb-3">
              <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#E31E24]" />
                Event &amp; Purpose-Specific Sender Mapping
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Define distinct sender names and email addresses for specific notification types (e.g. passwords from auth@, invoices from orders@, proposals from quotes@).
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 1. Auth & Password Reset */}
              <div className="rounded-lg border border-amber-200 bg-amber-50/30 p-4 space-y-3">
                <div className="text-xs font-bold text-amber-900 flex items-center gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-700" />
                  Forgot Password &amp; Authentication Emails
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AdminInput
                    label="Sender Name"
                    placeholder="Modern Orthodontics Security"
                    value={g("email.events.auth.from_name")}
                    onChange={(e) => setField("email.events.auth.from_name", e.target.value)}
                  />
                  <AdminInput
                    label="Sender Email Address"
                    placeholder="auth@modortho.com"
                    value={g("email.events.auth.from_email")}
                    onChange={(e) => setField("email.events.auth.from_email", e.target.value)}
                  />
                </div>
              </div>

              {/* 2. Orders & Invoices */}
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
                <div className="text-xs font-bold text-emerald-900 flex items-center gap-2">
                  <Package className="h-3.5 w-3.5 text-emerald-700" />
                  Orders, Invoices &amp; Tracking Emails
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AdminInput
                    label="Sender Name"
                    placeholder="Modern Orthodontics Orders"
                    value={g("email.events.orders.from_name")}
                    onChange={(e) => setField("email.events.orders.from_name", e.target.value)}
                  />
                  <AdminInput
                    label="Sender Email Address"
                    placeholder="orders@modortho.com"
                    value={g("email.events.orders.from_email")}
                    onChange={(e) => setField("email.events.orders.from_email", e.target.value)}
                  />
                </div>
              </div>

              {/* 3. Quotes & RFQ */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4 space-y-3">
                <div className="text-xs font-bold text-blue-900 flex items-center gap-2">
                  <MessageSquareQuote className="h-3.5 w-3.5 text-blue-700" />
                  Quotes &amp; RFQ Proposals
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AdminInput
                    label="Sender Name"
                    placeholder="Modern Orthodontics Quotes"
                    value={g("email.events.quotes.from_name")}
                    onChange={(e) => setField("email.events.quotes.from_name", e.target.value)}
                  />
                  <AdminInput
                    label="Sender Email Address"
                    placeholder="quotes@modortho.com"
                    value={g("email.events.quotes.from_email")}
                    onChange={(e) => setField("email.events.quotes.from_email", e.target.value)}
                  />
                </div>
              </div>

              {/* 4. Support & Inquiries */}
              <div className="rounded-lg border border-indigo-200 bg-indigo-50/30 p-4 space-y-3">
                <div className="text-xs font-bold text-indigo-900 flex items-center gap-2">
                  <Headphones className="h-3.5 w-3.5 text-indigo-700" />
                  Customer Support &amp; Contact Inquiries
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AdminInput
                    label="Sender Name"
                    placeholder="Modern Orthodontics Support"
                    value={g("email.events.support.from_name")}
                    onChange={(e) => setField("email.events.support.from_name", e.target.value)}
                  />
                  <AdminInput
                    label="Sender Email Address"
                    placeholder="support@modortho.com"
                    value={g("email.events.support.from_email")}
                    onChange={(e) => setField("email.events.support.from_email", e.target.value)}
                  />
                </div>
              </div>

              {/* 5. Newsletter */}
              <div className="rounded-lg border border-purple-200 bg-purple-50/30 p-4 space-y-3 lg:col-span-2">
                <div className="text-xs font-bold text-purple-900 flex items-center gap-2">
                  <Newspaper className="h-3.5 w-3.5 text-purple-700" />
                  Newsletter &amp; Product Announcements
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <AdminInput
                    label="Sender Name"
                    placeholder="Modern Orthodontics Updates"
                    value={g("email.events.newsletter.from_name")}
                    onChange={(e) => setField("email.events.newsletter.from_name", e.target.value)}
                  />
                  <AdminInput
                    label="Sender Email Address"
                    placeholder="newsletter@modortho.com"
                    value={g("email.events.newsletter.from_email")}
                    onChange={(e) => setField("email.events.newsletter.from_email", e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Country-Specific Email Delivery & Routing */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Country-Specific Email Delivery &amp; Routing
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Enable or disable outgoing transactional emails per country, or define dedicated regional senders.
                </p>
              </div>

              {/* Master Global Routing Switch */}
              <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2 shrink-0">
                <div className="text-right">
                  <div className="text-xs font-bold text-gray-800">Master Country Routing:</div>
                  <div className="text-[11px] text-gray-500">
                    {g("email.country_routing_enabled") !== "false" ? "Active globally" : "Disabled globally"}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setField(
                      "email.country_routing_enabled",
                      g("email.country_routing_enabled") === "false" ? "true" : "false"
                    )
                  }
                  className={cn(
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                    g("email.country_routing_enabled") !== "false" ? "bg-emerald-600" : "bg-gray-200"
                  )}
                >
                  <span
                    className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      g("email.country_routing_enabled") !== "false" ? "translate-x-4" : "translate-x-0"
                    )}
                  />
                </button>
              </div>
            </div>

            {/* Country Selector & Card */}
            {countries.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
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

                {/* Country Config Card */}
                <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4.5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-200 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900">
                          {selectedCountryObj?.name || currentCountryCode} ({currentCountryCode})
                        </span>
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2 py-0.5 rounded-md",
                            isSelectedCountryEnabled
                              ? "text-emerald-700 bg-emerald-50 border border-emerald-200"
                              : "text-gray-500 bg-gray-200"
                          )}
                        >
                          {isSelectedCountryEnabled ? "● Country Email Active" : "✕ Disabled for this Country"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isSelectedCountryEnabled
                          ? `Clinics and customers in ${selectedCountryObj?.name || currentCountryCode} will receive automated emails.`
                          : `Outgoing emails to ${selectedCountryObj?.name || currentCountryCode} are currently paused.`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-xs shrink-0">
                      <span className="text-xs font-semibold text-gray-800">Enable for {currentCountryCode}:</span>
                      <button
                        type="button"
                        onClick={() =>
                          setField(
                            `email.country.${currentCountryCode}.enabled`,
                            isSelectedCountryEnabled ? "false" : "true"
                          )
                        }
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          isSelectedCountryEnabled ? "bg-emerald-600" : "bg-gray-200"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            isSelectedCountryEnabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Optional Country Sender Override */}
                  <div className="space-y-3 pt-1">
                    <div className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                      Regional Sender Override{" "}
                      <span className="text-[11px] font-normal text-gray-500 lowercase">
                        (optional — leave blank to use global event senders)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <AdminInput
                        label={`From Name (${currentCountryCode})`}
                        placeholder={`Modern Orthodontics ${currentCountryCode}`}
                        value={g(`email.country.${currentCountryCode}.from_name`)}
                        onChange={(e) => setField(`email.country.${currentCountryCode}.from_name`, e.target.value)}
                      />
                      <AdminInput
                        label={`From Email (${currentCountryCode})`}
                        placeholder={`orders-${currentCountryCode.toLowerCase()}@modortho.com`}
                        type="email"
                        value={g(`email.country.${currentCountryCode}.from_email`)}
                        onChange={(e) => setField(`email.country.${currentCountryCode}.from_email`, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-500">Loading active countries...</div>
            )}
          </div>

          {/* Sticky/Bottom Save All Settings Button */}
          <div className="flex justify-end pt-2">
            <LoadingButton
              loading={savingSettings}
              onClick={saveEmailSettings}
              className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-6 py-2.5 text-sm font-bold rounded-lg shadow-sm"
            >
              <Save className="h-4 w-4 mr-2" />
              Save All Email Settings &amp; Routing
            </LoadingButton>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2: EMAIL TEMPLATES (ACCORDION STUDIO)
         ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "templates" && (
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Email Templates Studio</h3>
              <p className="text-xs text-gray-500">
                Expand each notification event below to customize email subjects, HTML bodies, and dynamic tags.
              </p>
            </div>
          </div>

          {/* Accordion List */}
          <div className="space-y-4">
            {EMAIL_EVENTS.map((event) => {
              const isExpanded = Boolean(expandedEvents[event.type]);
              const config = configs.find((c: any) => c.type === event.type);
              const isEnabled = config?.channels?.email !== false;
              const draft = templateDrafts[event.type] || {
                subject: event.defaultSubject,
                message: event.defaultBody,
                activeTab: "visual",
              };

              return (
                <div
                  key={event.type}
                  className="rounded-xl border border-gray-200 bg-white shadow-xs overflow-hidden transition-all"
                >
                  {/* Accordion Header */}
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
                      <div className="h-10 w-10 rounded-lg bg-red-50 text-[#E31E24] flex items-center justify-center shrink-0">
                        <Mail className="h-5 w-5" />
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
                          title="Toggle email notification on/off"
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
                      {/* Subject Input */}
                      <div className="bg-white p-4 rounded-lg border border-gray-200">
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                          Email Subject Line
                        </label>
                        <input
                          type="text"
                          value={draft.subject}
                          onFocus={(e) => {
                            activeInputRef.current = {
                              eventType: event.type,
                              field: "subject",
                              element: e.target,
                            };
                          }}
                          onChange={(e) =>
                            setTemplateDrafts((prev) => ({
                              ...prev,
                              [event.type]: { ...draft, subject: e.target.value },
                            }))
                          }
                          placeholder="Enter email subject line..."
                          className="w-full rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-900 shadow-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                        />
                      </div>

                      {/* 2-Column Split: Left Editor + Right Tag Palette */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                        {/* Left Column (8 cols): Editor */}
                        <div className="lg:col-span-8 bg-white rounded-lg border border-gray-200 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between border-b border-gray-200 pb-3 mb-3">
                              <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                                Email Body (HTML / Rich Text)
                              </label>
                              <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTemplateDrafts((prev) => ({
                                      ...prev,
                                      [event.type]: { ...draft, activeTab: "visual" },
                                    }))
                                  }
                                  className={cn(
                                    "px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer",
                                    draft.activeTab === "visual"
                                      ? "bg-white text-gray-900 shadow-2xs font-semibold"
                                      : "text-gray-600 hover:text-gray-900"
                                  )}
                                >
                                  <Type className="h-3.5 w-3.5" />
                                  Text Mode
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setTemplateDrafts((prev) => ({
                                      ...prev,
                                      [event.type]: { ...draft, activeTab: "html" },
                                    }))
                                  }
                                  className={cn(
                                    "px-2.5 py-1 rounded transition-colors flex items-center gap-1 cursor-pointer",
                                    draft.activeTab === "html"
                                      ? "bg-white text-gray-900 shadow-2xs font-semibold"
                                      : "text-gray-600 hover:text-gray-900"
                                  )}
                                >
                                  <Code2 className="h-3.5 w-3.5" />
                                  HTML Source
                                </button>
                              </div>
                            </div>

                            <textarea
                              rows={10}
                              value={draft.message}
                              onFocus={(e) => {
                                activeInputRef.current = {
                                  eventType: event.type,
                                  field: "message",
                                  element: e.target,
                                };
                              }}
                              onChange={(e) =>
                                setTemplateDrafts((prev) => ({
                                  ...prev,
                                  [event.type]: { ...draft, message: e.target.value },
                                }))
                              }
                              placeholder="Write email body content..."
                              className="w-full font-mono text-xs text-gray-900 rounded-md border border-gray-300 p-3 leading-relaxed focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                            />
                          </div>

                          <p className="text-[11px] text-gray-400 mt-2 flex items-center gap-1">
                            <Info className="h-3.5 w-3.5" />
                            HTML tags and styling are preserved and rendered inside the standard Modern Orthodontics header/footer.
                          </p>
                        </div>

                        {/* Right Column (4 cols): Tags Palette */}
                        <div className="lg:col-span-4 bg-white rounded-lg border border-gray-200 p-4 flex flex-col">
                          <div className="flex items-center gap-2 text-xs font-bold text-gray-800 uppercase tracking-wider mb-1">
                            <Sparkles className="h-4 w-4 text-[#E31E24]" />
                            Available &#123;Tags&#125;
                          </div>
                          <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                            Click any tag to insert it into the subject or email body at your cursor position:
                          </p>

                          <div className="flex flex-wrap gap-1.5 overflow-y-auto max-h-60 pr-1">
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

                          <div className="mt-auto pt-4 border-t border-gray-100 text-[11px] text-gray-500">
                            Sample: <span className="font-semibold text-gray-700">&#123;customer_name&#125;</span> &rarr;{" "}
                            <span className="italic">{SAMPLE_MOCK_DATA.customer_name}</span>
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
                            Preview Template
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
          MODAL: CONFIGURE GATEWAY INTEGRATION
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
                    {activeGatewayKey === "smtp" && "Custom SMTP Configuration"}
                    {activeGatewayKey === "msg91" && "MSG91 Email API Configuration"}
                    {activeGatewayKey === "system" && "System Mailer Transport"}
                  </h3>
                  <p className="text-xs text-gray-500">Provide server credentials to enable live dispatch</p>
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

            {activeGatewayKey === "smtp" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <AdminInput
                      label="SMTP Host / Server"
                      placeholder="smtp.gmail.com or mail.modortho.com"
                      value={g("email.smtp_host")}
                      onChange={(e) => setField("email.smtp_host", e.target.value)}
                    />
                  </div>
                  <div>
                    <AdminInput
                      label="Port"
                      placeholder="587 / 465"
                      value={g("email.smtp_port")}
                      onChange={(e) => setField("email.smtp_port", e.target.value)}
                    />
                  </div>
                </div>

                <AdminInput
                  label="SMTP Username / Email"
                  placeholder="user@modortho.com"
                  value={g("email.smtp_user")}
                  onChange={(e) => setField("email.smtp_user", e.target.value)}
                />

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    SMTP Password / App Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={g("email.smtp_password")}
                      onChange={(e) => setField("email.smtp_password", e.target.value)}
                      placeholder="Enter password..."
                      className="w-full rounded-md border border-gray-300 px-3.5 py-2 pr-10 text-sm font-medium text-gray-900 shadow-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="smtpSecure"
                    checked={g("email.smtp_secure") === "true"}
                    onChange={(e) => setField("email.smtp_secure", e.target.checked ? "true" : "false")}
                    className="rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                  />
                  <label htmlFor="smtpSecure" className="text-xs font-medium text-gray-700 cursor-pointer">
                    Use SSL/TLS encryption (Port 465). Uncheck for STARTTLS (Port 587).
                  </label>
                </div>
              </div>
            )}

            {activeGatewayKey === "msg91" && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    MSG91 AuthKey (Secret)
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={g("email.msg91_auth_key")}
                      onChange={(e) => setField("email.msg91_auth_key", e.target.value)}
                      placeholder="Enter MSG91 AuthKey..."
                      className="w-full rounded-md border border-gray-300 px-3.5 py-2 pr-10 text-sm font-medium text-gray-900 shadow-xs focus:border-[#E31E24] focus:outline-none focus:ring-1 focus:ring-[#E31E24]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <AdminInput
                  label="Verified Domain / Subdomain"
                  placeholder="mail.apricotequipment.in"
                  value={g("email.msg91_domain")}
                  onChange={(e) => setField("email.msg91_domain", e.target.value)}
                />
              </div>
            )}

            {activeGatewayKey === "system" && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 leading-relaxed">
                System Mailer utilizes your hosting server's default sendmail binary or direct local SMTP daemon. No external credentials required.
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
                onClick={saveEmailSettings}
                className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-5 py-2 text-xs font-bold rounded-lg"
              >
                Save Integration
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: SEND TEST EMAIL
         ════════════════════════════════════════════════════════════════════ */}
      {testModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Send className="h-5 w-5 text-[#E31E24]" />
                <h3 className="text-base font-bold text-gray-900">Send Test Email</h3>
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
              Verify that your configured <span className="font-bold uppercase text-gray-800">{testModalProvider}</span> gateway can successfully deliver mail to an inbox.
            </p>

            <div className="space-y-3">
              <AdminInput
                label="Recipient Email Address"
                placeholder="your.email@example.com"
                type="email"
                value={testRecipientEmail}
                onChange={(e) => setTestRecipientEmail(e.target.value)}
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
                loading={sendingTestEmail}
                onClick={handleSendTestEmail}
                className="bg-[#E31E24] hover:bg-[#b5151b] text-white px-4 py-2 text-xs font-bold rounded-lg"
              >
                <Send className="h-3.5 w-3.5 mr-1" />
                Dispatch Test
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODAL: TEMPLATE LIVE PREVIEW
         ════════════════════════════════════════════════════════════════════ */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Preview Modal Header */}
            <div className="p-4 sm:px-6 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  Preview: {previewData.title}
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Subject: <span className="font-semibold text-gray-800">{previewData.subject}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Rendered HTML Container */}
            <div className="p-6 overflow-y-auto flex-1 bg-gray-100 flex justify-center">
              <div
                className="w-full max-w-[620px] bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                dangerouslySetInnerHTML={{ __html: previewData.html }}
              />
            </div>

            {/* Preview Footer */}
            <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="rounded-lg bg-gray-900 text-white px-5 py-2 text-xs font-bold hover:bg-black transition-colors cursor-pointer"
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
