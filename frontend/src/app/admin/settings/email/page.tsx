"use client";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { EmailSettingsStudio } from "@/components/admin/settings/EmailSettingsStudio";

export default function EmailSettingsPage() {
  return (
    <AdminLayout
      title="Email Studio"
      breadcrumb={[
        { label: "Notifications", href: "/admin/notifications" },
        { label: "Email Studio" },
      ]}
    >
      <div className="w-full">
        <EmailSettingsStudio />
      </div>
    </AdminLayout>
  );
}
