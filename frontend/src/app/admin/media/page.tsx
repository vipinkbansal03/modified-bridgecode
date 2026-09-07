"use client";

import { useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import MediaLibraryPanel from "@/components/admin/media/MediaLibraryPanel";

export default function MediaPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (
      !authLoading &&
      !hasPermission("media.view") &&
      !hasPermission("media.manage") &&
      !hasPermission("*")
    ) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  if (
    authLoading ||
    (!hasPermission("media.view") &&
      !hasPermission("media.manage") &&
      !hasPermission("*"))
  ) {
    return null;
  }

  return (
    <AdminLayout title="Media Library" breadcrumb={[{ label: "Media Library" }]}>
      <MediaLibraryPanel mode="manage" />
    </AdminLayout>
  );
}
