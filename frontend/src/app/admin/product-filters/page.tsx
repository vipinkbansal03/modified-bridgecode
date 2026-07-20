"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Filter, SlidersHorizontal, ToggleLeft, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  StatusBadge,
  useToast,
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
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  const { data: attributes = [], isLoading: attrsLoading, refetch: refetchAttrs } = useAdminAttributes();
  const { data: categories = [], isLoading: catsLoading } = useAdminCategories();
  const { data: filterConfig, isLoading, refetch } = useAdminProductFilters();
  const updateFilters = useUpdateProductFilters();
  const { data: facets = [] } = useProductFacets();
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
  const attributeFilterConfigs = useMemo(() => {
    const savedByName = new Map<string, AttributeFilterConfig>();
    (filterConfig?.attributeFilters ?? []).forEach((af: AttributeFilterConfig) => savedByName.set(af.attributeName, af));

    // Group facet values by attribute name
    const grouped = new Map<string, string[]>();
    (facets as Array<{ attributeName: string; value: string }>).forEach((f) => {
      if (!grouped.has(f.attributeName)) grouped.set(f.attributeName, []);
      const arr = grouped.get(f.attributeName)!;
      if (!arr.includes(f.value)) arr.push(f.value);
    });

    if (grouped.size === 0) {
      // Fallback: when no live facets, show saved configs (if any)
      return (filterConfig?.attributeFilters ?? []).map((af: AttributeFilterConfig) => {
        const attr = attributes.find((a: ApiAttribute) => a.id === af.attributeId || a.name === af.attributeName);
        return { ...af, id: af.attributeId, attribute: attr, values: attr?.values ?? [] };
      });
    }

    return Array.from(grouped.entries()).map(([attributeName, values]) => {
      const saved = savedByName.get(attributeName);
      const attr = attributes.find((a: ApiAttribute) => a.name === attributeName);
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
    const config = attributeFilterConfigs.find((c: typeof attributeFilterConfigs[0]) => c.attributeId === attributeId);
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
    const config = attributeFilterConfigs.find((c: typeof attributeFilterConfigs[0]) => c.attributeId === editingAttributeId);
    if (config && config.attribute && nextType !== config.displayType) {
      setRoleWarnings([
        `${config.attribute.values.filter((v: { status: string }) => v.status !== "INACTIVE").length} active value(s) will keep working. The storefront renderer will switch automatically after you save.`,
      ]);
    } else {
      setRoleWarnings([]);
    }
  };

  const handleSaveAttributeFilter = async () => {
    if (!editingAttributeId) return;
    setIsSaving(true);
    try {
      const currentConfig = filterConfig?.attributeFilters.find((af: AttributeFilterConfig) => af.attributeId === editingAttributeId);
      if (!currentConfig) throw new Error("Configuration not found");

      const updatedConfig: ProductFilterConfig = {
        id: filterConfig?.id ?? "default",
        featuredOnly,
        categoryFilterEnabled,
        attributeFilters: filterConfig?.attributeFilters.map((af: AttributeFilterConfig) =>
          af.attributeId === editingAttributeId
            ? { ...af, enabled, displayType, allowedValueIds }
            : af
        ) ?? [],
      };

      await updateFilters.mutateAsync(updatedConfig);
      showToast("Filter configuration saved.");
      resetEditorState();
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save filter configuration."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAttributeFilter = async () => {
    if (!deletingId) return;
    try {
      const updatedConfig: ProductFilterConfig = {
        id: filterConfig?.id ?? "default",
        featuredOnly,
        categoryFilterEnabled,
        attributeFilters: attributeFilterConfigs.map((item: typeof attributeFilterConfigs[0]) =>
          item.attributeId === deletingId ? { ...item, enabled: false } : item
        ),
      };
      await updateFilters.mutateAsync(updatedConfig);
      showToast("Filter hidden from storefront.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to hide filter."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const buildConfigFromList = (list: typeof attributeFilterConfigs) => {
    const updatedConfig: ProductFilterConfig = {
      id: filterConfig?.id ?? "default",
      featuredOnly,
      categoryFilterEnabled,
      attributeFilters: list.map((item: typeof attributeFilterConfigs[0]) => ({
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

  const handleBulkSaveWith = async (list: typeof attributeFilterConfigs = attributeFilterConfigs) => {
    setIsSaving(true);
    try {
      await updateFilters.mutateAsync(buildConfigFromList(list));
      showToast("Filter settings saved.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save filter settings."), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleBulkSave = async () => {
    await handleBulkSaveWith(attributeFilterConfigs);
  };

  const isEditorOpen = !!editorMode;
  const isLoadingAll = isLoading || attrsLoading || catsLoading;

  return (
    <AdminLayout title="Product Filters" breadcrumb={[{ label: "Product Filters" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">
          Configure which filters appear on the storefront product listing page. Toggle each filter on or off.
        </p>
      </div>

      {isLoadingAll ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Attribute Filters ({attributeFilterConfigs.length})</h3>
              <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">These are the filters currently shown on the storefront <span className="font-medium text-[#6B6B6B]">/products</span> page. Toggle to show or hide each one.</p>
            </div>
            <button
              type="button"
              onClick={handleBulkSave}
              disabled={isSaving || updateFilters.isPending}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
            >
              {isSaving || updateFilters.isPending ? "Saving..." : "Save All Changes"}
            </button>
          </div>

          {attributeFilterConfigs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
              No attribute filters are available on the storefront yet. Add attributes with values to products first.
            </div>
          ) : (
            <div className="space-y-3">
              {attributeFilterConfigs.map((config: typeof attributeFilterConfigs[0]) => {
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
                          onChange={(e) => {
                            const updated = [...attributeFilterConfigs];
                            const idx = updated.findIndex((c) => c.attributeId === config.attributeId);
                            if (idx !== -1) updated[idx] = { ...updated[idx], enabled: e.target.checked };
                            handleBulkSaveWith(updated);
                          }}
                        />
                        <span className="text-[13px] text-[#1A1A1A]">Enabled</span>
                      </label>
                      <select
                        value={config.displayType}
                        onChange={(e) => {
                          const updated = [...attributeFilterConfigs];
                          const idx = updated.findIndex((c) => c.attributeId === config.attributeId);
                          if (idx !== -1) updated[idx] = { ...updated[idx], displayType: e.target.value as AttributeRole };
                          handleBulkSaveWith(updated);
                        }}
                        className="rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[12.5px] outline-none"
                      >
                        <option value="DROPDOWN">Dropdown</option>
                        <option value="X_GRID">Grid X Axis</option>
                        <option value="Y_GRID">Grid Y Axis</option>
                      </select>
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
            {editorMode === "edit" && editingAttributeId ? (
              <>
                <div className="space-y-3">
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
                  <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                    <svg className="mt-0.5 shrink-0" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    {roleWarnings.join(" ")}
                  </p>
                ) : null}

                <div className="mt-5 border-t border-[#E6E6E6] pt-5">
                  <div className="mb-3">
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Allowed Values</h3>
                    <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
                      Select which attribute values should be available as filter options. Uncheck to hide from filter.
                    </p>
                  </div>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {attributeFilterConfigs
                      .find((c: typeof attributeFilterConfigs[0]) => c.attributeId === editingAttributeId)
                      ?.attribute?.values?.map((value: ApiAttributeValue) => (
                        <label key={value.id} className="flex cursor-pointer items-center gap-2.5 rounded border border-[#F0F0F0] px-3 py-2 text-[13px] text-[#1A1A1A]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand"
                            checked={allowedValueIds.includes(value.id) || allowedValueIds.length === 0}
                            onChange={(e) =>
                              setAllowedValueIds((current) =>
                                e.target.checked
                                  ? current.filter((id) => id !== value.id)
                                  : [...current, value.id]
                              )
                            }
                          />
                          <span className="truncate">{value.value}</span>
                          {value.status === "INACTIVE" && (
                            <span className="ml-auto rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[10px] font-medium text-[#9A9A9A]">
                              Inactive
                            </span>
                          )}
                        </label>
                      ))}
                    {(!attributeFilterConfigs.find((c: typeof attributeFilterConfigs[0]) => c.attributeId === editingAttributeId)?.attribute?.values?.length) && (
                      <p className="text-[13px] text-[#9A9A9A]">No values defined for this attribute.</p>
                    )}
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAttributeFilter}
                    disabled={isSaving}
                    className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={resetEditorState} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <p className="text-center text-[#9A9A9A] py-8">Select a filter to configure</p>
            )}
          </Modal>

          <ConfirmModal
            open={!!deletingId}
            title="Remove filter?"
            message="This will remove the attribute from the storefront filters. The attribute itself will not be deleted."
            onConfirm={handleDeleteAttributeFilter}
            onCancel={() => setDeletingId(null)}
          />

          {ToastComponent}
        </>
      )}
    </AdminLayout>
  );
}