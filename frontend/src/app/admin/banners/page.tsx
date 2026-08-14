"use client";

import { useMemo, useState, useCallback } from "react";
import { ArrowLeft, Edit2, GripVertical, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { AdminInput, AdminSelect, ConfirmModal, StatusBadge, useToast, LoadingButton, DataTable, TableStatusAction } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Modal } from "@/components/ui/Modal";
import { useAdminBanners, useAdminCountries, useBulkBanners, useCreateBanner, useDeleteBanner, useReorderBanners, useUpdateBanner } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { uploadMediaFiles } from "@/utils/uploadMedia";

type Banner = {
  id: string;
  title: string;
  image: string;
  mobileImage?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  placement: string;
  countryId?: string | null;
  country?: { code: string; name: string } | null;
  sortOrder: number;
  status: boolean;
  startDate?: string | null;
  endDate?: string | null;
};

const placements = ["", "HOMEPAGE_HERO", "HOMEPAGE_PROMO", "CATEGORY_TOP", "PRODUCT_TOP", "SIDEBAR"];
const empty = {
  id: "",
  title: "",
  image: "",
  mobileImage: "",
  linkUrl: "",
  linkText: "",
  placement: "HOMEPAGE_HERO",
  countryId: "",
  countryIds: [] as string[],
  status: true,
  startDate: "",
  endDate: "",
};

const PLACEMENT_DESCRIPTIONS: Record<string, string> = {
  "": "Showing all promotional banners across all Storefront placements.",
  HOMEPAGE_HERO: "Controls the main promotional hero carousel at the top of the Homepage. At least 1 Homepage Hero banner must remain active at all times.",
  HOMEPAGE_PROMO: "Controls promotional banners displayed within the Homepage body content.",
  CATEGORY_TOP: "Controls promotional banners displayed above Product & Category listings.",
  PRODUCT_TOP: "Controls promotional banners displayed at the top of Product Detail pages.",
  SIDEBAR: "Controls promotional banners displayed inside the Product Filter sidebar.",
};

