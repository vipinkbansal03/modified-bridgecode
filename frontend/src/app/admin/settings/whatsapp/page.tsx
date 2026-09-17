"use client";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { WhatsAppSettingsStudio } from "@/components/admin/settings/WhatsAppSettingsStudio";

export default function WhatsAppSettingsPage() {
  return (
    <AdminLayout
      title="WhatsApp Studio"
      breadcrumb={[
        { label: "Notifications", href: "/admin/notifications" },
        { label: "WhatsApp Studio" },
      ]}
    >
      <div className="w-full">
        <WhatsAppSettingsStudio />
      </div>
    </AdminLayout>
  );
}
