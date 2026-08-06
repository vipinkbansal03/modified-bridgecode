"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Calculator, Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminMultiSelect, AdminSelect, ConfirmModal, DataTable, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { ApiShippingBox } from "@/types/api.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAdminProducts, useAdminCountries } from "@/hooks/admin/useAdminHooks";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { Modal } from "@/components/ui/Modal";

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
      key: "isActive", label: "Status",
      render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "actions", label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(row)}
            disabled={!canManage}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={async () => {
              try {
                await toggleMutation.mutateAsync(row.id);
                showToast(`${row.name} ${row.isActive ? "deactivated" : "activated"}.`);
              } catch (error) {
                showToast(getAdminErrorMessage(error, "Toggle failed."), "error");
              }
            }}
            disabled={!canManage}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => setDeletingBox(row)}
            disabled={!canManage}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ], [canManage, toggleMutation, showToast]);

  return (
    <AdminLayout title="Package/Box Management" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Boxes" }]}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 border-b border-[#E6E6E6]">
            <Link href="/admin/shipping" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Providers
            </Link>
            <Link href="/admin/shipping/zones" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Zones
            </Link>
            <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Boxes</span>
          </div>
          {canManage && (
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
              <Plus size={15} /> Add Box
            </button>
          )}
        </div>

        <div className="flex gap-2 border-b border-[#E6E6E6]">
          <button
            type="button"
            onClick={() => setActiveSubTab("boxes")}
            className={`px-4 py-2 text-[13px] font-medium ${activeSubTab === "boxes" ? "border-b-2 border-[#E31E24] font-semibold text-[#111]" : "text-[#6B6B6B] hover:text-[#111]"}`}
          >
            Package Size
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab("preview")}
            className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium ${activeSubTab === "preview" ? "border-b-2 border-[#E31E24] font-semibold text-[#111]" : "text-[#6B6B6B] hover:text-[#111]"}`}
          >
            <Calculator size={13} /> Package Preview
          </button>
        </div>

        {activeSubTab === "boxes" ? (
          <DataTable columns={columns} data={boxes} isLoading={isLoading} rowKey="id" emptyMessage="No shipping boxes configured." />
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
                <AdminSelect
                  label="Country (for charge)"
                  value={previewCountryId}
                  onChange={(e) => setPreviewCountryId(e.target.value)}
                  options={[{ value: "", label: "Optional..." }, ...(countries as { id: string; name: string; code: string }[]).map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))]}
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={form.values.id ? "Edit Box" : "Add Box"} panelClassName="max-w-2xl">
        <form onSubmit={form.handleSubmit} className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <AdminInput required label="Box Name" placeholder="e.g. Small Box, Medium Box" {...form.getFieldProps("name")} error={form.errors.name as string} />
            </div>
            <AdminInput required label="Length (cm)" type="number" placeholder="e.g. 30" {...form.getFieldProps("length")} error={form.errors.length as string} />
            <AdminInput required label="Width (cm)" type="number" placeholder="e.g. 20" {...form.getFieldProps("width")} error={form.errors.width as string} />
            <AdminInput required label="Height (cm)" type="number" placeholder="e.g. 15" {...form.getFieldProps("height")} error={form.errors.height as string} />
            <AdminInput required label="Max Weight (kg)" type="number" placeholder="e.g. 5" {...form.getFieldProps("maxWeight")} error={form.errors.maxWeight as string} />
            <div className="sm:col-span-2 flex flex-col">
              <AdminMultiSelect
                label="Countries"
                options={(countries as { id: string; name: string; code: string }[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                value={form.values.countryIds}
                onChange={(vals) => form.setFieldValue("countryIds", vals)}
                selectAllLabel="Select All"
                placeholder="Select countries..."
              />
              {form.errors.countryIds && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.countryIds as string}</span>}
            </div>
            <div className="flex items-end pb-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={form.values.isActive} onChange={(e) => form.setFieldValue("isActive", e.target.checked)} className="rounded" />
                <span className="text-[13.5px] text-[#1A1A1A]">Active</span>
              </label>
            </div>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2.5 text-[13.5px] font-medium text-[#555] hover:bg-[#F2F2F2]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={form.isSubmitting}
              className="rounded-md bg-[#E31E24] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
            >
              {form.isSubmitting ? "Saving..." : form.values.id ? "Update Box" : "Create Box"}
            </button>
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
        />
      )}

      {ToastComponent}
    </AdminLayout>
  );
}
