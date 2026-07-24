"use client";
import { useEffect, useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";

interface Gateway { provider: string; displayName: string; keyId?: string; webhookSecret?: string; isEnabled: boolean }

export default function PaymentsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("payments.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("payments.update");

  const { showToast, ToastComponent } = useToast();
  const [gateways, setGateways] = useState<Gateway[]>([{ provider: "RAZORPAY", displayName: "Razorpay (India)", isEnabled: false }, { provider: "STRIPE", displayName: "Stripe (Global)", isEnabled: false }]);
  const [configs, setConfigs] = useState<Record<string, { keyId: string; keySecret: string; webhookSecret: string; isEnabled: boolean }>>({ RAZORPAY: { keyId: "", keySecret: "", webhookSecret: "", isEnabled: false }, STRIPE: { keyId: "", keySecret: "", webhookSecret: "", isEnabled: false } });

  useEffect(() => {
    if (authLoading || !hasPermission("payments.view")) return;
    adminApi.get("/payments").then((r) => {
      const gs: Gateway[] = r.data.data || [];
      const c: typeof configs = { ...configs };
      gs.forEach((g) => { c[g.provider] = { keyId: g.keyId || "", keySecret: "", webhookSecret: g.webhookSecret || "", isEnabled: g.isEnabled }; });
      setConfigs(c);
    }).catch(() => {});
  }, [authLoading, hasPermission]);

  const handleSave = async (provider: string, displayName: string) => {
    if (!canUpdate) return;
    try {
      await adminApi.post("/payments", { provider, displayName, ...configs[provider] });
      showToast(`${displayName} settings saved.`);
    } catch { showToast("Failed.", "error"); }
  };

  if (authLoading || !hasPermission("payments.view")) {
    return null;
  }

  return (
    <AdminLayout title="Payment Settings" breadcrumb={[{ label: "Payments" }]}>
      <div className="space-y-4">
        {gateways.map((g) => (
          <div key={g.provider} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{g.displayName}</h3>
                <p className="text-[12.5px] text-[#9A9A9A] mt-0.5">{g.provider === "RAZORPAY" ? "Used for Indian customers (INR billing)" : "Used for all international customers"}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${configs[g.provider]?.isEnabled ? "bg-[#E31E24]" : "bg-[#D1D5DB]"} ${!canUpdate ? "cursor-not-allowed opacity-60" : ""}`}
                  onClick={() => canUpdate && setConfigs((prev) => ({ ...prev, [g.provider]: { ...prev[g.provider], isEnabled: !prev[g.provider]?.isEnabled } }))}
                >
                  <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${configs[g.provider]?.isEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-[13px] text-[#6B6B6B]">{configs[g.provider]?.isEnabled ? "Enabled" : "Disabled"}</span>
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <AdminInput
                label={g.provider === "RAZORPAY" ? "Key ID" : "Publishable Key"}
                placeholder="Enter key…"
                value={configs[g.provider]?.keyId || ""}
                onChange={(e) => setConfigs((prev) => ({ ...prev, [g.provider]: { ...prev[g.provider], keyId: e.target.value } }))}
                disabled={!canUpdate}
              />
              <AdminInput
                label={g.provider === "RAZORPAY" ? "Key Secret" : "Secret Key"}
                type="password"
                placeholder="Enter secret…"
                value={configs[g.provider]?.keySecret || ""}
                onChange={(e) => setConfigs((prev) => ({ ...prev, [g.provider]: { ...prev[g.provider], keySecret: e.target.value } }))}
                disabled={!canUpdate}
              />
              <AdminInput
                label="Webhook Secret"
                type="password"
                placeholder="Webhook verification secret"
                value={configs[g.provider]?.webhookSecret || ""}
                onChange={(e) => setConfigs((prev) => ({ ...prev, [g.provider]: { ...prev[g.provider], webhookSecret: e.target.value } }))}
                disabled={!canUpdate}
              />
            </div>
            {canUpdate && (
              <button
                onClick={() => handleSave(g.provider, g.displayName)}
                className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
              >
                Save Settings
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-[13px] text-yellow-700">
        ⚠️ API secrets are stored encrypted in the database. Never expose them in frontend code. Gateway selection (Razorpay vs Stripe) is automatic based on customer country.
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
