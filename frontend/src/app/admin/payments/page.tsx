"use client";

import { useEffect, useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useToast } from "@/components/admin/AdminComponents";
import { adminApi } from "@/services/adminApi";
import { Search, ShieldCheck } from "lucide-react";

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  description?: string;
  type: string;
  isEnabled: boolean;
}

interface CountryMatrixRow {
  countryId: string;
  countryName: string;
  countryCode: string;
  flagEmoji?: string;
  methods: Array<{
    id: string;
    code: string;
    name: string;
    isEnabled: boolean;
  }>;
}

interface PaymentMatrixResponse {
  paymentMethods: PaymentMethod[];
  matrix: CountryMatrixRow[];
}

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
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PaymentMatrixResponse | null>(null);
  const [search, setSearch] = useState("");
  const [updatingCell, setUpdatingCell] = useState<string | null>(null);

  const fetchMatrix = async () => {
    try {
      setLoading(true);
      const res = await adminApi.get("/payment-methods/matrix");
      setData(res.data.data);
    } catch {
      showToast("Failed to load payment methods matrix.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !hasPermission("payments.view")) return;
    fetchMatrix();
  }, [authLoading, hasPermission]);

  const handleToggleCountryMethod = async (
    paymentMethodId: string,
    countryId: string,
    currentEnabled: boolean,
  ) => {
    if (!canUpdate) {
      showToast("You do not have permission to update payment settings.", "error");
      return;
    }

    const cellKey = `${paymentMethodId}:${countryId}`;
    setUpdatingCell(cellKey);
    try {
      await adminApi.put("/payment-methods/country", {
        paymentMethodId,
        countryId,
        isEnabled: !currentEnabled,
      });

      // Optimistic update
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          matrix: prev.matrix.map((row) => {
            if (row.countryId !== countryId) return row;
            return {
              ...row,
              methods: row.methods.map((m) =>
                m.id === paymentMethodId
                  ? { ...m, isEnabled: !currentEnabled }
                  : m,
              ),
            };
          }),
        };
      });

      showToast("Payment method country setting updated.", "success");
    } catch {
      showToast("Could not update payment method setting.", "error");
    } finally {
      setUpdatingCell(null);
    }
  };

  if (authLoading || !hasPermission("payments.view")) {
    return null;
  }

  const filteredMatrix = (data?.matrix ?? []).filter((row) =>
    row.countryName.toLowerCase().includes(search.toLowerCase()) ||
    row.countryCode.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AdminLayout
      title="Payment Settings"
      breadcrumb={[{ label: "Payment Management System" }]}
    >
      <div className="space-y-6">
        {/* Header Description */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-[17px] font-bold text-[#1A1A1A]">
                Dynamic Country Payment Matrix
              </h2>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#6B6B6B]">
                Enable or disable payment gateways per country dynamically. When a new payment method is registered in the database, it automatically appears here and on the customer checkout page.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#F5F5F7] px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
              <ShieldCheck size={16} className="text-[#2A6A40]" />
              Data-Driven Routing
            </div>
          </div>

          {/* Payment Method Badges */}
          <div className="mt-4 flex flex-wrap gap-2 pt-4 border-t border-[#F0F0F0]">
            {(data?.paymentMethods ?? []).map((pm) => (
              <div
                key={pm.id}
                className="flex items-center gap-2 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A]"
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    pm.isEnabled ? "bg-green-500" : "bg-gray-400"
                  }`}
                />
                <span>{pm.name}</span>
                <span className="rounded bg-[#EFEFEF] px-1.5 py-0.5 text-[10px] uppercase font-mono text-[#6B6B6B]">
                  {pm.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Matrix Controls */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search countries..."
              className="w-full rounded-lg border border-[#E6E6E6] bg-white py-2 pl-9 pr-4 text-[13.5px] text-[#1A1A1A] outline-none transition-colors focus:border-[#E31E24]"
            />
          </div>
          <p className="text-xs text-[#6B6B6B]">
            Showing <strong className="text-[#1A1A1A]">{filteredMatrix.length}</strong> countries
          </p>
        </div>

        {/* Matrix Table */}
        <div className="overflow-hidden rounded-xl border border-[#E6E6E6] bg-white shadow-sm">
          {loading ? (
            <div className="py-16 text-center text-sm text-[#9A9A9A]">
              Loading payment matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E6E6E6] bg-[#F9FAFB] text-[#6B6B6B]">
                    <th className="px-5 py-3.5 font-bold uppercase tracking-wider">
                      Country
                    </th>
                    {(data?.paymentMethods ?? []).map((pm) => (
                      <th
                        key={pm.id}
                        className="px-5 py-3.5 text-center font-bold uppercase tracking-wider"
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          <span>{pm.code}</span>
                          <span className="text-[10px] font-normal normal-case text-[#9A9A9A]">
                            {pm.name}
                          </span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {filteredMatrix.map((row) => (
                    <tr
                      key={row.countryId}
                      className="hover:bg-[#F9FAFB] transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium text-[#1A1A1A]">
                        <div className="flex items-center gap-2">
                          <span className="text-base">{row.flagEmoji || "🌐"}</span>
                          <span className="font-semibold">{row.countryName}</span>
                          <span className="rounded bg-[#F0F0F0] px-1.5 py-0.5 font-mono text-[10px] text-[#6B6B6B]">
                            {row.countryCode}
                          </span>
                        </div>
                      </td>

                      {row.methods.map((method) => {
                        const cellKey = `${method.id}:${row.countryId}`;
                        const isUpdating = updatingCell === cellKey;

                        return (
                          <td
                            key={method.id}
                            className="px-5 py-3.5 text-center align-middle"
                          >
                            <label className="inline-flex cursor-pointer items-center justify-center">
                              <input
                                type="checkbox"
                                disabled={isUpdating || !canUpdate}
                                checked={method.isEnabled}
                                onChange={() =>
                                  handleToggleCountryMethod(
                                    method.id,
                                    row.countryId,
                                    method.isEnabled,
                                  )
                                }
                                className="sr-only peer"
                              />
                              <div className="relative h-5 w-9 rounded-full bg-[#D1D5DB] transition-colors peer-checked:bg-[#E31E24] peer-disabled:opacity-50">
                                <span
                                  className={`absolute top-0.5 left-0.5 h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    method.isEnabled ? "translate-x-4" : ""
                                  }`}
                                />
                              </div>
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
