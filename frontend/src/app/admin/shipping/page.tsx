"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";

interface Provider { id: string; name: string; displayName: string; apiKey?: string; trackingUrl?: string; isEnabled: boolean }

export default function ShippingPage() {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("shipping.update");

  const { showToast, ToastComponent } = useToast();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [configs, setConfigs] = useState<Record<string, { apiKey: string; trackingUrl: string; isEnabled: boolean }>>({});

  useEffect(() => {
    adminApi.get("/shipping/providers").then((r) => {
      const ps: Provider[] = r.data.data || [];
      setProviders(ps);
      const c: typeof configs = {};
      ps.forEach((p) => { c[p.name] = { apiKey: p.apiKey || "", trackingUrl: p.trackingUrl || "", isEnabled: p.isEnabled }; });
      setConfigs(c);
    }).catch(() => {});
  }, []);

  const handleSave = async (name: string) => {
    try {
      await adminApi.post("/shipping/providers", { name, ...configs[name] });
      showToast(`${name} settings saved.`);
    } catch { showToast("Failed.", "error"); }
  };

  const defaultProviders = providers.length ? providers : [{ id: "dhl", name: "DHL", displayName: "DHL Express", isEnabled: false }, { id: "dtdc", name: "DTDC", displayName: "DTDC Courier", isEnabled: false }];

  return (
    <AdminLayout title="Shipping" breadcrumb={[{ label: "Shipping" }]}>
      <div className="space-y-4">
        <div className="flex gap-2 border-b border-[#E6E6E6]">
          <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Providers</span>
          <Link href="/admin/shipping/zones" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
            Zones
          </Link>
        </div>
        {defaultProviders.map((p) => (
          <div key={p.name} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{p.displayName}</h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${configs[p.name]?.isEnabled ? "bg-[#E31E24]" : "bg-[#D1D5DB]"} ${!canUpdate ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`} onClick={() => { if (!canUpdate) return; setConfigs((prev) => ({ ...prev, [p.name]: { ...prev[p.name], isEnabled: !prev[p.name]?.isEnabled } })); }}>
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${configs[p.name]?.isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-[13px] text-[#6B6B6B]">{configs[p.name]?.isEnabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <AdminInput label="API Key" type="password" placeholder="Enter API key…" value={configs[p.name]?.apiKey || ""} onChange={(e) => setConfigs((prev) => ({ ...prev, [p.name]: { ...prev[p.name], apiKey: e.target.value } }))} disabled={!canUpdate} />
              <AdminInput label="Tracking URL Pattern" placeholder="https://track.example.com/{tracking}" value={configs[p.name]?.trackingUrl || ""} onChange={(e) => setConfigs((prev) => ({ ...prev, [p.name]: { ...prev[p.name], trackingUrl: e.target.value } }))} disabled={!canUpdate} />
            </div>
            {canUpdate && (
              <button onClick={() => handleSave(p.name)} className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">Save {p.displayName}</button>
            )}
          </div>
        ))}
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
