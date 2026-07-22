"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PermissionsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/roles");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center text-sm text-[#6B7280]">
      Redirecting to Roles & Permissions...
    </div>
  );
}
