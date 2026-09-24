"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { Calculator, Edit2, Plus, Trash2, X, Package, Globe, Truck, ShieldCheck, ShieldAlert, MapPin, Box } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  AdminStatsGrid,
  ConfirmModal,
  DataTable,
  Pagination,
  StatusBadge,
  Tooltip,
  useToast,
  type Column,
  AdminListToolbar,
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { ApiShippingBox } from "@/types/api.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminProducts, useAdminCountries, useAdminShippingProviders, useAdminShippingZones } from "@/hooks/admin/useAdminHooks";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";

type BoxFormState = {
  id: string;
  name: string;
  length: string;
  width: string;
  height: string;
  maxWeight: string;
  isActive: boolean;
  countryIds: string[];
};

const emptyForm: BoxFormState = {
  id: "",
  name: "",
  length: "",
  width: "",
  height: "",
  maxWeight: "",
  isActive: true,
  countryIds: [],
};

export default function ShippingBoxesPage() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("shipping.manage");
  const { showToast, ToastComponent } = useToast();
  const qc = useQueryClient();

  const { data: boxes = [], isLoading } = useQuery<ApiShippingBox[]>({
    queryKey: ["admin-shipping-boxes"],
    queryFn: () => adminApi.get("/shipping/boxes").then((r) => r.data.data),
  });
  const { data: providers = [] } = useAdminShippingProviders();
  const { data: zones = [] } = useAdminShippingZones();

  const upsertMutation = useMutation({
    mutationFn: async (vars: { id?: string; data: Record<string, unknown> }) =>
      vars.id ? adminApi.put(`/shipping/boxes/${vars.id}`, vars.data) : adminApi.post("/shipping/boxes", vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/shipping/boxes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.post(`/shipping/boxes/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (data: { ids: string[]; action: "ENABLE" | "DISABLE" | "DELETE" }) =>
      adminApi.post("/shipping/boxes/bulk", data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Search, filter, sorting, and pagination
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "weight" | "volume">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const totals = useMemo(() => {
    const total = boxes.length;
    const active = boxes.filter((b) => b.isActive).length;
    const inactive = total - active;
    const countrySet = new Set<string>();
    boxes.forEach((b) => {
      (b.countries || []).forEach((c) => {
        if (c.country?.code) countrySet.add(c.country.code);
      });
    });
    return {
      total,
      active,
      inactive,
      supportedCountries: countrySet.size,
    };
  }, [boxes]);

  const filteredBoxes = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const result = boxes.filter((box) => {
      const boxName = (box.name || "").toLowerCase();
      const dims = `${box.length}x${box.width}x${box.height}`;
      const countryCodes = (box.countries || []).map((c) => c.country?.code || "").join(" ").toLowerCase();
      const matchesSearch = !query || boxName.includes(query) || dims.includes(query) || countryCodes.includes(query);
      const matchesStatus =
        !statusFilter ||
        (statusFilter === "ACTIVE" && box.isActive) ||
        (statusFilter === "INACTIVE" && !box.isActive);

      return matchesSearch && matchesStatus;
    });

    result.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortBy === "weight") {
        return (Number(a.maxWeight || 0) - Number(b.maxWeight || 0)) * direction;
      }
      if (sortBy === "volume") {
        const volA = Number(a.length || 0) * Number(a.width || 0) * Number(a.height || 0);
        const volB = Number(b.length || 0) * Number(b.width || 0) * Number(b.height || 0);
        return (volA - volB) * direction;
      }
      return (a.name || "").localeCompare(b.name || "") * direction;
    });

    return result;
  }, [boxes, debouncedSearch, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredBoxes.length / pageSize));
  const paginatedBoxes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredBoxes.slice(start, start + pageSize);
  }, [filteredBoxes, page, pageSize]);

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "delete") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected shipping box(es)? This action cannot be undone.`)) {
        return;
      }
    }

    setBulkSaving(true);
    try {
      await bulkMutation.mutateAsync({
        ids: selectedIds,
        action: bulkAction === "delete" ? "DELETE" : bulkAction === "activate" ? "ENABLE" : "DISABLE",
      });
      showToast(
        bulkAction === "delete" ? "Shipping boxes deleted." : bulkAction === "activate" ? "Shipping boxes activated." : "Shipping boxes paused."
      );
      setSelectedIds([]);
      setBulkAction("");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to run bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const [formOpen, setFormOpen] = useState(false);
  const [deletingBox, setDeletingBox] = useState<ApiShippingBox | null>(null);

  const [activeSubTab, setActiveSubTab] = useState<"boxes" | "preview">("boxes");

  const { data: productsData } = useAdminProducts({ limit: 200, status: "ACTIVE" });
  const products = useMemo(() => (productsData?.data ?? []) as { id: string; title: string }[], [productsData]);
  const { data: countries = [] } = useAdminCountries();

  const [previewProductId, setPreviewProductId] = useState("");
  const [previewQuantity, setPreviewQuantity] = useState("1");
  const [previewCountryId, setPreviewCountryId] = useState("");
  const [previewOrderTotal, setPreviewOrderTotal] = useState("");
  const [previewItems, setPreviewItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
    setPage(1);
  }, [activeSubTab]);

  useEffect(() => {
    let cancelled = false;

    if (!previewItems.length) {
      setPreviewResult(null);
      return;
    }

    const calculate = async () => {
      setPreviewLoading(true);
      try {
        const res = await adminApi.post("/shipping/calculate-packages", {
          items: previewItems,
          countryCode: previewCountryId || undefined,
          orderTotal: previewOrderTotal ? Number(previewOrderTotal) : undefined,
        });
        if (!cancelled) setPreviewResult(res.data.data);
      } catch (error) {
        if (!cancelled) showToast(getAdminErrorMessage(error, "Calculation failed."), "error");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    };

    const debounce = setTimeout(calculate, 300);
    return () => {
      cancelled = true;
      clearTimeout(debounce);
    };
  }, [previewItems, previewCountryId, previewOrderTotal]);

  const form = useAdminForm<BoxFormState>({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name.trim()) errors.name = "Box name is required.";
      if (!values.length || Number(values.length) <= 0) errors.length = "Length is required.";
      if (!values.width || Number(values.width) <= 0) errors.width = "Width is required.";
      if (!values.height || Number(values.height) <= 0) errors.height = "Height is required.";
      if (!values.maxWeight || Number(values.maxWeight) <= 0) errors.maxWeight = "Max weight is required.";
      if (!values.countryIds.length) errors.countryIds = "At least one country is required.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const payload = {
        name: values.name.trim(),
        length: Number(values.length),
        width: Number(values.width),
        height: Number(values.height),
        maxWeight: Number(values.maxWeight),
        isActive: values.isActive,
        countryIds: values.countryIds,
      };
      try {
        await upsertMutation.mutateAsync({ id: values.id || undefined, data: payload });
        showToast(values.id ? "Box updated." : "Box created.");
        setFormOpen(false);
        resetForm();
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save box."), "error");
      }
    }
  });

  const openCreate = () => {
    form.reset(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (box: ApiShippingBox) => {
    form.reset({
      id: box.id,
      name: box.name,
      length: String(box.length),
      width: String(box.width),
      height: String(box.height),
      maxWeight: String(box.maxWeight),
      isActive: box.isActive,
      countryIds: box.countries?.map((c) => c.countryId) ?? [],
    });
    setFormOpen(true);
  };

  const columns: Column<ApiShippingBox>[] = useMemo(() => [
    { key: "name", label: "Box Name" },
    {
      key: "length", label: "L × W × H (cm)",
      render: (row) => `${row.length} × ${row.width} × ${row.height}`,
    },
    {
      key: "maxWeight", label: "Max Weight (kg)",
      render: (row) => row.maxWeight,
    },
    {
      key: "countries", label: "Countries",
      render: (row) => row.countries?.map((c) => c.country.code).join(", ") || "—",
    },
    {
      key: "isActive",
      label: "Status",
      render: (row) => (
        <Tooltip content={row.isActive ? "Active box (used for automated packing calculations)" : "Inactive box (disabled)"} side="top">
          <span className="inline-block cursor-default">
            <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />
          </span>
        </Tooltip>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "160px",
      align: "left",
      render: (row) => (
        <AdminRowActions
          edit={
            canManage
              ? {
                  onClick: () => openEdit(row),
                  title: "Edit box dimensions",
                }
              : undefined
          }
          extra={
            canManage ? (
              <Tooltip
                content={row.isActive ? "Click to deactivate box" : "Click to activate box"}
                side="top"
              >
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await toggleMutation.mutateAsync(row.id);
                      showToast(`${row.name} ${row.isActive ? "deactivated" : "activated"}.`);
                    } catch (error) {
                      showToast(getAdminErrorMessage(error, "Toggle failed."), "error");
                    }
                  }}
                  disabled={toggleMutation.isPending}
                  className={cn(
                    "flex h-7 items-center justify-center rounded-md border px-2.5 text-[12px] font-medium transition-colors shadow-2xs cursor-pointer",
                    row.isActive
                      ? "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
                      : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  )}
                >
                  {row.isActive ? "Deactivate" : "Activate"}
                </button>
              </Tooltip>
            ) : undefined
          }
          delete={
            canManage
              ? {
                  onClick: () => setDeletingBox(row),
                  title: "Delete box",
                }
              : undefined
          }
        />
      ),
    },
  ], [canManage, toggleMutation, showToast]);

  return (
    <AdminLayout title="Package/Box Management" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Boxes" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs (Parent) */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/shipping"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Truck size={15} />
            <span>Providers</span>
            {providers.length > 0 && (
              <span className="ml-1 rounded-full bg-[#F0F0F0] text-[#666] px-2 py-0.5 text-[11px] font-semibold">
                {providers.length}
              </span>
            )}
          </Link>
          <Link
            href="/admin/shipping/zones"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Globe size={15} />
            <span>Zones</span>
            {zones.length > 0 && (
              <span className="ml-1 rounded-full bg-[#F0F0F0] text-[#666] px-2 py-0.5 text-[11px] font-semibold">
                {zones.length}
              </span>
            )}
          </Link>
          <Link
            href="/admin/shipping/boxes"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Package size={15} />
            <span>Boxes</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {totals.total}
            </span>
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Boxes", value: totals.total, subtitle: "Configured package sizes", icon: <Package size={18} />, isLoading },
            { title: "Active Boxes", value: totals.active, subtitle: "Available for automated packing", icon: <ShieldCheck size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Inactive Boxes", value: totals.inactive, subtitle: "Disabled sizes", icon: <ShieldAlert size={18} />, color: "bg-slate-600", isLoading },
            { title: "Supported Destinations", value: totals.supportedCountries, subtitle: "Assigned countries", icon: <MapPin size={18} />, color: "bg-sky-600", isLoading }
          ]}
        />

        {/* Sub-view switcher tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6]">
          <button
            type="button"
            onClick={() => setActiveSubTab("boxes")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors cursor-pointer",
              activeSubTab === "boxes"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            )}
          >
            <Package size={15} />
            <span>Package Size</span>
            <span className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              activeSubTab === "boxes" ? "bg-[#E31E24]/10 text-[#E31E24]" : "bg-[#F3F4F6] text-[#6B7280]"
            )}>
              {totals.total}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("preview")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-[13.5px] font-semibold border-b-2 transition-colors cursor-pointer",
              activeSubTab === "preview"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-[#6B7280] hover:text-[#111827]"
            )}
          >
            <Calculator size={15} />
            <span>Package Preview</span>
          </button>
        </div>

        {activeSubTab === "boxes" ? (
          <div className="space-y-5">
            <AdminListToolbar
              search={{
                value: search,
                onChange: (val) => {
                  setSearch(val);
                  setPage(1);
                },
                placeholder: "Search box name, dimensions, country...",
                widthClassName: "w-[280px]",
              }}
              filters={{
                showFilters,
                onToggle: () => setShowFilters(!showFilters),
                activeCount: [statusFilter, sortBy !== "name" ? sortBy : "", sortDir !== "asc" ? sortDir : ""].filter(Boolean).length,
              }}
              refresh={{
                onRefresh: () => void qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] }),
                isRefreshing: isLoading,
              }}
              primaryAction={
                canManage
                  ? {
                      onClick: openCreate,
                      label: "Add Box",
                      icon: <Plus size={14} />,
                    }
                  : undefined
              }
              onResetFilters={() => {
                setSearch("");
                setStatusFilter("");
                setSortBy("name");
                setSortDir("asc");
                setPage(1);
              }}
              filterPanel={
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <AdminSelect
                    label="Status"
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "All Statuses" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                    ]}
                  />
                  <AdminSelect
                    label="Sort By"
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value as "name" | "weight" | "volume");
                      setPage(1);
                    }}
                    options={[
                      { value: "name", label: "Box Name" },
                      { value: "weight", label: "Max Weight" },
                      { value: "volume", label: "Volume (Dimensions)" },
                    ]}
                  />
                  <AdminSelect
                    label="Direction"
                    value={sortDir}
                    onChange={(e) => {
                      setSortDir(e.target.value as "asc" | "desc");
                      setPage(1);
                    }}
                    options={[
                      { value: "asc", label: "Ascending" },
                      { value: "desc", label: "Descending" },
                    ]}
                  />
                </div>
              }
            />

            {/* DataTable in rounded-xl container with Bottom Pagination */}
            <div>
              <DataTable<ApiShippingBox>
                title="Boxes List"
                columns={columns}
                data={paginatedBoxes}
                isLoading={isLoading}
                rowKey="id"
                emptyMessage="No shipping boxes configured."
                enableSelection={true}
                selectedIds={selectedIds}
                onSelectionChange={setSelectedIds}
                totalItems={filteredBoxes.length}
                currentPage={page}
                pageSize={pageSize}
                totalPages={totalPages}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                renderBulkActions={(selectedIds) => (
                  <AdminBulkActionsBar
                    selectedCount={selectedIds.length}
                    onClear={() => setSelectedIds([])}
                    actionType={bulkAction}
                    onActionTypeChange={setBulkAction}
                    actions={[
                      { value: "activate", label: "Mark active" },
                      { value: "deactivate", label: "Mark inactive" },
                      { value: "delete", label: "Delete selected" }
                    ]}
                    onApply={handleBulkAction}
                    applyLoading={bulkSaving}
                    applyDisabled={!bulkAction || selectedIds.length === 0}
                  />
                )}
              />
              <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  alwaysShow={true}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Package Preview</h3>
                <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">Add items to see which box fits and the estimated shipping charge.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <AdminSelect
                  label="Product"
                  value={previewProductId}
                  onChange={(e) => setPreviewProductId(e.target.value)}
                  options={[{ value: "", label: "Select product..." }, ...products.map((p) => ({ value: p.id, label: p.title }))]}
                />
                <AdminInput label="Quantity" type="text" value={previewQuantity} onChange={(e) => setPreviewQuantity(e.target.value)} />
                <AdminSearchableSelect
                  label="Country (for charge)"
                  value={previewCountryId}
                  onChange={(e) => setPreviewCountryId(e.target.value)}
                  options={[{ value: "", label: "Optional..." }, ...(countries as { id: string; name: string; code: string }[]).map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))]}
                  placeholder="Optional..."
                  showSearch
                />
                <AdminInput label="Order Total (for free-shipping threshold)" type="text" value={previewOrderTotal} onChange={(e) => setPreviewOrderTotal(e.target.value)} />
              </div>
              <button
                type="button"
                onClick={() => {
                  if (previewProductId && previewQuantity) {
                    setPreviewItems((prev) => [...prev, { productId: previewProductId, quantity: Math.max(1, Number(previewQuantity) || 1) }]);
                    setPreviewProductId("");
                    setPreviewQuantity("1");
                  }
                }}
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
              >
                Add Item
              </button>
              {previewItems.length > 0 && (
                <div className="space-y-2">
                  {previewItems.map((item, idx) => {
                    const p = products.find((x) => x.id === item.productId);
                    return (
                      <div key={idx} className="flex items-center justify-between rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px]">
                        <span className="truncate pr-2">{p?.title ?? item.productId}</span>
                        <span className="flex items-center gap-2">
                          <span className="text-[#9A9A9A]">×{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setPreviewItems((prev) => prev.filter((_, i) => i !== idx))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X size={14} />
                          </button>
                        </span>
                      </div>
                    );
                  })}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!previewItems.length) return;
                        setPreviewLoading(true);
                        try {
                          const res = await adminApi.post("/shipping/calculate-packages", {
                            items: previewItems,
                            countryCode: previewCountryId || undefined,
                            orderTotal: previewOrderTotal ? Number(previewOrderTotal) : undefined,
                          });
                          setPreviewResult(res.data.data);
                        } catch (error) {
                          showToast(getAdminErrorMessage(error, "Calculation failed."), "error");
                        } finally {
                          setPreviewLoading(false);
                        }
                      }}
                      disabled={previewLoading}
                      className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-semibold text-white hover:bg-black disabled:opacity-60"
                    >
                      {previewLoading ? "Calculating..." : "Calculate Package"}
                    </button>
                  </div>
                )}
              </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
              {previewResult ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-[13px] font-semibold text-[#1A1A1A]">Total Weight</h4>
                    <p className="text-[24px] font-bold text-[#E31E24]">{Number(previewResult.totalWeight || 0).toFixed(3)} kg</p>
                  </div>
                  <div>
                    <h4 className="text-[13px] font-semibold text-[#1A1A1A]">Total Volume</h4>
                    <p className="text-[14px] text-[#1A1A1A]">{Number(previewResult.totalVolume || 0).toFixed(2)} cm³</p>
                  </div>
                  <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                    {previewResult.boxes?.length ? (
                      <>
                        <h4 className="text-[13px] font-semibold text-[#1A1A1A]">Boxes ({previewResult.boxes.length})</h4>
                        <div className="mt-2 space-y-2">
                          {previewResult.boxes.map((b: any, idx: number) => (
                            <div key={idx} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                              <p className="text-[14px] font-semibold text-[#1A1A1A]">
                                {idx + 1}. {b.name}
                              </p>
                              <p className="text-[12.5px] text-[#6B6B6B]">
                                {b.length} × {b.width} × {b.height} cm | {Number(b.weight).toFixed(3)} kg | {Number(b.volume).toFixed(2)} cm³
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="text-[13px] text-[#9A9A9A]">No active box fits this shipment for the selected country. Add a box with suitable dimensions.</p>
                    )}
                  </div>
                  {previewResult.pricing && (
                    <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                      <h4 className="text-[13px] font-semibold text-[#1A1A1A]">Shipping Charge</h4>
                      {previewResult.pricing.available ? (
                        <>
                          <p className="mt-1 text-[18px] font-bold text-[#1A1A1A]">
                            {previewResult.pricing.isFree ? "FREE" : `${previewResult.pricing.charge}`}
                          </p>
                          <p className="text-[12.5px] text-[#6B6B6B]">
                            {previewResult.pricing.provider ?? "Standard"} {previewResult.pricing.isFree ? "(free shipping threshold met)" : ""}
                            {previewResult.pricing.estimatedDays ? ` | ${previewResult.pricing.estimatedDays} days` : ""}
                          </p>
                        </>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#9A9A9A]">{previewResult.pricing.message ?? "No shipping available for this country."}</p>
                      )}
                    </div>
                  )}
                  <div>
                    <h4 className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Item Breakdown</h4>
                    <div className="space-y-1.5">
                      {previewResult.items.map((it: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between rounded-md border border-[#E6E6E6] px-3 py-2 text-[12.5px]">
                          <span className="truncate pr-2">{it.title}</span>
                          <span className="text-[#6B6B6B]">
                            ×{it.quantity} | {Number(it.weight).toFixed(3)} kg | {it.length}×{it.width}×{it.height} cm
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-center text-[13px] text-[#9A9A9A] py-10">Add items and click &quot;Calculate Package&quot; to see results.</p>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.values.id ? "Edit Box" : "Add Box"}
        subtitle="Define package box dimensions, capacity, and country availability for shipping calculations."
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="shipping-box-form"
              loading={form.isSubmitting || upsertMutation.isPending}
              loadingText="Saving..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              {form.values.id ? "Update Box" : "Create Box"}
            </LoadingButton>
          </div>
        }
      >
        <form id="shipping-box-form" onSubmit={form.handleSubmit} className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AdminInput required label="Box Name" placeholder="e.g. Small Box, Medium Box" {...form.getFieldProps("name")} error={form.errors.name as string} />
            </div>
            <AdminInput required label="Length (cm)" type="text" placeholder="e.g. 30" name="length" value={form.values.length} onChange={(e) => form.setFieldValue("length", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.length as string} />
            <AdminInput required label="Width (cm)" type="text" placeholder="e.g. 20" name="width" value={form.values.width} onChange={(e) => form.setFieldValue("width", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.width as string} />
            <AdminInput required label="Height (cm)" type="text" placeholder="e.g. 15" name="height" value={form.values.height} onChange={(e) => form.setFieldValue("height", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.height as string} />
            <AdminInput required label="Max Weight (kg)" type="text" placeholder="e.g. 5" name="maxWeight" value={form.values.maxWeight} onChange={(e) => form.setFieldValue("maxWeight", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.maxWeight as string} />
            <div className="sm:col-span-2 flex flex-col">
              <AdminMultiSearchableSelect
                label="Countries"
                options={(countries as { id: string; name: string; code: string }[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                values={form.values.countryIds}
                onValuesChange={(vals) => form.setFieldValue("countryIds", vals)}
                allowSelectAll
                selectAllLabel="Select All"
                emptyMeansAll={false}
                placeholder="Select countries..."
              />
              {form.errors.countryIds && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.countryIds as string}</span>}
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.values.isActive}
                  onChange={(e) => form.setFieldValue("isActive", e.target.checked)}
                  className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24] cursor-pointer"
                />
                <span className="text-[13.5px] text-[#1A1A1A]">Active</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {deletingBox && (
        <ConfirmModal
          open={!!deletingBox}
          title="Delete Box"
          message={`Are you sure you want to delete "${deletingBox.name}"? This action cannot be undone.`}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(deletingBox.id);
              showToast("Box deleted.");
            } catch (error) {
              showToast(getAdminErrorMessage(error, "Failed to delete box."), "error");
            } finally {
              setDeletingBox(null);
            }
          }}
          onCancel={() => setDeletingBox(null)}
          isLoading={deleteMutation.isPending}
        />
      )}

      {ToastComponent}
    </AdminLayout>
  );
}
