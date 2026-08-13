"use client";

import { AdminSelect, AdminListToolbar } from "@/components/admin/AdminComponents";

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
  isRefreshing: boolean;
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
  isRefreshing,
}: Props) {
  return (
    <AdminListToolbar
      search={{
        value: search,
        onChange: onSearchChange,
        placeholder: "Search contact submissions...",
        widthClassName: "max-w-[280px]",
      }}
      leftExtra={
        <div className="flex flex-wrap items-center gap-2">
          <AdminSelect
            label=""
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="h-10"
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
            className="h-10"
            options={[
              { value: "desc", label: "Descending" },
              { value: "asc", label: "Ascending" },
            ]}
          />

          <AdminSelect
            label=""
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-10"
            options={[
              { value: "10", label: "10 / page" },
              { value: "20", label: "20 / page" },
              { value: "50", label: "50 / page" },
              { value: "100", label: "100 / page" },
            ]}
          />
        </div>
      }
      refresh={{
        onRefresh: onRefresh,
        isRefreshing: isRefreshing,
      }}
      rightExtra={
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
        >
          Reset
        </button>
      }
    />
  );
}
