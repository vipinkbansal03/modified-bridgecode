"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useToast, ConfirmModal } from "@/components/admin/AdminComponents";
import { useAdminAttributes } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { Plus, X, Trash2, Check } from "lucide-react";

interface AttrValue { id: string; value: string; slug: string; sortOrder: number }
interface Attribute { id: string; name: string; slug: string; values: AttrValue[] }

export default function AttributesPage() {
  const { data: attributes = [], isLoading, refetch } = useAdminAttributes();
  const { showToast, ToastComponent } = useToast();
  const [newAttrName, setNewAttrName] = useState("");
  const [addingValueFor, setAddingValueFor] = useState<string | null>(null);
  const [newValue, setNewValue] = useState("");
  const [deleting, setDeleting] = useState<{ type: "attr" | "value"; id: string } | null>(null);

  const normalize = (value: string) =>
    value.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

  const handleCreateAttr = async () => {
    const name = newAttrName.trim();
    if (!name) {
      showToast("Attribute name is required.", "error");
      return;
    }
    const exists = attributes.some((attr: Attribute) => normalize(attr.name) === normalize(name));
    if (exists) {
      showToast("An attribute with this name already exists.", "error");
      return;
    }
    try {
      await adminApi.post("/attributes", { name });
      showToast("Attribute created.");
      setNewAttrName("");
      refetch();
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to create attribute."), "error"); }
  };

  const handleAddValue = async (attributeId: string) => {
    const value = newValue.trim();
    if (!value) {
      showToast("Attribute value is required.", "error");
      return;
    }
    const attribute = attributes.find((attr: Attribute) => attr.id === attributeId);
    const exists = attribute?.values.some((item) => normalize(item.value) === normalize(value));
    if (exists) {
      showToast("This value already exists for the selected attribute.", "error");
      return;
    }
    try {
      await adminApi.post(`/attributes/${attributeId}/values`, { value });
      showToast("Value added.");
      setNewValue("");
      setAddingValueFor(null);
      refetch();
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to add value."), "error"); }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      if (deleting.type === "attr") await adminApi.delete(`/attributes/${deleting.id}`);
      else await adminApi.delete(`/attributes/x/values/${deleting.id}`); // backend handles by value ID
      showToast("Deleted.");
      refetch();
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to delete item."), "error"); }
    finally { setDeleting(null); }
  };

  return (
    <AdminLayout title="Attributes" breadcrumb={[{ label: "Attributes" }]}>
      {/* Create new attribute */}
      <div className="mb-5 flex gap-2.5">
        <input
          value={newAttrName}
          onChange={(e) => setNewAttrName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateAttr()}
          placeholder="New attribute name (e.g. Prescription)"
          className="flex-1 max-w-[320px] rounded-md border border-[#E6E6E6] bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#E31E24]"
        />
        <button onClick={handleCreateAttr} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={14} /> Add Attribute
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : (
        <div className="space-y-3">
          {attributes.map((attr: Attribute) => (
            <div key={attr.id} className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-[14px] font-semibold text-[#1A1A1A]">{attr.name}</span>
                  <span className="ml-2 font-mono text-[11.5px] text-[#9A9A9A]">{attr.slug}</span>
                </div>
                <button onClick={() => setDeleting({ type: "attr", id: attr.id })} className="flex items-center gap-1 text-[12px] text-red-500 hover:text-red-700">
                  <Trash2 size={12} /> Remove
                </button>
              </div>

              {/* Values */}
              <div className="flex flex-wrap gap-2 items-center">
                {attr.values.map((v) => (
                  <span key={v.id} className="flex items-center gap-1.5 rounded-full border border-[#E6E6E6] bg-[#F8F8F8] px-3 py-1 text-[12.5px] text-[#1A1A1A]">
                    {v.value}
                    <button onClick={() => setDeleting({ type: "value", id: v.id })} className="text-[#9A9A9A] hover:text-red-500">
                      <X size={11} />
                    </button>
                  </span>
                ))}

                {addingValueFor === attr.id ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={newValue}
                      onChange={(e) => setNewValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddValue(attr.id); if (e.key === "Escape") { setAddingValueFor(null); setNewValue(""); } }}
                      placeholder="Value…"
                      className="w-28 rounded-full border border-[#E31E24] px-3 py-1 text-[12.5px] outline-none"
                    />
                    <button onClick={() => handleAddValue(attr.id)} className="flex items-center justify-center h-6 w-6 rounded-full bg-[#E31E24] text-white">
                      <Check size={11} />
                    </button>
                    <button onClick={() => { setAddingValueFor(null); setNewValue(""); }} className="flex items-center justify-center h-6 w-6 rounded-full border border-[#E6E6E6] text-[#6B6B6B]">
                      <X size={11} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setAddingValueFor(attr.id)} className="flex items-center gap-1 rounded-full border border-dashed border-[#9A9A9A] px-3 py-1 text-[12px] text-[#9A9A9A] hover:border-[#E31E24] hover:text-[#E31E24]">
                    <Plus size={11} /> Add value
                  </button>
                )}
              </div>
            </div>
          ))}

          {attributes.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
              No attributes yet. Create your first attribute above.
            </div>
          )}
        </div>
      )}

      <ConfirmModal open={!!deleting} title="Confirm delete" message={deleting?.type === "attr" ? "This will remove the attribute and all its values." : "This will remove this value."} onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
