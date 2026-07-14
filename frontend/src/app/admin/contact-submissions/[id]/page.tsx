"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";

export default function ContactSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <AdminLayout
      title="Contact Submission"
      breadcrumb={[
        {
          label: "Contact Submissions",
          href: "/admin/contact-submissions",
        },
        {
          label: "Loading...",
        },
      ]}
    >
      <p>Loading...</p>
    </AdminLayout>
  );
}
