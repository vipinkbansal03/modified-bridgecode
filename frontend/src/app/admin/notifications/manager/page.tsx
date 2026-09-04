"use client";

import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Modal } from "@/components/admin/AdminComponents";
import {
  useNotificationConfigs,
  useUpdateNotificationConfig,
  useNotificationManagerSettings,
  useUpdateNotificationManagerSettings,
  useNotificationRolesList
} from "@/hooks/api";
import { Mail, MessageSquare, Smartphone, Bell, Save, Check, Pencil, Users } from "lucide-react";

const CHANNEL_OPTIONS = [
  { key: "whatsapp", label: "WhatsApp", hint: "Short direct message on WhatsApp", icon: Smartphone },
  { key: "email", label: "Email", hint: "Formal message with subject and details", icon: Mail },
  { key: "push", label: "Push", hint: "Browser or device notification", icon: Bell },
];

export default function NotificationManagerPage() {
  const { data: configs = [], isLoading: isLoadingConfigs } = useNotificationConfigs();
  const { data: settings, isLoading: isLoadingSettings } = useNotificationManagerSettings();
  const { data: roles = [], isLoading: isLoadingRoles } = useNotificationRolesList();
  
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
  const [successMessage, setSuccessMessage] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

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
      setRolePermissions(prev => {
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
    setChannelAvailability(prev => ({
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
      showSuccess("Global configuration settings saved successfully!");
    } catch (err) {
      console.error(err);
    } finally {
      setSavingSettings(false);
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
      showSuccess(`Notification system globally ${nextVal ? "enabled" : "disabled"}`);
    } catch (err) {
      console.error(err);
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 4000);
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
      showSuccess(`Rule ${config.type} status updated!`);
    } catch (err) {
      console.error(err);
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
      showSuccess(`Updated channel ${channelKey} for event ${config.name}`);
    } catch (err) {
      console.error(err);
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
      showSuccess(`Configuration rules saved successfully for ${editingConfig.type}!`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChannelToggle = (role: string, ch: string) => {
    setRolePermissions(prev => {
      const currentRole = prev[role] || { whatsapp: true, email: true, sms: false };
      return {
        ...prev,
        [role]: {
          ...currentRole,
          [ch]: !currentRole[ch],
        }
      };
    });
  };

  const activeRulesCount = useMemo(() => configs.filter((item: any) => item.isEnabled).length, [configs]);

  const ROLE_OPTIONS = useMemo(() => {
    return roles.map((r: string) => ({ value: r, label: r }));
  }, [roles]);

  const isLoading = isLoadingConfigs || isLoadingSettings || isLoadingRoles;

  return (
    <AdminLayout title="Notification Manager" breadcrumb={[{ label: "Notifications", href: "/admin/notifications" }, { label: "Notification Manager" }]}>
      <div className="min-h-[calc(100vh-64px)] overflow-hidden flex flex-col p-6 bg-[#FDFDFD] space-y-6">
        
        {/* Header Banner */}
        <div className="bg-white border border-[#E6E6E6] rounded-lg p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div>
            <div className="text-[11px] font-bold tracking-widest text-[#7A7A7A] uppercase">CENTRALIZED CONTROL</div>
            <h1 className="text-xl font-semibold mt-1 text-[#1A1A1A]">Notification Manager</h1>
            <p className="text-[13px] text-[#6B6B6B] mt-1.5 max-w-xl">Turn notifications on or off, choose channels, and decide which users should receive each update.</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-[#FAFAFA] border border-[#E6E6E6] px-5 py-3 rounded text-center min-w-[100px]">
              <div className="text-[10px] text-[#7A7A7A] font-bold uppercase tracking-wider">Active Rules</div>
              <div className="text-[20px] font-bold text-[#1A1A1A] mt-0.5">{activeRulesCount}</div>
            </div>
            <div className="bg-[#FAFAFA] border border-[#E6E6E6] px-5 py-3 rounded text-center min-w-[100px]">
              <div className="text-[10px] text-[#7A7A7A] font-bold uppercase tracking-wider">Channels</div>
              <div className="text-[20px] font-bold text-[#1A1A1A] mt-0.5">5</div>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="flex items-center gap-2 bg-[#EAF5EC] border border-[#CDEBE3] text-[#1D7A32] px-4 py-3 rounded text-[13px] font-medium shadow-sm transition-all animate-fade-in">
            <span className="w-2 h-2 bg-[#1D7A32] rounded-full"></span>
            {successMessage}
          </div>
        )}

        {/* Master Toggle */}
        <div className="bg-white border border-[#E6E6E6] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div>
            <h2 className="text-[14px] font-bold text-[#1A1A1A]">Enable Notifications</h2>
            <p className="text-[12px] text-[#6B6B6B] mt-0.5">Use this master switch when you want to pause or resume all system notifications.</p>
          </div>
          <button
            onClick={handleToggleMasterSwitch}
            className={`flex items-center gap-2 px-4 py-2 text-[11px] font-bold tracking-wider rounded border uppercase transition-colors ${
              masterEnabled
                ? "bg-[#1D7A32] text-white border-transparent hover:bg-[#155A24]"
                : "bg-white text-[#D32F2F] border-[#D32F2F] hover:bg-[#FEEFEF]"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${masterEnabled ? "bg-white animate-pulse" : "bg-[#D32F2F]"}`}></span>
            Notifications are {masterEnabled ? "ON" : "OFF"}
          </button>
        </div>

        {/* Global Channels */}
        <div className="bg-white border border-[#E6E6E6] rounded-lg p-6 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h2 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
                <span className="w-1 h-4 bg-[#E31E24]"></span>
                Global Channels
              </h2>
              <p className="text-[11px] text-[#6B6B6B] mt-0.5">These are the channels that are also available across the system.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {CHANNEL_OPTIONS.map((ch) => {
              const key = ch.key === "inApp" ? "inApp" : ch.key;
              const active = channelAvailability[key] !== false;
              const Icon = ch.icon;
              return (
                <button
                  key={ch.key}
                  onClick={() => handleToggleGlobalChannel(key)}
                  className={`p-4 rounded border text-left flex flex-col justify-between h-28 transition-all ${
                    active
                      ? "border-[#1A1A1A] bg-[#FAFAFA] text-[#1A1A1A]"
                      : "border-[#E6E6E6] bg-white text-[#9A9A9A] hover:bg-[#FAFAFA]"
                  }`}
                >
                  <div className="flex justify-between w-full items-start">
                    <Icon className="w-4 h-4" />
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                      active ? "border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32]" : "border-transparent bg-[#FAFAFA] text-[#9A9A9A]"
                    }`}>
                      {active ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <div>
                    <div className="text-[12px] font-bold uppercase tracking-wider">{ch.label}</div>
                    <div className="text-[10px] text-[#9A9A9A] mt-0.5 leading-tight">{ch.hint}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveChannelSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Channel Settings
            </button>
          </div>
        </div>

        {/* Dynamic Team Delivery Rules */}
        <div className="bg-white border border-[#E6E6E6] rounded-lg p-6 shadow-sm">
          <div>
            <h2 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
              <span className="w-1 h-4 bg-[#E31E24]"></span>
              Role Delivery Rules
            </h2>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">Control allowed notification channels dynamically for each workspace and user/customer role in the project.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mt-4">
            {isLoading ? (
              <div className="text-[12px] text-[#9A9A9A] py-4 col-span-full text-center">Loading project roles...</div>
            ) : roles.length === 0 ? (
              <div className="text-[12px] text-[#9A9A9A] py-4 col-span-full text-center">No roles detected in the project database.</div>
            ) : (
              roles.map((role: string) => {
                const currentChs = rolePermissions[role] || { whatsapp: true, email: true, sms: false };
                return (
                  <div key={role} className="border border-[#E6E6E6] rounded-lg p-5 bg-[#FCFCFC] shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-[#E31E24]" />
                      <h3 className="text-[13px] font-bold text-[#1A1A1A] uppercase tracking-wider">{role}</h3>
                    </div>
                    <p className="text-[11px] text-[#6B6B6B] mb-4">Choose which channels are available for the {role} role.</p>
                    <div className="flex gap-2">
                      {["whatsapp", "email"].map((ch) => {
                        const active = currentChs[ch] === true;
                        return (
                          <button
                            key={ch}
                            onClick={() => handleRoleChannelToggle(role, ch)}
                            className={`px-2.5 py-1 text-[10px] font-bold uppercase border rounded transition-all flex items-center gap-1.5 ${
                              active
                                ? "bg-[#1A1A1A] text-white border-transparent"
                                : "bg-white text-[#6B6B6B] border-[#E6E6E6] hover:bg-[#FAFAFA]"
                            }`}
                          >
                            {active && <Check className="w-2.5 h-2.5" />}
                            {ch}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSaveChannelSettings}
              disabled={savingSettings}
              className="flex items-center gap-2 px-5 py-2 bg-[#1A1A1A] hover:bg-[#333] text-white text-[11px] font-bold uppercase tracking-wider rounded transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Role Delivery Rules
            </button>
          </div>
        </div>

        {/* Rules Table */}
        <div className="bg-white border border-[#E6E6E6] rounded-lg p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
              <span className="w-1 h-4 bg-[#E31E24]"></span>
              Notification Table
            </h2>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">Use this table to rapidly control each notification, channel, and audience from one place.</p>
          </div>

          <div className="border border-[#E6E6E6] rounded overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="bg-[#FAFAFA] border-b border-[#E6E6E6]">
                    <th className="px-6 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Notification</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">WhatsApp</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Email</th>
                    <th className="px-4 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Push</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider">Send To</th>
                    <th className="px-6 py-3.5 text-[10px] font-bold text-[#9A9A9A] uppercase tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-[12px] text-[#9A9A9A]">Loading configuration table...</td>
                    </tr>
                  ) : configs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-10 text-center text-[12px] text-[#9A9A9A]">No configurations.</td>
                    </tr>
                  ) : (
                    configs.map((config: any) => {
                      const channels = (config.channels || {}) as Record<string, boolean>;
                      return (
                        <tr key={config.id} className="hover:bg-[#FAFAFA] transition-colors">
                          <td className="px-6 py-4">
                            <div className="text-[12.5px] font-bold text-[#1A1A1A]">{config.name}</div>
                            <div className="text-[10px] text-[#9A9A9A] mt-0.5">{config.type}</div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleConfigEnabled(config)}
                              className={`px-2 py-0.5 rounded text-[9px] font-bold border tracking-wider uppercase ${
                                config.isEnabled
                                  ? "border-[#CDEBE3] bg-[#EAF5EC] text-[#1D7A32]"
                                  : "border-[#FBD6D6] bg-[#FEEFEF] text-[#D32F2F]"
                              }`}
                            >
                              {config.isEnabled ? "ON" : "OFF"}
                            </button>
                          </td>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={channels.whatsapp === true}
                              onChange={() => handleCheckboxToggle(config, "whatsapp", channels.whatsapp === true)}
                              className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={channels.email === true}
                              onChange={() => handleCheckboxToggle(config, "email", channels.email === true)}
                              className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={channels.push === true}
                              onChange={() => handleCheckboxToggle(config, "push", channels.push === true)}
                              className="rounded border-[#cccccc] text-[#1A1A1A] focus:ring-0 cursor-pointer"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-1 flex-wrap max-w-xs">
                              {config.targetRoles.map((role: string) => (
                                <span key={role} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-[#F2F2F2] text-[#6B6B6B]">
                                  {role}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => setEditingConfig(JSON.parse(JSON.stringify(config)))}
                              className="p-1 text-[#9A9A9A] hover:text-[#1A1A1A] hover:bg-[#E6E6E6] rounded transition-colors border border-[#E6E6E6]"
                            >
                              <Pencil className="w-3.5 h-3.5" />
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

        {/* Configure Modal */}
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
                <Save className="w-3.5 h-3.5" />
                Save Config
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
                        className={`p-3 text-[12px] border text-left rounded font-medium flex items-center justify-between cursor-pointer ${
                          active ? "border-[#E31E24] bg-red-50/20 text-[#E31E24]" : "border-[#E6E6E6] bg-white hover:bg-[#FAFAFA]"
                        }`}
                      >
                        {r.label}
                        {active && <Check className="w-4.5 h-4.5 text-[#E31E24]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[#6B6B6B] mb-3">Enabled Channels</label>
                <div className="grid grid-cols-2 gap-4">
                  {CHANNEL_OPTIONS.map((ch) => {
                    const key = ch.key === "inApp" ? "inApp" : ch.key;
                    const isChecked = editingConfig.channels[key] !== false;
                    return (
                      <label key={ch.key} className="flex items-center gap-2.5 p-3 border border-[#E6E6E6] rounded cursor-pointer hover:bg-[#FAFAFA]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const updated = { ...editingConfig.channels, [key]: e.target.checked };
                            setEditingConfig({ ...editingConfig, channels: updated });
                          }}
                          className="rounded border-[#cccccc] text-[#E31E24] focus:ring-[#E31E24]"
                        />
                        <span className="text-[13px] font-medium text-[#1A1A1A]">{ch.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </AdminLayout>
  );
}
