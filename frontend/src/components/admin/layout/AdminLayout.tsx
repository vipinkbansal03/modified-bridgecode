"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  breadcrumb?: { label: string; href?: string }[];
}

export function AdminLayout({ children, title, breadcrumb }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, isLoading, isReady } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isLoading && !user) router.replace("/admin/login");
  }, [user, isLoading, isReady, router]);

  if (!isReady || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F2F2F2]">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F8F8]">
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader title={title} breadcrumb={breadcrumb} onMenuOpen={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-5 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
