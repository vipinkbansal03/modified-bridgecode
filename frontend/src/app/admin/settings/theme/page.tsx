"use client";

import { Palette } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ThemeSettingsStudio } from "@/components/admin/settings/ThemeSettingsStudio";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function ThemeSettingsPage() {
  const { hasPermission } = useAdminAuth();
  return (
    <AdminLayout title="Storefront Theme" breadcrumb={[{ label: "Settings", href: "/admin/settings" }, { label: "Storefront Theme" }]}>
      {hasPermission("settings.update") ? <ThemeSettingsStudio /> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><Palette className="mb-2 h-5 w-5" />You have read-only access to storefront settings.</div>}
    </AdminLayout>
  );
}
