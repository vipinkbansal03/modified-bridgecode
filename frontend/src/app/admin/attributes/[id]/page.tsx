"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  useToast,
} from "@/components/admin/AdminComponents";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { AttributeValueEditors } from "@/components/admin/attributes/AttributeValueEditors";
import { useAdminAttribute, useUpdateAttribute } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { ATTRIBUTE_DISPLAY_TYPE_LABELS, getDisplayTypeChangeWarnings, type AttributeRole } from "@/lib/attributeUtils";
import type { ApiAttribute } from "@/types/api.types";

export default function AttributeDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const { data: attribute, isLoading, refetch } = useAdminAttribute(id);
  const updateAttribute = useUpdateAttribute();
  const { showToast, ToastComponent } = useToast();

  const [name, setName] = useState("");
  const [role, setRole] = useState<AttributeRole>("DROPDOWN");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [roleWarnings, setRoleWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!attribute) return;
    setName(attribute.name);
    setRole(attribute.role);
    setStatus(attribute.status as "ACTIVE" | "INACTIVE");
  }, [attribute]);

  const handleRoleChange = (nextRole: AttributeRole) => {
    setRole(nextRole);
    if (attribute && nextRole !== attribute.role) {
      setRoleWarnings(getDisplayTypeChangeWarnings(attribute.values ?? [], nextRole, attribute.role));
    } else {
      setRoleWarnings([]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Name is required.", "error");
      return;
    }
    try {
      await updateAttribute.mutateAsync({
        id,
        name: name.trim(),
        role,
        status,
      });
      showToast("Attribute saved.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save attribute."), "error");
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Attribute" breadcrumb={[{ label: "Attributes", href: "/admin/attributes" }, { label: "..." }]}>
        <div className="h-40 animate-pulse rounded-lg bg-[#E6E6E6]" />
      </AdminLayout>
    );
  }

  if (!attribute) {
    return (
      <AdminLayout title="Attribute" breadcrumb={[{ label: "Attributes", href: "/admin/attributes" }, { label: "Not found" }]}>
        <p className="text-[13.5px] text-[#9A9A9A]">Attribute not found.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={attribute.name}
      breadcrumb={[{ label: "Attributes", href: "/admin/attributes" }, { label: attribute.name }]}
    >
      <Link href="/admin/attributes" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-[#6B6B6B] hover:text-[#1A1A1A]">
        <ArrowLeft size={14} /> Back to attributes
      </Link>

      <div className="mb-6 rounded-xl border border-[#E6E6E6] bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Attribute settings</h2>
          <AttributeRoleBadge role={attribute.role} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminInput label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <AdminSelect
            label="Display Type"
            value={role}
            onChange={(e) => handleRoleChange(e.target.value as AttributeRole)}
            options={[
              { value: "DROPDOWN", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.DROPDOWN },
              { value: "X_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.X_GRID },
              { value: "Y_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.Y_GRID },
            ]}
          />
          <AdminSelect
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />
        </div>
        {role !== attribute.role && (
          <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" />
            Display type changed. Save to apply. The storefront will automatically switch between dropdown and matrix rendering based on this setting.
          </p>
        )}
        {roleWarnings.length > 0 && (
          <p className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12.5px] text-blue-900">
            {roleWarnings.join(" ")}
          </p>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
        >
          Save attribute
        </button>
      </div>

      <div>
        <h2 className="mb-3 text-[15px] font-semibold text-[#1A1A1A]">Values</h2>
        <AttributeValueEditors attribute={{ ...(attribute as ApiAttribute), role }} />
      </div>

      {ToastComponent}
    </AdminLayout>
  );
}
