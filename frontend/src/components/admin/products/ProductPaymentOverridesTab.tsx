import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { useToast } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { cn } from "@/utils/cn";
import { Info, Save, RefreshCw, AlertTriangle, Trash2, Copy } from "lucide-react";

interface VariantInfo {
  id: string;
  title: string;
  sku?: string | null;
}

interface ProductPaymentOverridesTabProps {
  productId: string;
  variants: VariantInfo[];
}

interface PaymentMethod {
  id: string;
  code: string;
  name: string;
}

interface OverrideData {
  productOverrides: { paymentMethodId: string; state: "ALLOW" | "BLOCK" }[];
  variantOverrides: { variantId: string; paymentMethodId: string; state: "ALLOW" | "BLOCK" }[];
  availablePaymentMethods: PaymentMethod[];
}

export function ProductPaymentOverridesTab({
  productId,
  variants = [],
}: ProductPaymentOverridesTabProps) {
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState<"product" | "variants">("product");
  const [selectedVariantIds, setSelectedVariantIds] = useState<string[]>([]);

  // Override States
  const [productOverridesMap, setProductOverridesMap] = useState<Record<string, "ALLOW" | "BLOCK" | null>>({});
  const [variantOverridesMap, setVariantOverridesMap] = useState<Record<string, Record<string, "ALLOW" | "BLOCK" | null>>>({});

  // 1. Fetch Overrides
  const { data, isLoading, isError, refetch } = useQuery<OverrideData>({
    queryKey: ["product-payment-overrides", productId],
    queryFn: async () => {
      const res = await adminApi.get(`/products/${productId}/payment-overrides`);
      return res.data.data;
    },
  });

  // Default selected variants to all variants once loaded
  useEffect(() => {
    if (variants.length > 0 && selectedVariantIds.length === 0) {
      setSelectedVariantIds(variants.map((v) => v.id));
    }
  }, [variants, selectedVariantIds]);

  // Sync state maps with query data
  useEffect(() => {
    if (data) {
      // Build product overrides map
      const pmMap: Record<string, "ALLOW" | "BLOCK" | null> = {};
      data.availablePaymentMethods.forEach((pm) => {
        pmMap[pm.id] = null; // Default to Country Default
      });
      data.productOverrides.forEach((po) => {
        pmMap[po.paymentMethodId] = po.state;
      });
      setProductOverridesMap(pmMap);

      // Build variant overrides map
      const vmMap: Record<string, Record<string, "ALLOW" | "BLOCK" | null>> = {};
      variants.forEach((v) => {
        vmMap[v.id] = {};
        data.availablePaymentMethods.forEach((pm) => {
          vmMap[v.id][pm.id] = null; // Default to Product Rule
        });
      });
      data.variantOverrides.forEach((vo) => {
        if (vmMap[vo.variantId]) {
          vmMap[vo.variantId][vo.paymentMethodId] = vo.state;
        }
      });
      setVariantOverridesMap(vmMap);
    }
  }, [data, variants]);

  // 2. Save Overrides Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: {
      productOverrides: { paymentMethodId: string; state: "ALLOW" | "BLOCK" | null }[];
      variantOverrides: { variantId: string; paymentMethodId: string; state: "ALLOW" | "BLOCK" | null }[];
    }) => {
      const res = await adminApi.put(`/products/${productId}/payment-overrides`, payload);
      return res.data;
    },
    onSuccess: () => {
      showToast("Payment rules saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ["product-payment-overrides", productId] });
    },
    onError: (err) => {
      showToast(getAdminErrorMessage(err, "Failed to save payment rules."), "error");
    },
  });

  const availablePaymentMethods = data?.availablePaymentMethods || [];

  const handleSave = () => {
    const productOverrides = Object.entries(productOverridesMap).map(([paymentMethodId, state]) => ({
      paymentMethodId,
      state,
    }));

    const variantOverrides: { variantId: string; paymentMethodId: string; state: "ALLOW" | "BLOCK" | null }[] = [];
    Object.entries(variantOverridesMap).forEach(([variantId, pmMap]) => {
      Object.entries(pmMap).forEach(([paymentMethodId, state]) => {
        variantOverrides.push({
          variantId,
          paymentMethodId,
          state,
        });
      });
    });

    saveMutation.mutate({
      productOverrides,
      variantOverrides,
    });
  };

  // Bulk Action: Copy Product Rules to All Variants
  const handleCopyProductToAllVariants = () => {
    const newVariantOverridesMap = { ...variantOverridesMap };

    variants.forEach((v) => {
      newVariantOverridesMap[v.id] = {};
      availablePaymentMethods.forEach((pm) => {
        newVariantOverridesMap[v.id][pm.id] = productOverridesMap[pm.id] || null;
      });
    });

    setVariantOverridesMap(newVariantOverridesMap);
    showToast("Copied product rules to all variants. Click Save to apply.", "success");
  };

  // Bulk Action: Reset All Variants to Product Rules
  const handleResetAllVariants = () => {
    const newVariantOverridesMap = { ...variantOverridesMap };

    variants.forEach((v) => {
      newVariantOverridesMap[v.id] = {};
      availablePaymentMethods.forEach((pm) => {
        newVariantOverridesMap[v.id][pm.id] = null;
      });
    });

    setVariantOverridesMap(newVariantOverridesMap);
    showToast("Reset all variants to Product rules. Click Save to apply.", "success");
  };

  // Multi-variant state updater
  const handleSetVariantState = (pmId: string, state: "ALLOW" | "BLOCK" | null) => {
    if (selectedVariantIds.length === 0) return;
    const newMap = { ...variantOverridesMap };
    selectedVariantIds.forEach((vId) => {
      newMap[vId] = { ...(newMap[vId] || {}), [pmId]: state };
    });
    setVariantOverridesMap(newMap);
  };

  const variantOptions = useMemo(() => {
    return variants.map((v) => ({
      value: v.id,
      label: `${v.title}${v.sku ? ` (SKU: ${v.sku})` : ""}`,
    }));
  }, [variants]);

  if (isLoading) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#E31E24]" />
        <span className="text-[13px] text-[#6B6B6B]">Loading payment rules...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center p-6">
        <AlertTriangle size={24} className="text-red-500" />
        <span className="text-[14px] font-semibold text-[#1A1A1A]">Failed to load payment rules.</span>
        <button
          onClick={() => refetch()}
          className="mt-2 rounded-md bg-[#E31E24] px-4 py-1.5 text-[13px] font-medium text-white hover:bg-[#B5151B]"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Action-Oriented Help Banner */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <h4 className="text-[13.5px] font-bold text-blue-900">How Payment Rules Work</h4>
            <p className="mt-1 text-[12.5px] text-blue-800 leading-relaxed">
              • <strong>Country Rules First:</strong> If a payment method is disabled for a country, it cannot be enabled for individual products or variants.
              <br />
              • <strong>Rule Priority:</strong> Custom Variant rules take priority over Product rules, which take priority over Country defaults.
            </p>
          </div>
        </div>
      </div>

      {/* Sub-Tabs Switcher */}
      <div className="flex border-b border-[#E6E6E6]">
        <button
          type="button"
          onClick={() => setActiveSubTab("product")}
          className={cn(
            "pb-3 px-6 text-[14px] font-bold border-b-2 transition-all",
            activeSubTab === "product"
              ? "border-[#E31E24] text-[#E31E24]"
              : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
          )}
        >
          Product-Wide Settings
        </button>
        <button
          type="button"
          disabled={variants.length === 0}
          onClick={() => setActiveSubTab("variants")}
          className={cn(
            "pb-3 px-6 text-[14px] font-bold border-b-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
            activeSubTab === "variants"
              ? "border-[#E31E24] text-[#E31E24]"
              : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
          )}
        >
          Variant Settings ({variants.length})
        </button>
      </div>

      {/* Sub-Tab: Product */}
      {activeSubTab === "product" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Payment Rules</h3>
            <p className="text-[12.5px] text-[#9A9A9A]">
              Set payment rules for this entire product. These will apply to all variants unless a variant has its own custom rule.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {availablePaymentMethods.map((pm) => {
              const currentState = productOverridesMap[pm.id] ?? null;

              return (
                <div key={pm.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-sm">
                  <div>
                    <h4 className="text-[14px] font-bold text-[#1A1A1A]">{pm.name}</h4>
                    <span className="inline-block mt-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10.5px] font-medium text-gray-600 uppercase tracking-wider">
                      Code: {pm.code}
                    </span>
                  </div>

                  <div className="flex gap-1 rounded-lg border border-[#E6E6E6] bg-gray-50 p-1">
                    <button
                      type="button"
                      onClick={() => setProductOverridesMap({ ...productOverridesMap, [pm.id]: null })}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                        currentState === null
                          ? "bg-white text-gray-800 shadow-sm border border-[#E6E6E6]"
                          : "text-gray-500 hover:text-gray-800"
                      )}
                    >
                      Use Country Default
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductOverridesMap({ ...productOverridesMap, [pm.id]: "ALLOW" })}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                        currentState === "ALLOW"
                          ? "bg-green-600 text-white shadow-sm"
                          : "text-gray-500 hover:text-green-600"
                      )}
                    >
                      Allow
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductOverridesMap({ ...productOverridesMap, [pm.id]: "BLOCK" })}
                      className={cn(
                        "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                        currentState === "BLOCK"
                          ? "bg-red-600 text-white shadow-sm"
                          : "text-gray-500 hover:text-red-600"
                      )}
                    >
                      Block
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub-Tab: Variants */}
      {activeSubTab === "variants" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="w-full sm:max-w-md">
              <AdminMultiSearchableSelect
                label="Variants"
                options={variantOptions}
                values={selectedVariantIds}
                onValuesChange={(next) => setSelectedVariantIds(next)}
                placeholder="Select variants"
                searchPlaceholder="Search..."
                allowSelectAll={true}
                selectAllLabel="All Variants"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 pt-2 sm:pt-0">
              <button
                type="button"
                onClick={handleCopyProductToAllVariants}
                className="flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
                title="apply product level rules to all variants"
              >
                <Copy size={14} />
                Apply product rules
              </button>
              <button
                type="button"
                onClick={handleResetAllVariants}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-red-700 hover:bg-red-50/50 shadow-sm"
                title="Reset all variants to use product rules"
              >
                <Trash2 size={14} />
                Reset to Default
              </button>
            </div>
          </div>

          <hr className="my-2 border-t border-[#E6E6E6]" />

          {selectedVariantIds.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {availablePaymentMethods.map((pm) => {
                // Determine current state across all selected variants
                const selectedStates = selectedVariantIds.map(
                  (vId) => (variantOverridesMap[vId] || {})[pm.id] ?? null
                );
                const allSameState = selectedStates.every((s) => s === selectedStates[0]);
                const activeState = allSameState ? selectedStates[0] : undefined;

                // Product default state
                const parentState = productOverridesMap[pm.id] ?? null;
                const parentStateLabel =
                  parentState === "ALLOW"
                    ? "Allowed"
                    : parentState === "BLOCK"
                    ? "Blocked"
                    : "Country Default";

                const parentBadgeClass =
                  parentState === "ALLOW"
                    ? "text-green-700 bg-green-50 border border-green-200"
                    : parentState === "BLOCK"
                    ? "text-red-700 bg-red-50 border border-red-200"
                    : "text-gray-600 bg-gray-50 border border-gray-200";

                return (
                  <div key={pm.id} className="flex flex-col justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-sm">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-[14px] font-bold text-[#1A1A1A]">{pm.name}</h4>
                        <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                          {pm.code}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="text-[11.5px] text-[#6b6b6b]">Product Default:</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-bold", parentBadgeClass)}>
                          {parentStateLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 rounded-lg border border-[#E6E6E6] bg-gray-50 p-1">
                      <button
                        type="button"
                        onClick={() => handleSetVariantState(pm.id, null)}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          activeState === null
                            ? "bg-white text-gray-800 shadow-sm border border-[#E6E6E6]"
                            : "text-gray-500 hover:text-gray-800"
                        )}
                      >
                        Use Product Rule
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetVariantState(pm.id, "ALLOW")}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          activeState === "ALLOW"
                            ? "bg-green-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-green-600"
                        )}
                      >
                        Allow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetVariantState(pm.id, "BLOCK")}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          activeState === "BLOCK"
                            ? "bg-red-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-red-600"
                        )}
                      >
                        Block
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[150px] items-center justify-center rounded-xl border border-dashed border-[#E6E6E6]">
              <span className="text-[13px] text-[#9A9A9A]">Select one or more variants to manage rules.</span>
            </div>
          )}
        </div>
      )}

      {/* Save Button */}
      <hr className="border-t border-[#E6E6E6]" />
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-6 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#B5151B] disabled:opacity-60 transition-all shadow-sm"
        >
          {saveMutation.isPending ? (
            <>
              <RefreshCw size={14} className="animate-spin" />
              Saving Rules…
            </>
          ) : (
            <>
              <Save size={14} />
              Save Payment Rules
            </>
          )}
        </button>
      </div>
    </div>
  );
}
