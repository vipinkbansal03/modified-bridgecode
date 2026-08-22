"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  useNotificationTemplates,
  useApprovedWhatsAppTemplates,
  useUpdateNotificationTemplate,
  useNotificationConfigs,
  useNotificationRolesList
} from "@/hooks/api";
import {
  AdminSelect,
  AdminInput,
  AdminTextarea
} from "@/components/admin/AdminComponents";
import { Mail, MessageSquare, Smartphone, Bell, Save, CheckCircle, Eye, RefreshCw, Info } from "lucide-react";
import { apiClient } from "@/lib/apiClient";

const CHANNELS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: Smartphone },
  { value: "push", label: "Push", icon: Bell },
];

const PREVIEW_MOCKS: Record<string, string> = {
  customer_name: "Dr. John Doe",
  email: "dentist@clinic.com",
  phone: "+91 98765 43210",
  order_number: "ORD-2026-8942",
  currency: "INR",
  order_total: "42,500.00",
  carrier_name: "DHL Express",
  tracking_number: "DHL-984251029",
  tracking_url: "https://dhl.com/track/DHL-984251029",
  payment_status: "SUCCESSFUL",
};

export default function TemplateManagerPage() {
  const { data: templates = [], isLoading: isLoadingTemplates } = useNotificationTemplates();
  const { data: approvedWhatsApp = [], isLoading: isLoadingWhatsApp } = useApprovedWhatsAppTemplates();
  const { data: configs = [] } = useNotificationConfigs();
  const { data: roles = [], isLoading: isLoadingRoles } = useNotificationRolesList();
  const updateTemplateMutation = useUpdateNotificationTemplate();

  const [activeTab, setActiveTab] = useState<"templates" | "email-layouts">("templates");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterChannel, setFilterChannel] = useState<string>("all");
  
  const [selectedRole, setSelectedRole] = useState("GLOBAL");
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null);

  // Edit fields
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [variables, setVariables] = useState("");
  const [whatsappTemplateId, setWhatsappTemplateId] = useState("");

  // Email layout editor fields
  const [headerHtml, setHeaderHtml] = useState("");
  const [footerHtml, setFooterHtml] = useState("");
  const [savingLayout, setSavingLayout] = useState(false);

  const [useHtmlMode, setUseHtmlMode] = useState(false);
  const [headerTitle, setHeaderTitle] = useState("Modern Orthodontics");
  const [headerBg, setHeaderBg] = useState("#1a1a1a");
  const [headerTextColor, setHeaderTextColor] = useState("#ffffff");
  const [footerText, setFooterText] = useState("Modern Orthodontics B2B Platform");
  const [footerBg, setFooterBg] = useState("#f9f9f9");
  const [footerTextColor, setFooterTextColor] = useState("#6b6b6b");

  const [successMessage, setSuccessMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const parseLayout = (header: string, footer: string) => {
    let hTitle = "Modern Orthodontics";
    let hBg = "#1a1a1a";
    let hTextColor = "#ffffff";
    let fText = "Modern Orthodontics B2B Platform";
    let fBg = "#f9f9f9";
    let fTextColor = "#6b6b6b";

    try {
      const titleMatch = header.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (titleMatch) hTitle = titleMatch[1].trim();

      const textColMatch = header.match(/color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+)/i);
      if (textColMatch) hTextColor = textColMatch[1].trim();

      const bgMatch = header.match(/background-color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+)/i);
      if (bgMatch) hBg = bgMatch[1].trim();

      const footerTextMatch = footer.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
      if (footerTextMatch) fText = footerTextMatch[1].trim();

      const footerBgMatch = footer.match(/background-color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+)/i);
      if (footerBgMatch) fBg = footerBgMatch[1].trim();

      const footerTextColorMatch = footer.match(/color:\s*(#[a-fA-F0-9]{3,8}|[a-zA-Z]+)/i);
      if (footerTextColorMatch) fTextColor = footerTextColorMatch[1].trim();
    } catch (e) {
      console.error("Error parsing email layout HTML:", e);
    }

    return { headerTitle: hTitle, headerBg: hBg, headerTextColor: hTextColor, footerText: fText, footerBg: fBg, footerTextColor: fTextColor };
  };

  // Load layout on email layout tab activation
  useEffect(() => {
    if (activeTab === "email-layouts") {
      void fetchDefaultEmailLayout();
    }
  }, [activeTab]);

  const fetchDefaultEmailLayout = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await apiClient.get("/notifications/admin/manager-settings", { headers });
      const layouts = res.data?.data?.emailLayouts;
      
      let header = "";
      let footer = "";

      if (layouts?.headerHtml && layouts?.footerHtml) {
        header = layouts.headerHtml;
        footer = layouts.footerHtml;
      } else {
        header = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e6e6e6; border-radius: 8px; overflow: hidden;">
  <div style="background-color: #1a1a1a; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 500;">Modern Orthodontics</h1>
  </div>
  <div style="padding: 32px 24px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 14px;">`;
        footer = `  </div>
  <div style="background-color: #f9f9f9; padding: 20px 24px; border-top: 1px solid #e6e6e6; text-align: center; font-size: 12px; color: #6b6b6b;">
    <p style="margin: 0 0 8px 0;">Modern Orthodontics B2B Platform</p>
  </div>
</div>`;
      }

      setHeaderHtml(header);
      setFooterHtml(footer);

      // Parse fields for Easy Mode
      const parsed = parseLayout(header, footer);
      setHeaderTitle(parsed.headerTitle);
      setHeaderBg(parsed.headerBg);
      setHeaderTextColor(parsed.headerTextColor);
      setFooterText(parsed.footerText);
      setFooterBg(parsed.footerBg);
      setFooterTextColor(parsed.footerTextColor);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEmailLayout = async () => {
    setSavingLayout(true);
    try {
      let finalHeader = headerHtml;
      let finalFooter = footerHtml;

      if (!useHtmlMode) {
        // Generate from visual states
        finalHeader = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e6e6e6; border-radius: 8px; overflow: hidden;">
  <div style="background-color: ${headerBg}; padding: 24px; text-align: center;">
    <h1 style="color: ${headerTextColor}; margin: 0; font-size: 20px; font-weight: 500;">${headerTitle}</h1>
  </div>
  <div style="padding: 32px 24px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 14px;">`;

        finalFooter = `  </div>
  <div style="background-color: ${footerBg}; padding: 20px 24px; border-top: 1px solid #e6e6e6; text-align: center; font-size: 12px; color: ${footerTextColor};">
    <p style="margin: 0 0 8px 0;">${footerText}</p>
  </div>
</div>`;
        setHeaderHtml(finalHeader);
        setFooterHtml(finalFooter);
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("admin_token") : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      await apiClient.patch(
        "/notifications/admin/manager-settings",
        {
          emailLayouts: { headerHtml: finalHeader, footerHtml: finalFooter },
        },
        { headers }
      );
      showSuccess("Email Layout Template saved successfully!");
    } catch (err) {
      console.error(err);
      setErrorMessage("Failed to save layout.");
    } finally {
      setSavingLayout(false);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
  };

  const uniqueTypes = useMemo(() => {
    return Array.from(new Set(templates.map((t: any) => t.type)));
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    return templates.filter((t: any) => {
      if (t.channel === "sms" || t.channel === "in_app" || t.channel === "inApp") {
        return false;
      }
      const matchesType = filterType === "all" || t.type === filterType;
      const matchesChannel = filterChannel === "all" || t.channel === filterChannel;
      return matchesType && matchesChannel;
    });
  }, [templates, filterType, filterChannel]);

  const handleSelectTemplate = (template: any) => {
    setSelectedTemplate(template);
    setSubject(template.subject || "");
    setMessage(template.message || "");
    setVariables(template.variables?.join(", ") || "");
    setWhatsappTemplateId(template.whatsappTemplate?.id || "");
    setSelectedRole(template.role || "GLOBAL");
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    setErrorMessage("");
    try {
      const selectedWhatsApp = approvedWhatsApp.find((w: any) => w.id === whatsappTemplateId);
      const whatsappTemplate = selectedWhatsApp
        ? {
            id: selectedWhatsApp.id,
            name: selectedWhatsApp.name,
            language: selectedWhatsApp.language,
          }
        : null;

      await updateTemplateMutation.mutateAsync({
        type: selectedTemplate.type,
        channel: selectedTemplate.channel,
        data: {
          subject,
          message,
          variables,
          whatsappTemplate,
          role: selectedRole,
        },
      });
      showSuccess("Template updated successfully!");
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to update template.");
    }
  };

  const renderedPreview = useMemo(() => {
    let content = message || "";
    return content.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const val = PREVIEW_MOCKS[key];
      return val !== undefined ? val : `{{${key}}}`;
    });
  }, [message]);

  const getChannelIcon = (ch: string) => {
    switch (ch) {
      case "email": return Mail;
      case "whatsapp": return Smartphone;
      case "sms": return MessageSquare;
      default: return Bell;
    }
  };

  const roleTabs = useMemo(() => {
    return [
      { key: "GLOBAL", label: "GLOBAL" },
      ...roles.map((r: string) => ({ key: r, label: r }))
    ];
  }, [roles]);

  const isLoading = isLoadingTemplates || isLoadingWhatsApp || isLoadingRoles;

  return (
    <AdminLayout title="Template Manager" breadcrumb={[{ label: "Notifications", href: "/admin/notifications" }, { label: "Message Templates" }]}>
      <div className="min-h-[calc(100vh-64px)] overflow-hidden flex flex-col p-6 bg-[#FDFDFD] space-y-6">
        
        {/* Dark Header Banner */}
        <div className="bg-[#122A26] rounded-lg p-6 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-[#5CBAA4] uppercase">CENTRALIZED TEMPLATES</div>
            <h1 className="text-xl font-medium mt-1 font-serif">Notification Template Manager</h1>
            <p className="text-[13px] text-[#A6C4BF] mt-1.5 max-w-xl">Every editable system notification template lives here, so Super Admin can update wording without code changes.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-[#1E3E39] border border-[#2A524C] px-5 py-3 rounded text-center min-w-[100px]">
              <div className="text-[10px] text-[#A6C4BF] font-bold uppercase tracking-wider">Total Templates</div>
              <div className="text-[20px] font-bold mt-0.5">{templates.length}</div>
            </div>
            <div className="bg-[#1E3E39] border border-[#2A524C] px-5 py-3 rounded text-center min-w-[100px]">
              <div className="text-[10px] text-[#A6C4BF] font-bold uppercase tracking-wider">Notification Types</div>
              <div className="text-[20px] font-bold mt-0.5">{uniqueTypes.length}</div>
            </div>
            <div className="bg-[#1E3E39] border border-[#2A524C] px-5 py-3 rounded text-center min-w-[100px]">
              <div className="text-[10px] text-[#A6C4BF] font-bold uppercase tracking-wider">Channels</div>
              <div className="text-[20px] font-bold mt-0.5">3</div>
            </div>
          </div>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-[#E6E6E6]">
          <button
            onClick={() => setActiveTab("templates")}
            className={`px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "templates"
                ? "border-[#1A1A1A] text-[#1A1A1A]"
                : "border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]"
            }`}
          >
            Templates Editor
          </button>
          <button
            onClick={() => setActiveTab("email-layouts")}
            className={`px-4 py-2.5 text-[13px] font-bold uppercase tracking-wider border-b-2 transition-colors ${
              activeTab === "email-layouts"
                ? "border-[#1A1A1A] text-[#1A1A1A]"
                : "border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]"
            }`}
          >
            Static Email Layout
          </button>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 bg-[#EAF5EC] border border-[#CDEBE3] text-[#1D7A32] px-4 py-3 rounded text-[13px] font-medium shadow-sm transition-all">
            <span className="w-2 h-2 bg-[#1D7A32] rounded-full"></span>
            {successMessage}
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 bg-[#FEEFEF] border border-[#FBD6D6] text-[#D32F2F] px-4 py-3 rounded text-[13px] font-medium shadow-sm">
            {errorMessage}
          </div>
        )}

        {activeTab === "templates" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Sidebar list: width 3/12 */}
            <div className="lg:col-span-3 space-y-4">
              <div>
                <h3 className="text-[13px] font-bold text-[#1A1A1A] uppercase tracking-wider">Template List</h3>
                <p className="text-[11px] text-[#6B6B6B] mt-0.5">Select a template and update its wording, subject, and placeholders.</p>
              </div>

              <div className="border border-[#E6E6E6] bg-white rounded p-4 space-y-3 shadow-sm">
                <AdminSelect
                  label="Notification Type"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  options={[{ value: "all", label: "All Notification Types" }, ...uniqueTypes.map((t: any) => ({ value: String(t), label: String(t) }))]}
                />
                
                <AdminSelect
                  label="Channel"
                  value={filterChannel}
                  onChange={(e) => setFilterChannel(e.target.value)}
                  options={[{ value: "all", label: "All Channels" }, ...CHANNELS]}
                />
              </div>

              <div className="border border-[#E6E6E6] bg-white rounded-lg overflow-hidden max-h-[500px] overflow-y-auto divide-y divide-[#E6E6E6] shadow-sm">
                {isLoading ? (
                  <div className="p-4 text-center text-[12px] text-[#9A9A9A]">Loading templates...</div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="p-4 text-center text-[12px] text-[#9A9A9A]">No templates found.</div>
                ) : (
                  filteredTemplates.map((t: any) => {
                    const Icon = getChannelIcon(t.channel);
                    const selected = selectedTemplate?.id === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleSelectTemplate(t)}
                        className={`w-full text-left p-3.5 hover:bg-[#FAFAFA] transition-colors flex items-center gap-3 ${
                          selected ? "bg-[#FAFAFA] border-l-4 border-[#E31E24]" : "pl-4.5"
                        }`}
                      >
                        <div className={`p-2 rounded border ${selected ? "bg-white border-[#E6E6E6] text-[#1A1A1A]" : "bg-[#FAFAFA] border-transparent text-[#9A9A9A]"}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-[12px] font-bold text-[#1A1A1A]">{t.type}</div>
                          <div className="text-[10px] text-[#9A9A9A] uppercase tracking-wider mt-0.5">{t.channel}</div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Template Editor: width 9/12 */}
            <div className="lg:col-span-9 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              
              <div className="xl:col-span-9 space-y-4">
                {selectedTemplate ? (
                  <div className="border border-[#E6E6E6] bg-white rounded-lg p-6 space-y-5 shadow-sm">
                    <div className="border-b border-[#E6E6E6] pb-4">
                      <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
                        <span className="w-1 h-4 bg-[#E31E24]"></span>
                        Template Editor
                      </h3>
                      <p className="text-[11px] text-[#6B6B6B] mt-0.5">Edit the selected notification template and preview it before saving.</p>
                    </div>

                    {/* Dynamic Role tabs */}
                    <div className="flex flex-wrap gap-1.5 border-b border-[#E6E6E6] pb-4">
                      {roleTabs.map((role) => (
                        <button
                          key={role.key}
                          type="button"
                          onClick={() => setSelectedRole(role.key)}
                          className={`px-3 py-1.5 text-[11px] font-bold uppercase rounded border transition-all ${
                            selectedRole === role.key
                              ? "bg-[#1A1A1A] text-white border-transparent"
                              : "bg-white text-[#6B6B6B] border-[#E6E6E6] hover:bg-[#FAFAFA]"
                          }`}
                        >
                          {role.label}
                        </button>
                      ))}
                    </div>

                    {/* Editor inputs */}
                    <div className="space-y-4">
                      {selectedTemplate.channel === "email" && (
                        <AdminInput
                          label="SUBJECT"
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                          placeholder="Use this when the channel supports a subject or title"
                        />
                      )}

                      <AdminTextarea
                        label="MESSAGE"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Write the notification message here"
                        rows={6}
                      />

                      <AdminInput
                        label="AVAILABLE PLACEHOLDERS"
                        value={variables}
                        onChange={(e) => setVariables(e.target.value)}
                        placeholder="name, caseId, patientName"
                      />

                      {selectedTemplate.channel === "whatsapp" && (
                        <AdminSelect
                          label="APPROVED WHATSAPP TEMPLATE"
                          value={whatsappTemplateId}
                          onChange={(e) => setWhatsappTemplateId(e.target.value)}
                          options={[
                            { value: "", label: "No mapping (Plain Text message fallback)" },
                            ...approvedWhatsApp.map((w: any) => ({ value: w.id, label: `${w.name} (${w.language})` }))
                          ]}
                        />
                      )}
                    </div>

                    {/* Live Preview */}
                    <div className="border border-[#E6E6E6] bg-[#FAFAFA] rounded-lg p-5">
                      <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3 mb-3">
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1A1A1A] uppercase tracking-wider">
                          <Eye className="w-4 h-4 text-[#9A9A9A]" />
                          Live Preview
                        </div>
                        <span className="text-[10px] text-[#9A9A9A]">Using sample mock dictionary values</span>
                      </div>
                      {subject && (
                        <div className="text-[12px] font-bold text-[#1A1A1A] mb-2">
                          Subject: <span className="font-normal text-[#6B6B6B]">{subject}</span>
                        </div>
                      )}
                      <div className="text-[12px] text-[#6B6B6B] leading-relaxed whitespace-pre-wrap">{renderedPreview || "Preview will appear here once you write the message."}</div>
                    </div>

                    <div className="flex justify-end pt-3">
                      <button
                        onClick={handleSaveTemplate}
                        className="flex items-center gap-2 px-6 py-2 bg-[#1A1A1A] hover:bg-[#333] text-[11px] font-bold uppercase tracking-wider text-white rounded transition-colors"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Save Template
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="border border-dashed border-[#E6E6E6] rounded-lg p-12 text-center text-[#9A9A9A] text-[12px]">
                    Select a template from the list on the left to start editing.
                  </div>
                )}
              </div>

              {/* Side Tips Cards */}
              <div className="xl:col-span-3 space-y-4">
                <div className="border border-[#E6E6E6] bg-white rounded-lg p-4 space-y-3 shadow-sm text-[12px]">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                    <Smartphone className="w-4 h-4 text-[#E31E24]" />
                    WhatsApp tips
                  </div>
                  <p className="text-[#6B6B6B] leading-relaxed">Keep phone-delivered templates short. Put the most important action in the first line.</p>
                </div>

                <div className="border border-[#E6E6E6] bg-white rounded-lg p-4 space-y-3 shadow-sm text-[12px]">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                    <Mail className="w-4 h-4 text-[#E31E24]" />
                    Email tips
                  </div>
                  <p className="text-[#6B6B6B] leading-relaxed">Use a clear subject and keep the body structured with short, readable lines.</p>
                </div>

                <div className="border border-[#E6E6E6] bg-white rounded-lg p-4 space-y-3 shadow-sm text-[12px]">
                  <div className="flex items-center gap-1.5 font-bold text-[#1A1A1A]">
                    <Info className="w-4 h-4 text-[#E31E24]" />
                    System note
                  </div>
                  <p className="text-[#6B6B6B] leading-relaxed">Push notifications usually work best with shorter titles and one clear action sentence.</p>
                </div>
              </div>

            </div>

          </div>
        ) : (
          /* Email layout configuration editor */
          <div className="border border-[#E6E6E6] bg-white rounded-lg p-6 space-y-5 shadow-sm">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#E6E6E6] pb-4 gap-4">
              <div>
                <h3 className="text-[14px] font-bold text-[#1A1A1A]">Static Layout (Header & Footer) Wrapper</h3>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">Configure the global wrapper, colors, logo text, and footer for all store emails.</p>
              </div>
              <button
                type="button"
                onClick={() => setUseHtmlMode(!useHtmlMode)}
                className="px-3.5 py-2 border border-[#E6E6E6] hover:bg-[#FAFAFA] rounded text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] transition-colors whitespace-nowrap self-stretch sm:self-auto text-center"
              >
                {useHtmlMode ? "Switch to Easy Mode (Form)" : "Switch to Advanced HTML Mode"}
              </button>
            </div>

            {useHtmlMode ? (
              <div className="space-y-4">
                <AdminTextarea
                  label="Fixed Header HTML"
                  value={headerHtml}
                  onChange={(e) => setHeaderHtml(e.target.value)}
                  rows={10}
                  className="font-mono text-[12px]"
                />

                <AdminTextarea
                  label="Fixed Footer HTML"
                  value={footerHtml}
                  onChange={(e) => setFooterHtml(e.target.value)}
                  rows={10}
                  className="font-mono text-[12px]"
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Header Configuration */}
                <div className="space-y-4 border border-[#E6E6E6] rounded-lg p-5 bg-[#FCFCFC]">
                  <h4 className="text-[12.5px] font-bold text-[#1A1A1A] uppercase tracking-wider border-b border-[#E6E6E6] pb-2">Header Options</h4>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Header Brand / Logo Title</label>
                    <input
                      type="text"
                      value={headerTitle}
                      onChange={(e) => setHeaderTitle(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border border-[#E6E6E6] rounded focus:outline-none focus:border-[#1A1A1A]"
                      placeholder="e.g. Modern Orthodontics"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Header Background Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={headerBg}
                          onChange={(e) => setHeaderBg(e.target.value)}
                          className="w-8.5 h-8.5 p-0.5 rounded border border-[#E6E6E6] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={headerBg}
                          onChange={(e) => setHeaderBg(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-[12px] border border-[#E6E6E6] rounded focus:outline-none text-center font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Header Title Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={headerTextColor}
                          onChange={(e) => setHeaderTextColor(e.target.value)}
                          className="w-8.5 h-8.5 p-0.5 rounded border border-[#E6E6E6] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={headerTextColor}
                          onChange={(e) => setHeaderTextColor(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-[12px] border border-[#E6E6E6] rounded focus:outline-none text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Configuration */}
                <div className="space-y-4 border border-[#E6E6E6] rounded-lg p-5 bg-[#FCFCFC]">
                  <h4 className="text-[12.5px] font-bold text-[#1A1A1A] uppercase tracking-wider border-b border-[#E6E6E6] pb-2">Footer Options</h4>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Footer Copyright Wording</label>
                    <input
                      type="text"
                      value={footerText}
                      onChange={(e) => setFooterText(e.target.value)}
                      className="w-full px-3 py-2 text-[13px] border border-[#E6E6E6] rounded focus:outline-none focus:border-[#1A1A1A]"
                      placeholder="e.g. Modern Orthodontics B2B Platform"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Footer Background Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={footerBg}
                          onChange={(e) => setFooterBg(e.target.value)}
                          className="w-8.5 h-8.5 p-0.5 rounded border border-[#E6E6E6] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={footerBg}
                          onChange={(e) => setFooterBg(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-[12px] border border-[#E6E6E6] rounded focus:outline-none text-center font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-1.5">Footer Text Color</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={footerTextColor}
                          onChange={(e) => setFooterTextColor(e.target.value)}
                          className="w-8.5 h-8.5 p-0.5 rounded border border-[#E6E6E6] cursor-pointer"
                        />
                        <input
                          type="text"
                          value={footerTextColor}
                          onChange={(e) => setFooterTextColor(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-[12px] border border-[#E6E6E6] rounded focus:outline-none text-center font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                onClick={handleSaveEmailLayout}
                disabled={savingLayout}
                className="flex items-center gap-2 px-6 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] font-bold uppercase tracking-wider rounded transition-colors disabled:opacity-50"
              >
                {savingLayout ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {savingLayout ? "Saving..." : "Save Layout"}
              </button>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
