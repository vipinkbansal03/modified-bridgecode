"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { BlogEditor } from "@/components/admin/blogs/BlogEditor";

export default function NewBlogPage() {
  return (
    <AdminLayout title="New Blog" breadcrumb={[{ label: "Blog", href: "/admin/blogs" }, { label: "New Blog" }]}>
      <Link href="/admin/blogs" className="mb-4 inline-flex items-center gap-2 text-[13px] text-[#6B6B6B]"><ArrowLeft size={14} /> Back to blogs</Link>
      <BlogEditor />
    </AdminLayout>
  );
}
