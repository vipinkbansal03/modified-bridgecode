"use client";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { SmsSettingsStudio } from "@/components/admin/settings/SmsSettingsStudio";

export default function SmsSettingsPage() {
  return (
    <AdminLayout
      title="SMS Studio"
      breadcrumb={[
        { label: "Notifications", href: "/admin/notifications" },
        { label: "SMS Studio" },
      ]}
    >
      <div className="w-full">
        <SmsSettingsStudio />
      </div>
    </AdminLayout>
  );
}
