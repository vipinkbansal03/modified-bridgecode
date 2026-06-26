"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { BlogEditor } from "@/components/admin/blogs/BlogEditor";
import { useAdminBlog } from "@/hooks/admin/useAdminHooks";

export default function EditBlogPage() {
  const params = useParams<{ id: string }>();
  const { data: blog, isLoading } = useAdminBlog(params.id);
  return (
    <AdminLayout title="Edit Blog" breadcrumb={[{ label: "Blog", href: "/admin/blogs" }, { label: "Edit Blog" }]}>
      <Link href="/admin/blogs" className="mb-4 inline-flex items-center gap-2 text-[13px] text-[#6B6B6B]"><ArrowLeft size={14} /> Back to blogs</Link>
      {isLoading ? <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13px] text-[#9A9A9A]">Loading blog...</div> : <BlogEditor blog={blog} />}
    </AdminLayout>
  );
}
