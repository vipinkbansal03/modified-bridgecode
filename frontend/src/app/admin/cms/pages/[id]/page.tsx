"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function OldEditorRedirectPage() {
  const params = useParams();
  const router = useRouter();

  useEffect(() => {
    if (params?.id) {
      router.replace(`/admin/cms/pages?pageId=${params.id}`);
    } else {
      router.replace("/admin/cms/pages");
    }
  }, [params, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-[#F8F8F8]">
      <div className="flex items-center gap-3 text-sm text-[#6B6B6B]">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
        <span>Redirecting to CMS Page Studio...</span>
      </div>
    </div>
  );
}
