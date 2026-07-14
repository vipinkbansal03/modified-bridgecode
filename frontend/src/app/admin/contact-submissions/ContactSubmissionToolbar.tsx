"use client";

import { AdminSelect } from "@/components/admin/AdminComponents";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;

  sortBy: string;
  onSortByChange: (value: string) => void;

  sortDirection: "asc" | "desc";
  onSortDirectionChange: (value: "asc" | "desc") => void;

  pageSize: number;
  onPageSizeChange: (value: number) => void;

  onReset: () => void;

  onRefresh: () => void;
};

export function ContactSubmissionToolbar({
  search,
  onSearchChange,
  sortBy,
  onSortByChange,
  sortDirection,
  onSortDirectionChange,
  pageSize,
  onPageSizeChange,
  onReset,
  onRefresh,
}: Props) {
  return (
    <div className="mb-6 rounded-xl border border-[#E6E6E6] bg-white p-4">
      <div className="grid gap-3 xl:grid-cols-[2fr_1.3fr_1.3fr_1.2fr]">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search contact submissions..."
          className="h-10 rounded-md border border-[#E6E6E6] bg-white py-2 pl-3.5 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
        />

        <AdminSelect
          label=""
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value)}
          options={[
            { value: "createdAt", label: "Created Date" },
            { value: "name", label: "Name" },
            { value: "email", label: "Email" },
            { value: "company", label: "Company" },
          ]}
        />

        <AdminSelect
          label=""
          value={sortDirection}
          onChange={(e) =>
            onSortDirectionChange(e.target.value as "asc" | "desc")
          }
          options={[
            { value: "desc", label: "Descending" },
            { value: "asc", label: "Ascending" },
          ]}
        />

        <AdminSelect
          label=""
          value={String(pageSize)}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          options={[
            { value: "10", label: "10 / page" },
            { value: "20", label: "20 / page" },
            { value: "50", label: "50 / page" },
            { value: "100", label: "100 / page" },
          ]}
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_160px]">
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
        >
          Refresh Filters
        </button>

        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
