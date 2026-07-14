"use client";

import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";

import ContactSubmissionDetails from "@/components/admin/contact-submissions/ContactSubmissionDetailCard";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminContactSubmission } from "@/hooks/admin/useAdminHooks";

export default function ContactSubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const {
    data: submission,
    isLoading,
  } = useAdminContactSubmission(id);

  if (isLoading) {
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

  if (!submission) {
    return (
      <AdminLayout
        title="Contact Submission"
        breadcrumb={[
          {
            label: "Contact Submissions",
            href: "/admin/contact-submissions",
          },
          {
            label: "Not Found",
          },
        ]}
      >
        <p>Contact submission not found.</p>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title={submission.name}
      breadcrumb={[
        {
          label: "Contact Submissions",
          href: "/admin/contact-submissions",
        },
        {
          label: submission.name,
        },
      ]}
    >
      <div className="mb-5">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-[13.5px] text-[#6B6B6B] hover:text-[#111]"
        >
          <ArrowLeft size={14} />
          Back
        </button>
      </div>

      <ContactSubmissionDetails submission={submission} />
    </AdminLayout>
  );
}