export default function BannersPage() {
  const [placement, setPlacement] = useState("");
  const [form, setForm] = useState(empty);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"image" | "mobileImage" | null>(null);

  const { showToast, ToastComponent } = useToast();
  const { data: allBannersData = [] } = useAdminBanners({});
  const { data = [], isLoading } = useAdminBanners({ placement });
  const { data: countries = [] } = useAdminCountries();

  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const reorderBanners = useReorderBanners();
  const bulkBanners = useBulkBanners();

  const allBanners = (allBannersData ?? []) as Banner[];
  const banners = useMemo(() => ((data ?? []) as Banner[]).slice().sort((a, b) => a.sortOrder - b.sortOrder), [data]);

  const placementCounts = useMemo(() => {
    const counts: Record<string, number> = { "": allBanners.length };
    for (const b of allBanners) {
      counts[b.placement] = (counts[b.placement] || 0) + 1;
    }
    return counts;
  }, [allBanners]);

  const toggleStatus = useCallback(
    async (row: Banner) => {
      const selectedCountries = row.countryId ? [row.countryId] : [];
      const basePayload = {
        id: row.id,
        title: row.title,
        image: row.image,
        mobileImage: row.mobileImage || null,
        linkUrl: row.linkUrl || null,
        linkText: row.linkText || null,
        placement: row.placement,
        countryIds: selectedCountries,
        countryId: row.countryId || null,
        status: !row.status,
        startDate: row.startDate?.slice(0, 10) || null,
        endDate: row.endDate?.slice(0, 10) || null,
      };
      try {
        await updateBanner.mutateAsync(basePayload);
        showToast("Status updated.");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to update status."), "error");
      }
    },
    [updateBanner, showToast]
  );

  const edit = useCallback((row: Banner) => {
    setForm({
      id: row.id,
      title: row.title,
      image: row.image,
      mobileImage: row.mobileImage ?? "",
      linkUrl: row.linkUrl ?? "",
      linkText: row.linkText ?? "",
      placement: row.placement,
      countryId: row.countryId ?? "",
      countryIds: row.countryId ? [row.countryId] : [],
      status: row.status,
      startDate: row.startDate?.slice(0, 10) ?? "",
      endDate: row.endDate?.slice(0, 10) ?? "",
    });
    setShowModal(true);
  }, []);

  const columns = useMemo(
    () => [
      {
        key: "image",
        label: "Preview",
        width: "80px",
        render: (row: Banner) => (
          <img src={row.image} alt="" className="h-10 w-16 rounded border border-[#E6E6E6] object-cover bg-[#F2F2F2]" />
        ),
      },
      {
        key: "title",
        label: "Title & Link",
        render: (row: Banner) => (
          <div className="pr-3 min-w-0">
            <div className="font-semibold text-[#1A1A1A] text-[13px] truncate">{row.title}</div>
            <div className="text-[11px] text-[#9A9A9A] truncate">{row.linkUrl || "No link specified"}</div>
          </div>
        ),
      },
      {
        key: "placement",
        label: "Placement",
        width: "160px",
        render: (row: Banner) => (
          <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-[#444]">
            {row.placement.replace(/_/g, " ")}
          </span>
        ),
      },
      {
        key: "country",
        label: "Target",
        width: "80px",
        render: (row: Banner) => (
          <div className="text-[12.5px] font-medium text-[#555]">{row.country?.code ?? "All"}</div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
      },
      {
        key: "actions",
        label: "Actions",
        width: "90px",
        render: (row: Banner) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => edit(row)}
              title="Edit banner"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
            >
              <Edit2 size={13} />
            </button>
            <button
              onClick={() => setDeleting(row.id)}
              title="Delete banner"
              className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ),
      },
    ],
    [updateBanner.isPending, updateBanner.variables, toggleStatus, edit]
  );

  const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setForm({
      ...empty,
      placement: placement || "HOMEPAGE_HERO",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(empty);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedCountries = form.countryIds?.length ? form.countryIds : form.countryId ? [form.countryId] : [];
    const basePayload = {
      title: form.title,
      image: form.image,
      mobileImage: form.mobileImage || null,
      linkUrl: form.linkUrl || null,
      linkText: form.linkText || null,
      placement: form.placement,
      countryIds: selectedCountries,
      countryId: selectedCountries[0] || null,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (form.id) {
        await updateBanner.mutateAsync({ ...basePayload, id: form.id });
      } else {
        await createBanner.mutateAsync(basePayload);
      }
      closeModal();
      showToast("Banner saved successfully.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save banner."), "error");
    }
  };

  const upload = async (field: "image" | "mobileImage", file?: File) => {
    if (!file) return;
    setUploading(field);
    try {
      const results = await uploadMediaFiles([file], {
        entityType: "BANNER",
        entityId: form.id || undefined,
      });
      const uploaded = results[0];
      if (uploaded?.url) set(field, uploaded.url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Upload failed."), "error");
    } finally {
      setUploading(null);
    }
  };

  const runBulk = async (action: string) => {
    try {
      await bulkBanners.mutateAsync({ ids: selected, action });
      setSelected([]);
      showToast("Bulk action completed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === banners.length) {
      setSelected([]);
    } else {
      setSelected(banners.map((b) => b.id));
    }
  };

  return (
    <AdminLayout title="Banners" breadcrumb={[{ label: "Banners" }]}>
      {/* Top Header & Placement Tabs */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {placements.map((row) => {
            const count = placementCounts[row] ?? 0;
            const isSelected = placement === row;
            return (
              <button
                key={row || "ALL"}
                onClick={() => setPlacement(row)}
                className={`h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                  isSelected
                    ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs"
                    : "border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50"
                }`}
              >
                {row ? row.replace(/_/g, " ") : "All"}{" "}
                <span
                  className={`ml-1 rounded-full px-1.5 py-0.5 text-[11px] ${
                    isSelected ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs hover:bg-[#B5151B] transition-colors"
        >
          <Plus size={15} /> New Banner
        </button>
      </div>

      {/* Placement Description Hint */}
      <div className="mb-4 rounded-md border border-[#E6E6E6] bg-gray-50/70 px-4 py-2.5 text-[12.5px] text-[#555]">
        <span className="font-semibold text-[#1A1A1A]">Placement Info:</span>{" "}
        {PLACEMENT_DESCRIPTIONS[placement] || PLACEMENT_DESCRIPTIONS[""]}
      </div>

      <DataTable
        title="Banners"
        description="Manage promotional banners across Storefront placements."
        columns={columns}
        data={banners}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No banners found for this placement."
        enableSelection={true}
        selectedIds={selected}
        onSelectionChange={setSelected}
        enableReorder={true}
        onReorder={async (items) => {
          try {
            await reorderBanners.mutateAsync(items.map((item) => item.id));
            showToast("Banners reordered.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to reorder banners."), "error");
          }
        }}
        disabledReorder={reorderBanners.isPending}
        onToggleStatus={toggleStatus}
        statusLoadingId={updateBanner.isPending ? updateBanner.variables?.id : null}
        renderBulkActions={(selectedIds) => (
          <div className="flex items-center gap-3 w-full">
            <span className="text-[13px] font-bold text-[#1A1A1A]">{selectedIds.length} selected</span>
            <button
              type="button"
              onClick={() => setSelected([])}
              className="inline-flex items-center gap-1.5 rounded border border-[#E6E6E6] bg-white px-2.5 py-1 text-[11.5px] font-semibold text-[#1A1A1A] hover:bg-gray-50 hover:border-gray-300 shadow-sm transition-all"
            >
              <X size={12} /> Clear
            </button>
            <div className="h-4 w-px bg-[#E6E6E6]" />
            <span className="text-[12px] text-gray-500 font-medium">Bulk Actions:</span>
            <LoadingButton
              onClick={() => runBulk("enable")}
              loading={bulkBanners.isPending}
              loadingText="Enabling..."
              className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors shadow-sm"
            >
              Enable
            </LoadingButton>
            <LoadingButton
              onClick={() => runBulk("disable")}
              loading={bulkBanners.isPending}
              loadingText="Disabling..."
              className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11.5px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors shadow-sm"
            >
              Disable
            </LoadingButton>
            <LoadingButton
              onClick={() => runBulk("delete")}
              loading={bulkBanners.isPending}
              loadingText="Deleting..."
              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11.5px] font-semibold text-red-700 hover:bg-red-100 transition-colors shadow-sm"
            >
              Delete
            </LoadingButton>
          </div>
        )}
      />

      {/* Unified Modal Component for Add & Edit */}
      <Modal
        open={showModal}
        onClose={closeModal}
        panelClassName="max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={save} className="flex flex-col h-full">
          {/* Unified Sticky Action Header Bar matching ProductEditor style */}
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E6E6E6] bg-white px-6 py-4 shadow-xs">
            <div>
              <h3 className="text-[15.5px] font-bold text-ink">
                {form.id ? "Edit Banner" : "New Banner"}
              </h3>
              <p className="text-[11.5px] text-steel-2">
                Changes are not applied until you save.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 text-[13px] font-semibold text-[#555] hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <LoadingButton
                type="submit"
                loading={createBanner.isPending || updateBanner.isPending}
                loadingText="Saving..."
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#E31E24] px-5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors"
              >
                <Save size={14} /> Save Changes
              </LoadingButton>
            </div>
          </div>

          {/* Scrollable Form Body */}
          <div className="p-6 space-y-5">
            <div className="grid gap-4 md:grid-cols-3">
              <AdminInput
                label="Banner Title"
                value={form.title}
                onChange={(event) => set("title", event.target.value)}
                required
              />
              <AdminSelect
                label="Placement"
                value={form.placement}
                onChange={(event) => set("placement", event.target.value)}
                options={placements
                  .filter(Boolean)
                  .map((row) => ({ value: row, label: row.replace(/_/g, " ") }))}
              />
              <AdminMultiSearchableSelect
                label="Countries"
                values={form.countryIds ?? (form.countryId ? [form.countryId] : [])}
                onValuesChange={(values) =>
                  setForm((prev) => ({ ...prev, countryIds: values, countryId: values[0] ?? "" }))
                }
                options={(countries as any[]).map((country) => ({
                  value: country.id,
                  label: `${country.name} (${country.code})`,
                }))}
                placeholder="Select countries"
                allowSelectAll
                selectAllLabel="All countries"
              />
              <AdminInput
                label="Link URL"
                value={form.linkUrl}
                onChange={(event) => set("linkUrl", event.target.value)}
                placeholder="e.g. /products or https://..."
              />
              <AdminInput
                label="Link Button Text"
                value={form.linkText}
                onChange={(event) => set("linkText", event.target.value)}
                placeholder="e.g. Explore Now"
              />
              <AdminSelect
                label="Status"
                value={form.status ? "true" : "false"}
                onChange={(event) => set("status", event.target.value === "true")}
                options={[
                  { value: "true", label: "Active" },
                  { value: "false", label: "Inactive" },
                ]}
              />
              <AdminInput
                label="Start Date"
                type="date"
                value={form.startDate}
                onChange={(event) => set("startDate", event.target.value)}
              />
              <AdminInput
                label="End Date"
                type="date"
                value={form.endDate}
                onChange={(event) => set("endDate", event.target.value)}
              />
            </div>

            {/* Images Upload Section */}
            <div className="grid gap-4 md:grid-cols-2 pt-2">
              {(["image", "mobileImage"] as const).map((field) => (
                <div key={field} className="rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4">
                  <div className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">
                    {field === "image" ? "Desktop Image *" : "Mobile Image Override (Optional)"}
                  </div>
                  {form[field] ? (
                    <div className="relative mb-3 overflow-hidden rounded-md border border-[#E6E6E6]">
                      <img src={form[field]} alt="" className="h-36 w-full object-cover" />
                    </div>
                  ) : null}
                  <AdminInput
                    label="Image URL"
                    value={String(form[field] ?? "")}
                    onChange={(event) => set(field, event.target.value)}
                    placeholder="https://..."
                  />
                  <label
                    className={`mt-3 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#333] hover:bg-gray-50 ${
                      uploading === field ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    {uploading === field ? (
                      <span
                        className="inline-block animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent w-3.5 h-3.5"
                        aria-hidden="true"
                      />
                    ) : (
                      <Upload size={14} />
                    )}
                    {uploading === field ? "Uploading Image..." : "Upload Image File"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={uploading !== null}
                      className="hidden"
                      onChange={(event) => upload(field, event.target.files?.[0])}
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!deleting}
        title="Delete banner?"
        message="This will permanently delete this banner record."
        onCancel={() => setDeleting(null)}
        isLoading={deleteBanner.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBanner.mutateAsync(deleting);
            showToast("Banner deleted.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete banner."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
