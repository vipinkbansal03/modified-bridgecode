"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ChevronDown, Filter, Layers, SlidersHorizontal, Tag, ToggleLeft, Trash2, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminInput,
  AdminSelect,
  AdminDeleteModal,
  StatCard,
  AdminStatsGrid,
  AdminListToolbar,
  StatusBadge,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminAttributes,
  useAdminCategories,
  useAdminProductFilters,
  useUpdateProductFilters,
} from "@/hooks/admin/useAdminHooks";
import { useProductFacets } from "@/hooks/api/useProducts";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { getAdminErrorMessage } from "@/services/adminApi";
import { ATTRIBUTE_DISPLAY_TYPE_LABELS, type AttributeRole } from "@/lib/attributeUtils";
import type { ApiAttribute, ApiAttributeValue } from "@/types/api.types";

export interface ProductFilterConfig {
  id: string;
  featuredOnly: boolean;
  categoryFilterEnabled: boolean;
  attributeFilters: AttributeFilterConfig[];
}

export interface AttributeFilterConfig {
  attributeId: string;
  attributeName: string;
  enabled: boolean;
  displayType: "DROPDOWN" | "X_GRID" | "Y_GRID";
  sortOrder: number;
  allowedValueIds: string[];
}

type EditorMode = "edit" | null;

