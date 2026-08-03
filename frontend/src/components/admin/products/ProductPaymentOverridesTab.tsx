import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { useToast } from "@/components/admin/AdminComponents";
import { cn } from "@/utils/cn";
import { Info, HelpCircle, Save, RefreshCw, AlertTriangle, Check, Trash2, Copy } from "lucide-react";

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
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");

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

  // Set default selected variant once loaded
  useEffect(() => {
    if (variants.length > 0 && !selectedVariantId) {
      setSelectedVariantId(variants[0].id);
    }
  }, [variants, selectedVariantId]);

  // Sync state maps with query data
  useEffect(() => {
    if (data) {
      // Build product overrides map
      const pmMap: Record<string, "ALLOW" | "BLOCK" | null> = {};
      data.availablePaymentMethods.forEach((pm) => {
        pmMap[pm.id] = null; // Default to Inherit
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
          vmMap[v.id][pm.id] = null; // Default to Inherit
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
      showToast("Payment overrides saved successfully.", "success");
      queryClient.invalidateQueries({ queryKey: ["product-payment-overrides", productId] });
    },
    onError: (err) => {
      showToast(getAdminErrorMessage(err, "Failed to save payment overrides."), "error");
    },
  });

  const availablePaymentMethods = data?.availablePaymentMethods || [];

  const handleSave = () => {
    // Collect product overrides
    const productOverrides = Object.entries(productOverridesMap).map(([paymentMethodId, state]) => ({
      paymentMethodId,
      state,
    }));

    // Collect variant overrides
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

  // Bulk Action: Apply Current Variant Settings to All Variants
  const handleApplyVariantToAll = () => {
    if (!selectedVariantId) return;
    const currentVariantSettings = variantOverridesMap[selectedVariantId] || {};
    const newVariantOverridesMap = { ...variantOverridesMap };

    variants.forEach((v) => {
      newVariantOverridesMap[v.id] = { ...currentVariantSettings };
    });

    setVariantOverridesMap(newVariantOverridesMap);
    showToast("Variant settings applied to all other variants. Save to apply.", "success");
  };

  // Bulk Action: Reset All Variants to Inherit Product Settings
  const handleResetAllVariants = () => {
    const newVariantOverridesMap = { ...variantOverridesMap };

    variants.forEach((v) => {
      newVariantOverridesMap[v.id] = {};
      availablePaymentMethods.forEach((pm) => {
        newVariantOverridesMap[v.id][pm.id] = null;
      });
    });

    setVariantOverridesMap(newVariantOverridesMap);
    showToast("Reset all variants to Inherit settings. Save to apply.", "success");
  };

  // Bulk Action: Copy Product Settings to All Variants
  const handleCopyProductToAllVariants = () => {
    const newVariantOverridesMap = { ...variantOverridesMap };

    variants.forEach((v) => {
      newVariantOverridesMap[v.id] = {};
      availablePaymentMethods.forEach((pm) => {
        newVariantOverridesMap[v.id][pm.id] = productOverridesMap[pm.id] || null;
      });
    });

    setVariantOverridesMap(newVariantOverridesMap);
    showToast("Copied product level overrides to all variants. Save to apply.", "success");
  };

  if (isLoading) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2">
        <RefreshCw size={24} className="animate-spin text-[#E31E24]" />
        <span className="text-[13px] text-[#6B6B6B]">Loading payment configuration overrides...</span>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 text-center p-6">
        <AlertTriangle size={24} className="text-red-500" />
        <span className="text-[14px] font-semibold text-[#1A1A1A]">Failed to load payment configurations.</span>
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
      {/* Tab Header Instructions */}
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <h4 className="text-[13.5px] font-bold text-blue-900">Hierarchical Specificity Rule</h4>
            <p className="mt-1 text-[12.5px] text-blue-800 leading-relaxed">
              Modern Orthodontics filters checkout payment methods based on country and overrides:
              <br />
              <strong className="text-blue-900">Country settings are absolute:</strong> If a payment method is disabled globally or not supported for a country, it can never be enabled for a product or variant.
              <br />
              <strong className="text-blue-900">Precedence chain:</strong> Country Disallowed &rarr; Variant Overrides &rarr; Product Overrides &rarr; Inherit Country Setting.
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
          Product Level
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
          Variants Level ({variants.length})
        </button>
      </div>

      {/* Sub-Tab: Product */}
      {activeSubTab === "product" && (
        <div className="space-y-4">
          <div className="mb-2">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Payment Method Overrides</h3>
            <p className="text-[12.5px] text-[#9A9A9A]">Define payment restrictions that apply to all variants of this product by default.</p>
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
                      Inherit (Global)
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
                      Explicit Allow
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
                      Explicit Block
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="w-full sm:max-w-xs">
              <label className="block text-[12px] font-bold text-[#1A1A1A] mb-1.5 uppercase tracking-wider">Select Variant</label>
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              >
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title} {v.sku ? `(SKU: ${v.sku})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Bulk Actions */}
            <div className="flex flex-wrap gap-2 pt-4 sm:pt-0">
              <button
                type="button"
                onClick={handleCopyProductToAllVariants}
                className="flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
                title="Copy product level configurations to all variant maps"
              >
                <Copy size={14} />
                Copy Product settings
              </button>
              <button
                type="button"
                onClick={handleApplyVariantToAll}
                className="flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-bold text-gray-700 hover:bg-gray-50 shadow-sm"
                title="Apply current selected variant configuration settings to all other variants"
              >
                <Check size={14} />
                Apply to All
              </button>
              <button
                type="button"
                onClick={handleResetAllVariants}
                className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3.5 py-2 text-[12.5px] font-bold text-red-700 hover:bg-red-50/50 shadow-sm"
                title="Delete all custom variant level configurations and fallback to product inherit"
              >
                <Trash2 size={14} />
                Reset to Inherit
              </button>
            </div>
          </div>

          <hr className="my-2 border-t border-[#E6E6E6]" />

          {selectedVariantId ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {availablePaymentMethods.map((pm) => {
                const currentVariantOverrides = variantOverridesMap[selectedVariantId] || {};
                const currentState = currentVariantOverrides[pm.id] ?? null;

                // Parent resolved state helper
                const parentProductState = productOverridesMap[pm.id] ?? null;
                const parentStateLabel =
                  parentProductState === "ALLOW"
                    ? "Allowed"
                    : parentProductState === "BLOCK"
                    ? "Blocked"
                    : "Inherit (Global)";

                const parentBadgeClass =
                  parentProductState === "ALLOW"
                    ? "text-green-700 bg-green-50 border border-green-200"
                    : parentProductState === "BLOCK"
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
                        <span className="text-[11.5px] text-[#6b6b6b]">Parent Product Status:</span>
                        <span className={cn("rounded px-1.5 py-0.5 text-[10.5px] font-bold", parentBadgeClass)}>
                          {parentStateLabel}
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-1 rounded-lg border border-[#E6E6E6] bg-gray-50 p-1">
                      <button
                        type="button"
                        onClick={() => {
                          const currentSettings = variantOverridesMap[selectedVariantId] || {};
                          setVariantOverridesMap({
                            ...variantOverridesMap,
                            [selectedVariantId]: { ...currentSettings, [pm.id]: null },
                          });
                        }}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          currentState === null
                            ? "bg-white text-gray-800 shadow-sm border border-[#E6E6E6]"
                            : "text-gray-500 hover:text-gray-800"
                        )}
                      >
                        Inherit (Product)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSettings = variantOverridesMap[selectedVariantId] || {};
                          setVariantOverridesMap({
                            ...variantOverridesMap,
                            [selectedVariantId]: { ...currentSettings, [pm.id]: "ALLOW" },
                          });
                        }}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          currentState === "ALLOW"
                            ? "bg-green-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-green-600"
                        )}
                      >
                        Explicit Allow
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentSettings = variantOverridesMap[selectedVariantId] || {};
                          setVariantOverridesMap({
                            ...variantOverridesMap,
                            [selectedVariantId]: { ...currentSettings, [pm.id]: "BLOCK" },
                          });
                        }}
                        className={cn(
                          "flex-1 rounded-md py-1.5 text-center text-[12px] font-semibold transition-all",
                          currentState === "BLOCK"
                            ? "bg-red-600 text-white shadow-sm"
                            : "text-gray-500 hover:text-red-600"
                        )}
                      >
                        Explicit Block
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-[150px] items-center justify-center rounded-xl border border-dashed border-[#E6E6E6]">
              <span className="text-[13px] text-[#9A9A9A]">Add or select a variant to manage rules.</span>
            </div>
          )}
        </div>
      )}

      {/* Floating Save Actions Bar */}
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
              Saving Overrides…
            </>
          ) : (
            <>
              <Save size={14} />
              Save Payment Overrides
            </>
          )}
        </button>
      </div>
    </div>
  );
}
