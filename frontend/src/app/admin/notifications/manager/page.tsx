"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminStatsGrid,
  Modal,
  StatusBadge,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import {
  useNotificationConfigs,
  useUpdateNotificationConfig,
  useNotificationManagerSettings,
  useUpdateNotificationManagerSettings,
  useNotificationRolesList,
} from "@/hooks/api";
import {
  Mail,
  MessageSquare,
  Smartphone,
  Bell,
  Save,
  Check,
  Pencil,
  Users,
  Sliders,
  History,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Power,
} from "lucide-react";
import { cn } from "@/utils/cn";

const CHANNEL_OPTIONS = [
  { key: "whatsapp", label: "WhatsApp", hint: "Direct WhatsApp notification & order updates", icon: Smartphone },
  { key: "sms", label: "SMS", hint: "Transactional SMS alerts & mobile OTP", icon: MessageSquare },
  { key: "email", label: "Email", hint: "Formal message with rich subject and invoice PDF", icon: Mail },
  { key: "push", label: "Push", hint: "In-browser notification & push alerts", icon: Bell },
];

export default function NotificationManagerPage() {
  const { data: configs = [], isLoading: isLoadingConfigs } = useNotificationConfigs();
  const { data: settings, isLoading: isLoadingSettings } = useNotificationManagerSettings();
  const { data: roles = [], isLoading: isLoadingRoles } = useNotificationRolesList();
  const { showToast, ToastComponent } = useToast();

  const updateConfigMutation = useUpdateNotificationConfig();
  const updateSettingsMutation = useUpdateNotificationManagerSettings();

  const [masterEnabled, setMasterEnabled] = useState(true);
  const [channelAvailability, setChannelAvailability] = useState<Record<string, boolean>>({
    sms: true,
    whatsapp: true,
    email: true,
    push: true,
    inApp: true,
  });

  // Dynamic role channel permissions
  const [rolePermissions, setRolePermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [editingConfig, setEditingConfig] = useState<any | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    if (settings) {
      setMasterEnabled(settings.masterEnabled);
      if (settings.channelAvailability) {
        setChannelAvailability(settings.channelAvailability as Record<string, boolean>);
      }
      if (settings.rolePermissions) {
        setRolePermissions(settings.rolePermissions as Record<string, Record<string, boolean>>);
      }
    }
  }, [settings]);

  // Set default channels for newly loaded roles if they don't exist
  useEffect(() => {
    if (roles.length > 0) {
      setRolePermissions((prev) => {
        const next = { ...prev };
        let updated = false;
        for (const role of roles) {
          if (!next[role]) {
            next[role] = { whatsapp: true, email: true, sms: false };
            updated = true;
          }
        }
        return updated ? next : prev;
      });
    }
  }, [roles]);

  const handleToggleGlobalChannel = (key: string) => {
    setChannelAvailability((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveChannelSettings = async () => {
    setSavingSettings(true);
    try {
      await updateSettingsMutation.mutateAsync({
        masterEnabled,
        channelAvailability,
        rolePermissions,
      });
      showToast("Global channel availability saved successfully.");
    } catch {
      showToast("Failed to save channel settings.", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleSaveRolePermissions = async () => {
    setSavingRoles(true);
    try {
      await updateSettingsMutation.mutateAsync({
        masterEnabled,
        channelAvailability,
        rolePermissions,
      });
      showToast("Role delivery rules saved successfully.");
    } catch {
      showToast("Failed to save role delivery rules.", "error");
    } finally {
      setSavingRoles(false);
    }
  };

  const handleToggleMasterSwitch = async () => {
    const nextVal = !masterEnabled;
    setMasterEnabled(nextVal);
    try {
      await updateSettingsMutation.mutateAsync({
        masterEnabled: nextVal,
        channelAvailability,
        rolePermissions,
      });
      showToast(`Notification system master switch is now ${nextVal ? "ENABLED" : "DISABLED"}.`);
    } catch {
      showToast("Failed to update master switch.", "error");
    }
  };

  const handleToggleConfigEnabled = async (config: any) => {
    try {
      await updateConfigMutation.mutateAsync({
        id: config.id,
        data: {
          ...config,
          isEnabled: !config.isEnabled,
        },
      });
      showToast(`Rule "${config.name || config.type}" ${!config.isEnabled ? "enabled" : "disabled"}.`);
    } catch {
      showToast("Failed to update rule status.", "error");
    }
  };

  const handleCheckboxToggle = async (config: any, channelKey: string, currentVal: boolean) => {
    try {
      const updatedChannels = {
        ...(config.channels || {}),
        [channelKey]: !currentVal,
      };
      await updateConfigMutation.mutateAsync({
        id: config.id,
        data: {
          ...config,
          channels: updatedChannels,
        },
      });
      showToast(`Updated ${channelKey} channel for ${config.name}.`);
    } catch {
      showToast("Failed to update channel trigger.", "error");
    }
  };

  const handleSaveConfigDetails = async () => {
    if (!editingConfig) return;
    try {
      await updateConfigMutation.mutateAsync({
        id: editingConfig.id,
        data: {
          isEnabled: editingConfig.isEnabled,
          targetRoles: editingConfig.targetRoles,
          channels: editingConfig.channels,
          rolePermissions: editingConfig.rolePermissions,
          filters: editingConfig.filters,
        },
      });
      setEditingConfig(null);
      showToast(`Rule configuration for ${editingConfig.name || editingConfig.type} saved.`);
    } catch {
      showToast("Failed to save rule configuration.", "error");
    }
  };

  const handleRoleChannelToggle = (role: string, ch: string) => {
    setRolePermissions((prev) => {
      const currentRole = prev[role] || { whatsapp: true, email: true, sms: false };
      return {
        ...prev,
        [role]: {
          ...currentRole,
          [ch]: !currentRole[ch],
        },
      };
    });
  };

  const activeRulesCount = useMemo(() => configs.filter((item: any) => item.isEnabled).length, [configs]);
  const ROLE_OPTIONS = useMemo(() => roles.map((r: string) => ({ value: r, label: r })), [roles]);
  const isLoading = isLoadingConfigs || isLoadingSettings || isLoadingRoles;

  return (
    <AdminLayout
      title="Notification Manager"
      breadcrumb={[{ label: "Notifications", href: "/admin/notifications" }, { label: "Routing Rules" }]}
    >
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/notifications/manager"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Sliders size={15} />
            <span>Routing Rules</span>
            {configs.length > 0 && (
              <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
                {configs.length}
              </span>
            )}
          </Link>
          <Link
            href="/admin/notifications"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <History size={15} />
            <span>History Logs</span>
          </Link>
          <Link
            href="/admin/notifications/templates"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <FileText size={15} />
            <span>Template Studio</span>
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Triggers", value: configs.length, subtitle: "Registered system events", icon: <Sliders size={18} />, isLoading },
            { title: "Active Rules", value: activeRulesCount, subtitle: "Enabled for dispatch", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Global Channels", value: CHANNEL_OPTIONS.length, subtitle: "SMS, WhatsApp, Email, Push", icon: <Smartphone size={18} />, color: "bg-sky-600", isLoading },
            { title: "Audience Roles", value: roles.length, subtitle: "Configured target groups", icon: <Users size={18} />, color: "bg-amber-600", isLoading },
          ]}
        />

        {/* Master Switch Banner */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className={cn("mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg shadow-2xs", masterEnabled ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-[#E31E24]")}>
              <Power size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">Master Notification Switch</h2>
                <span className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  masterEnabled ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-700 border border-red-200"
                )}>
                  {masterEnabled ? "SYSTEM ACTIVE" : "SYSTEM PAUSED"}
                </span>
              </div>
              <p className="text-[12.5px] text-[#6B6B6B] mt-0.5">
                Global kill-switch to immediately pause or resume dispatching of all transactional notifications across all channels.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleToggleMasterSwitch}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                  masterEnabled ? "bg-[#E31E24]" : "bg-[#D1D5DB]"
                )}
              >
                <span
                  className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white shadow-xs transition-transform",
                    masterEnabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
              </div>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">
                {masterEnabled ? "Enabled" : "Disabled"}
              </span>
            </button>
          </div>
        </div>

        {/* Global Channels */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">Global Channels Availability</h2>
              <p className="text-[12px] text-[#6B6B6B] mt-0.5">Toggle transport channels system-wide for customer and administrative broadcasts.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {CHANNEL_OPTIONS.map((ch) => {
              const key = ch.key === "inApp" ? "inApp" : ch.key;
              const active = channelAvailability[key] !== false;
              const Icon = ch.icon;
              return (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => handleToggleGlobalChannel(key)}
                  className={cn(
                    "p-4 rounded-xl border text-left flex flex-col justify-between h-28 transition-all cursor-pointer shadow-2xs",
                    active
                      ? "border-[#E31E24]/30 bg-red-50/15 text-[#1A1A1A]"
                      : "border-[#E6E6E6] bg-white text-[#9A9A9A] hover:bg-[#F9FAFB]"
                  )}
                >
                  <div className="flex justify-between w-full items-start">
                    <div className={cn("p-1.5 rounded-md", active ? "bg-[#E31E24]/10 text-[#E31E24]" : "bg-gray-100 text-[#9A9A9A]")}>
                      <Icon size={16} />
                    </div>
                    <span className={cn(
                      "text-[10.5px] font-semibold px-2 py-0.5 rounded-full border",
                      active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-[#E6E6E6] bg-gray-50 text-[#9A9A9A]"
                    )}>
                      {active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[#1A1A1A]">{ch.label}</div>
                    <div className="text-[11px] text-[#6B6B6B] mt-0.5 line-clamp-1">{ch.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-[#F0F0F0]">
            <LoadingButton
              type="button"
              onClick={handleSaveChannelSettings}
              loading={savingSettings}
              loadingText="Saving..."
              className="inline-flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors cursor-pointer"
            >
              <Save size={14} />
              Save Channel Settings
            </LoadingButton>
          </div>
        </div>

        {/* Role Delivery Rules */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs">
          <div>
            <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">Role Delivery Rules</h2>
            <p className="text-[12px] text-[#6B6B6B] mt-0.5">Control allowed notification channels dynamically for each user role.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mt-4">
            {isLoading ? (
              <div className="text-[13px] text-[#9A9A9A] py-6 col-span-full text-center">Loading project roles...</div>
            ) : roles.length === 0 ? (
              <div className="text-[13px] text-[#9A9A9A] py-6 col-span-full text-center">No roles detected in the project database.</div>
            ) : (
              roles.map((role: string) => {
                const currentChs = rolePermissions[role] || { whatsapp: true, email: true, sms: false };
                return (
                  <div key={role} className="border border-[#E6E6E6] rounded-xl p-4 bg-white shadow-2xs flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Users size={15} className="text-[#E31E24]" />
                        <h3 className="text-[13.5px] font-bold text-[#1A1A1A]">{role}</h3>
                      </div>
                      <p className="text-[11.5px] text-[#6B6B6B] mb-3">Allowed channels for {role} role members:</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["whatsapp", "sms", "email", "push"].map((ch) => {
                        const active = currentChs[ch] === true;
                        return (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => handleRoleChannelToggle(role, ch)}
                            className={cn(
                              "px-2.5 py-1 text-[11px] font-semibold border rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs",
                              active
                                ? "border-[#E31E24] bg-red-50/40 text-[#E31E24]"
                                : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F9FAFB] hover:text-[#1A1A1A]"
                            )}
                          >
                            {active ? <Check size={12} /> : null}
                            <span className="capitalize">{ch}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-end mt-4 pt-3 border-t border-[#F0F0F0]">
            <LoadingButton
              type="button"
              onClick={handleSaveRolePermissions}
              loading={savingRoles}
              loadingText="Saving..."
              className="inline-flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors cursor-pointer"
            >
              <Save size={14} />
              Save Role Delivery Rules
            </LoadingButton>
          </div>
        </div>

        {/* Trigger Rules Table */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <div className="px-5 py-4 border-b border-[#E6E6E6] bg-white">
            <h2 className="text-[14.5px] font-bold text-[#1A1A1A]">Event Notification Triggers</h2>
            <p className="text-[12px] text-[#6B6B6B] mt-0.5">Configure individual system event triggers, channel destinations, and role audiences.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E6E6E6]">
                  <th className="px-5 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">Event Trigger</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">WhatsApp</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">SMS</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">Email</th>
                  <th className="px-4 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">Push</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider">Target Audience</th>
                  <th className="px-5 py-3 text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E6E6E6] bg-white">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-[#9A9A9A]">Loading event triggers...</td>
                  </tr>
                ) : configs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-[13px] text-[#9A9A9A]">No notification triggers configured.</td>
                  </tr>
                ) : (
                  configs.map((config: any) => {
                    const channels = (config.channels || {}) as Record<string, boolean>;
                    return (
                      <tr key={config.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="text-[13.5px] font-semibold text-[#1A1A1A]">{config.name}</div>
                          <div className="text-[11px] text-[#6B6B6B] mt-0.5 font-mono">{config.type}</div>
                        </td>
                        <td className="px-5 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleConfigEnabled(config)}
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer",
                              config.isEnabled
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                            )}
                          >
                            {config.isEnabled ? "ACTIVE" : "PAUSED"}
                          </button>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={channels.whatsapp === true}
                            onChange={() => handleCheckboxToggle(config, "whatsapp", channels.whatsapp === true)}
                            className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={channels.sms === true}
                            onChange={() => handleCheckboxToggle(config, "sms", channels.sms === true)}
                            className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={channels.email === true}
                            onChange={() => handleCheckboxToggle(config, "email", channels.email === true)}
                            className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={channels.push === true}
                            onChange={() => handleCheckboxToggle(config, "push", channels.push === true)}
                            className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex gap-1 flex-wrap max-w-xs">
                            {(config.targetRoles || []).map((role: string) => (
                              <span key={role} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-[#F3F4F6] text-[#4B5563] border border-[#E5E7EB]">
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => setEditingConfig(JSON.parse(JSON.stringify(config)))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#1A1A1A] transition-colors cursor-pointer shadow-2xs"
                            title="Edit rule configuration"
                          >
                            <Pencil size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Configure Trigger Modal */}
      <Modal
        open={Boolean(editingConfig)}
        onClose={() => setEditingConfig(null)}
        title={`Configure Rule: ${editingConfig?.name ?? ""}`}
        subtitle="Select recipient target roles and active delivery channels for this trigger."
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setEditingConfig(null)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveConfigDetails}
              className="flex items-center gap-2 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              <Save size={14} />
              Save Configuration
            </button>
          </div>
        }
      >
        {editingConfig && (
          <div className="space-y-6 p-6">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-2">Target Roles</label>
              <div className="grid grid-cols-2 gap-2">
                {ROLE_OPTIONS.map((r: any) => {
                  const active = editingConfig.targetRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => {
                        const next = active
                          ? editingConfig.targetRoles.filter((v: string) => v !== r.value)
                          : [...editingConfig.targetRoles, r.value];
                        setEditingConfig({ ...editingConfig, targetRoles: next });
                      }}
                      className={cn(
                        "p-3 text-[12.5px] border text-left rounded-xl font-medium flex items-center justify-between cursor-pointer transition-colors",
                        active ? "border-[#E31E24] bg-red-50/20 text-[#E31E24]" : "border-[#E6E6E6] bg-white hover:bg-[#F9FAFB] text-[#1A1A1A]"
                      )}
                    >
                      <span>{r.label}</span>
                      {active && <Check size={16} className="text-[#E31E24]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-3">Enabled Delivery Channels</label>
              <div className="grid grid-cols-2 gap-3">
                {CHANNEL_OPTIONS.map((ch) => {
                  const key = ch.key === "inApp" ? "inApp" : ch.key;
                  const isChecked = editingConfig.channels[key] !== false;
                  return (
                    <label key={ch.key} className="flex items-center gap-2.5 p-3 border border-[#E6E6E6] rounded-xl cursor-pointer hover:bg-[#F9FAFB] transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          const updated = { ...editingConfig.channels, [key]: e.target.checked };
                          setEditingConfig({ ...editingConfig, channels: updated });
                        }}
                        className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24]"
                      />
                      <div>
                        <span className="text-[13px] font-semibold text-[#1A1A1A]">{ch.label}</span>
                        <p className="text-[11px] text-[#6B6B6B] line-clamp-1">{ch.hint}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {ToastComponent}
    </AdminLayout>
  );
}
