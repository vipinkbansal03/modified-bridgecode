"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BlogCategoriesRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin/blogs?tab=categories");
  }, [router]);

  return (
    <div className="flex h-64 items-center justify-center">
      <div className="flex items-center gap-3 text-[14px] text-gray-500">
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
        Redirecting to Blog Categories...
      </div>
    </div>
  );
}

