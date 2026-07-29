"use client";
import Link from "next/link";
import { useState } from "react";
import { Loader2, Plug } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminShippingProviders,
  useUpsertShippingProvider,
  useToggleShippingProvider,
  useTestShippingConnection,
} from "@/hooks/admin/useAdminHooks";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  apiKey: string | null;
  apiSecret: string | null;
  baseUrl: string | null;
  trackingUrl: string | null;
  isEnabled: boolean;
  config: Record<string, unknown> | null;
  _count: { zones: number };
}

interface ProviderConfig {
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
  trackingUrl: string;
  accountNumber: string;
  mode: "sandbox" | "production";
}

const defaultConfig: ProviderConfig = {
  apiKey: "",
  apiSecret: "",
  baseUrl: "",
  trackingUrl: "",
  accountNumber: "",
  mode: "production",
};

export default function ShippingPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("shipping.manage");
  const { showToast, ToastComponent } = useToast();

  const { data: providers, isLoading } = useAdminShippingProviders();
  const upsertMutation = useUpsertShippingProvider();
  const toggleMutation = useToggleShippingProvider();
  const testConnection = useTestShippingConnection();

  const providerList: Provider[] = providers ?? [];
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const getConfig = (p: Provider): ProviderConfig => {
    if (configs[p.name]) return configs[p.name];
    const cfg = p.config ?? {};
    return {
      apiKey: p.apiKey ?? "",
      apiSecret: p.apiSecret ?? "",
      baseUrl: p.baseUrl ?? "",
      trackingUrl: p.trackingUrl ?? "",
      accountNumber: (cfg.accountNumber as string) ?? "",
      mode: (cfg.mode as "sandbox" | "production") ?? "production",
    };
  };

  const updateField = (pName: string, field: keyof ProviderConfig, value: string) => {
    const current = getConfig({ name: pName } as Provider);
    setConfigs((prev) => ({ ...prev, [pName]: { ...current, [field]: value } }));
    setDirty((prev) => ({ ...prev, [pName]: true }));
  };

  const handleSave = async (p: Provider) => {
    const cfg = getConfig(p);
    try {
      await upsertMutation.mutateAsync({
        name: p.name,
        apiKey: cfg.apiKey || undefined,
        apiSecret: cfg.apiSecret || undefined,
        baseUrl: cfg.baseUrl || undefined,
        trackingUrl: cfg.trackingUrl || undefined,
        config: { accountNumber: cfg.accountNumber || undefined, mode: cfg.mode },
      });
      setDirty((prev) => ({ ...prev, [p.name]: false }));
      showToast(`${p.displayName} settings saved.`);
    } catch {
      showToast("Failed to save.", "error");
    }
  };

  const handleToggle = async (p: Provider) => {
    try {
      await toggleMutation.mutateAsync(p.id);
      showToast(`${p.displayName} ${p.isEnabled ? "disabled" : "enabled"}.`);
    } catch {
      showToast("Failed to toggle.", "error");
    }
  };

  const handleTest = async (p: Provider) => {
    try {
      const result = await testConnection.mutateAsync(p.id);
      if (result.success) {
        showToast(`${p.displayName}: ${result.message} (${result.latencyMs}ms)`);
      } else {
        showToast(`${p.displayName}: ${result.message}`, "error");
      }
    } catch {
      showToast(`Connection test failed for ${p.displayName}.`, "error");
    }
  };

  return (
    <AdminLayout title="Shipping Providers" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Providers" }]}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 border-b border-[#E6E6E6]">
            <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Providers</span>
            <Link href="/admin/shipping/zones" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Zones
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-[#E31E24]" />
            <span className="ml-2 text-[13px] text-[#6B6B6B]">Loading providers...</span>
          </div>
        ) : providerList.length === 0 ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white px-5 py-12 text-center">
            <p className="text-[13.5px] font-medium text-[#6B6B6B]">No shipping providers configured.</p>
            <p className="mt-1 text-[13px] text-[#9A9A9A]">Run the seed script to create default providers.</p>
          </div>
        ) : (
          providerList.map((p) => {
            const cfg = getConfig(p);
            const isDirty = dirty[p.name] ?? false;
            const isTestable = Boolean(cfg.baseUrl && cfg.apiKey);

            return (
              <div key={p.name} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{p.displayName}</h3>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${p.isEnabled ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {p.isEnabled ? "Enabled" : "Disabled"}
                    </span>
                    {p._count.zones > 0 && (
                      <span className="text-[11px] text-[#6B6B6B]">{p._count.zones} zone{p._count.zones !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canUpdate && isTestable && (
                      <button
                        onClick={() => handleTest(p)}
                        disabled={testConnection.isPending}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#F2F2F2] disabled:opacity-50"
                      >
                        <Plug size={12} />
                        {testConnection.isPending ? "Testing..." : "Test Connection"}
                      </button>
                    )}
                    {canUpdate && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <div
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${p.isEnabled ? "bg-[#E31E24]" : "bg-[#D1D5DB]"}`}
                          onClick={() => handleToggle(p)}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${p.isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <AdminInput
                    label="API Key"
                    type="password"
                    placeholder="Enter API key..."
                    value={cfg.apiKey}
                    onChange={(e) => updateField(p.name, "apiKey", e.target.value)}
                    disabled={!canUpdate}
                  />
                  <AdminInput
                    label="API Secret"
                    type="password"
                    placeholder="Enter API secret..."
                    value={cfg.apiSecret}
                    onChange={(e) => updateField(p.name, "apiSecret", e.target.value)}
                    disabled={!canUpdate}
                  />
                  <AdminInput
                    label="Base URL"
                    placeholder="https://api.carrier.com"
                    value={cfg.baseUrl}
                    onChange={(e) => updateField(p.name, "baseUrl", e.target.value)}
                    disabled={!canUpdate}
                  />
                  <AdminInput
                    label="Account Number"
                    placeholder="Optional account number"
                    value={cfg.accountNumber}
                    onChange={(e) => updateField(p.name, "accountNumber", e.target.value)}
                    disabled={!canUpdate}
                  />
                  <AdminSelect
                    label="Mode"
                    value={cfg.mode}
                    onChange={(e) => updateField(p.name, "mode", e.target.value)}
                    disabled={!canUpdate}
                    options={[
                      { value: "production", label: "Production" },
                      { value: "sandbox", label: "Sandbox / Test" },
                    ]}
                  />
                  <AdminInput
                    label="Tracking URL Pattern"
                    placeholder="https://track.example.com/{tracking}"
                    value={cfg.trackingUrl}
                    onChange={(e) => updateField(p.name, "trackingUrl", e.target.value)}
                    disabled={!canUpdate}
                  />
                </div>

                {canUpdate && isDirty && (
                  <button
                    onClick={() => handleSave(p)}
                    disabled={upsertMutation.isPending}
                    className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                  >
                    {upsertMutation.isPending ? "Saving..." : `Save ${p.displayName}`}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
