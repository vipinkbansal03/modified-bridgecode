"use client";
import Link from "next/link";
import { useState, useMemo } from "react";
import { Loader2, Plug, Truck, Globe, Package, ShieldCheck, MapPin } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, AdminStatsGrid, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import {
  useAdminShippingProviders,
  useAdminShippingZones,
  useUpsertShippingProvider,
  useToggleShippingProvider,
  useTestShippingConnection,
} from "@/hooks/admin/useAdminHooks";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "@/services/adminApi";
import { ApiShippingBox } from "@/types/api.types";

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
  rateEndpoint: string;
  mode: "sandbox" | "production";
}

const PROVIDER_URLS: Record<string, Record<string, { baseUrl: string; trackingUrl: string }>> = {
  DHL: {
    production: { baseUrl: "https://api.dhl.com/mydhlapi", trackingUrl: "https://track.dhl.com/{tracking}" },
    sandbox: { baseUrl: "https://api-test.dhl.com/mydhlapi", trackingUrl: "https://track.dhl.com/{tracking}" },
  },
  DTDC: {
    production: { baseUrl: "https://api.dtdc.in", trackingUrl: "https://www.dtdc.in/tracking/{tracking}" },
    sandbox: { baseUrl: "https://api.dtdc.in", trackingUrl: "https://www.dtdc.in/tracking/{tracking}" },
  },
};

const defaultConfig: ProviderConfig = {
  apiKey: "",
  apiSecret: "",
  baseUrl: "",
  trackingUrl: "",
  accountNumber: "",
  rateEndpoint: "",
  mode: "production",
};

export default function ShippingPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("shipping.manage");
  const { showToast, ToastComponent } = useToast();

  const { data: providers, isLoading } = useAdminShippingProviders();
  const { data: zones = [] } = useAdminShippingZones();
  const { data: boxes = [] } = useQuery<ApiShippingBox[]>({
    queryKey: ["admin-shipping-boxes"],
    queryFn: () => adminApi.get("/shipping/boxes").then((r) => r.data.data),
  });

  const upsertMutation = useUpsertShippingProvider();
  const toggleMutation = useToggleShippingProvider();
  const testConnection = useTestShippingConnection();

  const providerList: Provider[] = providers ?? [];
  const [configs, setConfigs] = useState<Record<string, ProviderConfig>>({});
  const [dirty, setDirty] = useState<Record<string, boolean>>({});

  const totals = useMemo(() => {
    return {
      total: providerList.length,
      active: providerList.filter((p) => p.isEnabled).length,
      zones: (zones as any[]).length,
      boxes: (boxes as any[]).length,
    };
  }, [providerList, zones, boxes]);

  const getConfig = (p: Provider): ProviderConfig => {
    if (configs[p.name]) return configs[p.name];
    const cfg = p.config ?? {};
    return {
      apiKey: p.apiKey ?? "",
      apiSecret: p.apiSecret ?? "",
      baseUrl: p.baseUrl ?? "",
      trackingUrl: p.trackingUrl ?? "",
      accountNumber: (cfg.accountNumber as string) ?? "",
      rateEndpoint: (cfg.rateEndpoint as string) ?? "",
      mode: (cfg.mode as "sandbox" | "production") ?? "production",
    };
  };

  const updateField = (pName: string, field: keyof ProviderConfig, value: string) => {
    const provider = providerList.find((p) => p.name === pName);
    const current = provider ? getConfig(provider) : defaultConfig;
    const newCfg = { ...current, [field]: value };
    if (field === "mode") {
      const urls = PROVIDER_URLS[pName]?.[value];
      if (urls) {
        newCfg.baseUrl = urls.baseUrl;
        newCfg.trackingUrl = urls.trackingUrl;
      }
    }
    setConfigs((prev) => ({ ...prev, [pName]: newCfg }));
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
        config: { accountNumber: cfg.accountNumber || undefined, rateEndpoint: cfg.rateEndpoint || undefined, mode: cfg.mode },
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
      const cfg = getConfig(p);
      const result = await testConnection.mutateAsync({ id: p.id, apiKey: cfg.apiKey, apiSecret: cfg.apiSecret, baseUrl: cfg.baseUrl });
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
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/shipping"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Truck size={15} />
            <span>Providers</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {totals.total}
            </span>
          </Link>
          <Link
            href="/admin/shipping/zones"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Globe size={15} />
            <span>Zones</span>
            {totals.zones > 0 && (
              <span className="ml-1 rounded-full bg-[#F0F0F0] text-[#666] px-2 py-0.5 text-[11px] font-semibold">
                {totals.zones}
              </span>
            )}
          </Link>
          <Link
            href="/admin/shipping/boxes"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Package size={15} />
            <span>Boxes</span>
            {totals.boxes > 0 && (
              <span className="ml-1 rounded-full bg-[#F0F0F0] text-[#666] px-2 py-0.5 text-[11px] font-semibold">
                {totals.boxes}
              </span>
            )}
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Providers", value: totals.total, subtitle: "Configured integrations", icon: <Truck size={18} />, isLoading },
            { title: "Active Carriers", value: totals.active, subtitle: "Enabled for shipping", icon: <ShieldCheck size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Configured Zones", value: totals.zones, subtitle: "Shipping rate zones", icon: <Globe size={18} />, color: "bg-sky-600", isLoading },
            { title: "Package Boxes", value: totals.boxes, subtitle: "Box dimension presets", icon: <Package size={18} />, color: "bg-amber-600", isLoading }
          ]}
        />

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
                      <LoadingButton
                        type="button"
                        onClick={() => handleTest(p)}
                        loading={testConnection.isPending}
                        loadingText="Testing..."
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#F2F2F2]"
                      >
                        <Plug size={12} />
                        Test Connection
                      </LoadingButton>
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
                  <AdminInput
                    label="Rate Endpoint"
                    placeholder="https://api.dtdc.in/api/v1/rates"
                    value={cfg.rateEndpoint}
                    onChange={(e) => updateField(p.name, "rateEndpoint", e.target.value)}
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
                  <LoadingButton
                    type="button"
                    onClick={() => handleSave(p)}
                    loading={upsertMutation.isPending}
                    loadingText="Saving..."
                    className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
                  >
                    Save {p.displayName}
                  </LoadingButton>
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