export default function ProductFiltersPage() {
  const { hasPermission } = useAdminAuth();
  const canManageFilters = hasPermission("attributes.update");

  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  const { data: attributes, isLoading: attrsLoading, refetch: refetchAttrs } = useAdminAttributes();
  const { data: categories, isLoading: catsLoading } = useAdminCategories();
  const { data: filterConfig, isLoading, refetch } = useAdminProductFilters();
  const updateFilters = useUpdateProductFilters();
  const { data: facets } = useProductFacets();
  const { showToast, ToastComponent } = useToast();

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingAttributeId, setEditingAttributeId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [displayType, setDisplayType] = useState<AttributeRole>("DROPDOWN");
  const [allowedValueIds, setAllowedValueIds] = useState<string[]>([]);
  const [roleWarnings, setRoleWarnings] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [featuredOnly, setFeaturedOnly] = useState(true);
  const [categoryFilterEnabled, setCategoryFilterEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Build the attribute-filter list from the actual storefront facets (what is shown on /products),
  // merged with any saved enabled/disabled state from the global config.
  const computedConfigs = useMemo(() => {
    const safeAttributes = attributes ?? [];
    const safeFacets = facets ?? [];

    const savedByName = new Map<string, AttributeFilterConfig>();
    (filterConfig?.attributeFilters ?? []).forEach((af: AttributeFilterConfig) => savedByName.set(af.attributeName, af));

    // Group facet values by attribute name
    const grouped = new Map<string, string[]>();
    (safeFacets as Array<{ attributeName: string; value: string }>).forEach((f) => {
      if (!grouped.has(f.attributeName)) grouped.set(f.attributeName, []);
      const arr = grouped.get(f.attributeName)!;
      if (!arr.includes(f.value)) arr.push(f.value);
    });

    if (grouped.size === 0) {
      // Fallback: when no live facets, show saved configs (if any)
      return (filterConfig?.attributeFilters ?? []).map((af: AttributeFilterConfig) => {
        const attr = safeAttributes.find((a: ApiAttribute) => a.id === af.attributeId || a.name === af.attributeName);
        return { ...af, id: af.attributeId, attribute: attr, values: (attr?.values ?? []).map((v: ApiAttributeValue) => v.value) };
      });
    }

    return Array.from(grouped.entries()).map(([attributeName, values]) => {
      const saved = savedByName.get(attributeName);
      const attr = safeAttributes.find((a: ApiAttribute) => a.name === attributeName);
      const allValueIds = (attr?.values ?? [])
        .filter((v: ApiAttributeValue) => values.includes(v.value))
        .map((v: ApiAttributeValue) => v.id);
      const allowed = saved?.allowedValueIds?.length ? saved.allowedValueIds : allValueIds;
      return {
        attributeId: attr?.id ?? attributeName,
        attributeName,
        id: attr?.id ?? attributeName,
        enabled: saved ? saved.enabled : true,
        displayType: (saved?.displayType ?? "DROPDOWN") as AttributeRole,
        sortOrder: saved?.sortOrder ?? 0,
        allowedValueIds: allowed,
        attribute: attr,
        values,
      };
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.attributeName.localeCompare(b.attributeName));
  }, [facets, filterConfig, attributes]);

  const [localFilters, setLocalFilters] = useState<typeof computedConfigs>([]);
  const hasInitialized = useRef(false);
  const isLoadingAll = isLoading || attrsLoading || catsLoading;

  const filterStats = useMemo(() => {
    const total = localFilters.length;
    const active = localFilters.filter((f: AttributeFilterConfig) => f.enabled).length;
    const disabled = localFilters.filter((f: AttributeFilterConfig) => !f.enabled).length;
    const totalValues = localFilters.reduce((acc: number, f: AttributeFilterConfig) => acc + (f.allowedValueIds?.length ?? 0), 0);
    return { total, active, disabled, totalValues };
  }, [localFilters]);

  useEffect(() => {
    if (!isLoadingAll && !hasInitialized.current) {
      setLocalFilters(computedConfigs);
      hasInitialized.current = true;
    }
  }, [isLoadingAll, computedConfigs]);

  useEffect(() => {
    if (filterConfig) {
      setFeaturedOnly(filterConfig.featuredOnly);
      setCategoryFilterEnabled(filterConfig.categoryFilterEnabled);
    }
  }, [filterConfig]);

  const resetEditorState = () => {
    setEditorMode(null);
    setEditingAttributeId(null);
    setName("");
    setEnabled(true);
    setDisplayType("DROPDOWN");
    setAllowedValueIds([]);
    setRoleWarnings([]);
  };

  const openEditModal = (attributeId: string) => {
    const config = localFilters.find((c: any) => c.attributeId === attributeId);
    if (config) {
      setName(config.attributeName);
      setEnabled(config.enabled);
      setDisplayType(config.displayType);
      setAllowedValueIds(config.allowedValueIds);
      setRoleWarnings([]);
    }
    setEditorMode("edit");
    setEditingAttributeId(attributeId);
  };

  const handleDisplayTypeChange = (nextType: AttributeRole) => {
    setDisplayType(nextType);
    const config = localFilters.find((c: any) => c.attributeId === editingAttributeId);
    if (config && config.attribute && nextType !== config.displayType) {
      setRoleWarnings([
        `${config.attribute.values.filter((v: { status: string }) => v.status !== "INACTIVE").length} active value(s) will keep working. The storefront renderer will switch automatically after you save.`,
      ]);
    } else {
      setRoleWarnings([]);
    }
  };

  const handleSaveAttributeFilter = () => {
    if (!editingAttributeId) return;
    setLocalFilters((prev: any[]) =>
      prev.map((c: any) =>
        c.attributeId === editingAttributeId
          ? { ...c, enabled, displayType, allowedValueIds }
          : c
      )
    );
    resetEditorState();
  };

  const handleDeleteAttributeFilter = () => {
    if (!deletingId) return;
    setLocalFilters((prev: any[]) =>
      prev.map((c: any) =>
        c.attributeId === deletingId ? { ...c, enabled: false } : c
      )
    );
    setDeletingId(null);
  };

  const buildConfigFromList = (list: typeof localFilters) => {
    const updatedConfig: ProductFilterConfig = {
      id: filterConfig?.id ?? "default",
      featuredOnly,
      categoryFilterEnabled,
      attributeFilters: list.map((item: any) => ({
        attributeId: item.attributeId,
        attributeName: item.attributeName,
        enabled: item.enabled,
        displayType: item.displayType,
        sortOrder: item.sortOrder,
        allowedValueIds: item.allowedValueIds,
      })),
    };
    return updatedConfig;
  };

  const handleBulkSave = async () => {
    setIsSaving(true);
    try {
      await updateFilters.mutateAsync(buildConfigFromList(localFilters));
      showToast("Filter settings saved.");
      hasInitialized.current = false;
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save filter settings."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const isEditorOpen = !!editorMode;

  return (
    <AdminLayout title="Product Filters" breadcrumb={[{ label: "Product Filters" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Filter Facets", value: filterStats.total, subtitle: "Storefront filter facets", icon: <SlidersHorizontal size={18} /> },
          { title: "Active Filter Facets", value: filterStats.active, subtitle: "Active on catalog sidebar", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
          { title: "Disabled Filters", value: filterStats.disabled, subtitle: "Hidden filter facets", icon: <XCircle size={18} />, color: "bg-gray-600" },
          { title: "Available Facet Values", value: filterStats.totalValues, subtitle: "Configured option choices", icon: <Tag size={18} />, color: "bg-blue-600" }
        ]}
        isLoading={isLoadingAll}
      />

      <AdminListToolbar
        leftExtra={
          <div className="flex flex-col gap-0.5">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Attribute Filters ({localFilters.length})</h3>
            <p className="text-[12.5px] text-[#6B6B6B]">
              Configure which filters appear on the storefront product listing page. Toggle each filter on or off.
            </p>
          </div>
        }
        refresh={{
          onRefresh: () => {
            hasInitialized.current = false;
            refetchAttrs();
            refetch();
          },
          isRefreshing: isLoadingAll,
        }}
        primaryAction={
          canManageFilters
            ? {
                onClick: handleBulkSave,
                label: isSaving || updateFilters.isPending ? "Saving..." : "Save All Changes",
                disabled: isSaving || updateFilters.isPending,
              }
            : undefined
        }
      />

      {isLoadingAll ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : (
        <>

          {localFilters.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
              No attribute filters are available on the storefront yet. Add attributes with values to products first.
            </div>
          ) : (
            <div className="space-y-3">
              {localFilters.map((config: any) => {
                const attr = config.attribute;
                return (
                  <div key={config.attributeId} className="flex w-full min-w-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E6E6E6] bg-white p-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[14px] font-semibold text-[#1A1A1A]">{config.attributeName}</span>
                        {attr && <AttributeRoleBadge role={attr.role} />}
                        <StatusBadge status={config.enabled ? "ACTIVE" : "INACTIVE"} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {(config.values as string[]).slice(0, 12).map((v: string) => (
                          <span
                            key={v}
                            className="rounded-full border border-[#E6E6E6] bg-[#F7F7F7] px-2.5 py-0.5 text-[11.5px] text-[#4A4A4A]"
                          >
                            {v}
                          </span>
                        ))}
                        {(config.values as string[]).length > 12 && (
                          <span className="text-[11.5px] text-[#9A9A9A]">+{(config.values as string[]).length - 12} more</span>
                        )}
                        {(config.values as string[]).length === 0 && (
                          <span className="text-[12px] text-[#9A9A9A]">No values on storefront</span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-[#6B6B6B]">
                        <span>Display: {ATTRIBUTE_DISPLAY_TYPE_LABELS[config.displayType as AttributeRole]}</span>
                        {config.allowedValueIds.length > 0 && config.allowedValueIds.length < (attr?.values?.length ?? 0) && (
                          <>
                            <span>•</span>
                            <span>{config.allowedValueIds.length} of {(attr?.values?.length ?? 0)} values allowed</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <label className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-brand"
                          checked={config.enabled}
                          disabled={!canManageFilters}
                          onChange={(e) => {
                            setLocalFilters((prev: any[]) =>
                              prev.map((c: any) =>
                                c.attributeId === config.attributeId
                                  ? { ...c, enabled: e.target.checked }
                                  : c
                              )
                            );
                          }}
                        />
                        <span className="text-[13px] text-[#1A1A1A]">Enabled</span>
                      </label>
                      <select
                        value={config.displayType}
                        disabled={!canManageFilters}
                        onChange={(e) => {
                          setLocalFilters((prev: any[]) =>
                            prev.map((c: any) =>
                              c.attributeId === config.attributeId
                                ? { ...c, displayType: e.target.value as AttributeRole }
                                : c
                            )
                          );
                        }}
                        className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
                      >
                        <option value="DROPDOWN">Dropdown</option>
                        <option value="X_GRID">Grid X Axis</option>
                        <option value="Y_GRID">Grid Y Axis</option>
                      </select>
                      {canManageFilters && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(config.attributeId)}
                            className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]"
                            title="Configure allowed values"
                          >
                            <SlidersHorizontal size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(config.attributeId)}
                            className="rounded p-1.5 text-red-500 hover:bg-red-50"
                            title="Hide filter"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <Modal
            open={isEditorOpen}
            onClose={resetEditorState}
            title="Configure Filter Values"
            panelClassName="max-h-[90vh] max-w-3xl overflow-y-auto"
          >
            <div className="p-6">
              {editorMode === "edit" && editingAttributeId ? (
                <>
                  <div className="space-y-4">
                    <AdminInput
                      label="Attribute Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Wire Size"
                      disabled
                    />
                    <AdminSelect
                      label="Filter Enabled"
                      value={enabled ? "true" : "false"}
                      onChange={(e) => setEnabled(e.target.value === "true")}
                      options={[
                        { value: "true", label: "Enabled" },
                        { value: "false", label: "Disabled" },
                      ]}
                    />
                    <AdminSelect
                      label="Display Type"
                      value={displayType}
                      onChange={(e) => handleDisplayTypeChange(e.target.value as AttributeRole)}
                      options={[
                        { value: "DROPDOWN", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.DROPDOWN },
                        { value: "X_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.X_GRID },
                        { value: "Y_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.Y_GRID },
                      ]}
                    />
                  </div>

                  {roleWarnings.length > 0 ? (
                    <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                      <svg className="mt-0.5 shrink-0" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      {roleWarnings.join(" ")}
                    </p>
                  ) : null}

                  <div className="mt-6 border-t border-[#E6E6E6] pt-6">
                    <div className="mb-4">
                      <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Allowed Values</h3>
                      <p className="mt-1.5 text-[12.5px] text-[#6B6B6B]">
                        Select which attribute values should be available as filter options. Uncheck to hide from filter.
                      </p>
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {localFilters
                        .find((c: any) => c.attributeId === editingAttributeId)
                        ?.attribute?.values?.map((value: ApiAttributeValue) => (
                          <label key={value.id} className="flex cursor-pointer items-center gap-2.5 rounded border border-[#F0F0F0] px-3 py-2 text-[13px] text-[#1A1A1A]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-brand"
                              checked={allowedValueIds.length === 0 || allowedValueIds.includes(value.id)}
                              onChange={(e) => {
                                const allIds = localFilters
                                  .find((c: any) => c.attributeId === editingAttributeId)
                                  ?.attribute?.values?.map((v: any) => v.id) ?? [];
                                
                                setAllowedValueIds((current) => {
                                  const initialList = current.length === 0 ? allIds : current;
                                  if (e.target.checked) {
                                    const next = [...initialList, value.id];
                                    if (next.length === allIds.length) return [];
                                    return next;
                                  } else {
                                    return initialList.filter((id: string) => id !== value.id);
                                  }
                                });
                              }}
                            />
                            <span className="truncate">{value.value}</span>
                            {value.status === "INACTIVE" && (
                              <span className="ml-auto rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[10px] font-medium text-[#9A9A9A]">
                                Inactive
                              </span>
                            )}
                          </label>
                        ))}
                      {(!localFilters.find((c: any) => c.attributeId === editingAttributeId)?.attribute?.values?.length) && (
                        <p className="text-[13px] text-[#9A9A9A]">No values defined for this attribute.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <LoadingButton
                      type="button"
                      onClick={handleSaveAttributeFilter}
                      loading={isSaving}
                      loadingText="Saving..."
                      className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                    >
                      Save
                    </LoadingButton>
                    <button type="button" onClick={resetEditorState} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center text-[#9A9A9A] py-8">Select a filter to configure</p>
              )}
            </div>
          </Modal>

          <AdminDeleteModal
            open={Boolean(deletingId)}
            onClose={() => setDeletingId(null)}
            itemName={attributes?.find((a: any) => a.id === deletingId)?.name || "Filter"}
            itemType="Product Filter"
            warningMessage="Choose the deletion method for this filter. This will remove the attribute from storefront navigation filters. The underlying attribute itself will not be deleted."
            softDeleteDescription={`Removes "${attributes?.find((a: any) => a.id === deletingId)?.name || "filter"}" from storefront facet filters.`}
            onSoftDelete={handleDeleteAttributeFilter}
            isSoftDeleting={updateFilters.isPending}
            initialDeleteType="soft"
          />

          {ToastComponent}
        </>
      )}
    </AdminLayout>
  );
}