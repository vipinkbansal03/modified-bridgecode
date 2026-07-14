import Link from "next/link";
import { Eye } from "lucide-react";

import {
  type Column,
} from "@/components/admin/AdminComponents";

export type ContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  type: string | null;
  createdAt: string;
};

export const contactSubmissionColumns: Column<ContactSubmissionRow>[] = [
  {
    key: "contact",
    label: "Contact",
    render: (row) => (
      <div>
        <div className="font-medium">{row.name}</div>
        <div className="text-xs text-gray-500">
          {row.email}
        </div>
      </div>
    ),
  },

  {
    key: "phone",
    label: "Phone",
    render: (row) => row.phone || "-",
  },

  {
    key: "company",
    label: "Company",
    render: (row) => row.company || "-",
  },

  {
    key: "createdAt",
    label: "Submitted",
    render: (row) =>
      new Date(row.createdAt).toLocaleDateString(),
  },

  {
    key: "actions",
    label: "Actions",
    render: (row) => (
      <Link
        href={`/admin/contact-submissions/${row.id}`}
        className="inline-flex items-center gap-1 rounded border px-3 py-1 text-sm hover:bg-gray-50"
      >
        <Eye size={14} />
        View
      </Link>
    ),
  },
];