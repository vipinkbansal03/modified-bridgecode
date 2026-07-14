"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

export default function AdminPage() {
  const { user, isLoading, isReady } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (isReady && !isLoading) {
      if (user) {
        router.replace("/admin/dashboard");
      } else {
        router.replace("/admin/login");
      }
    }
  }, [user, isLoading, isReady, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#F2F2F2]">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
    </div>
  );
}
