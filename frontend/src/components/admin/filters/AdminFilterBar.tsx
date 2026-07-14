import { ReactNode } from "react";

type SelectOption = {
  value: string;
  label: string;
};

interface AdminFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;

  sortBy: string;
  onSortByChange: (value: string) => void;

  sortDir: "asc" | "desc";
  onSortDirChange: (value: "asc" | "desc") => void;

  pageSize: number;
  onPageSizeChange: (value: number) => void;

  sortOptions: SelectOption[];

  onRefresh: () => void;
  onReset: () => void;

  children?: ReactNode;
}