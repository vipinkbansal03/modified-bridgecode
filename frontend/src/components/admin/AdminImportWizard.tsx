"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  XCircle,
  RefreshCw,
  Search,
  Pencil,
  ChevronDown,
} from "lucide-react";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

/* ─────────────────── Types ─────────────────── */

export interface WizardColumnDef<T = any> {
  key: string;
  header: string;
  required?: boolean;
  type?: "text" | "number" | "select" | "multiselect";
  options?: Array<{ label: string; value: string }>;
  minWidth?: string;
  width?: string;
  align?: "left" | "center" | "right";
  placeholder?: string;
  validate?: (value: any, row: T) => string | null;
  render?: (row: T, value: any, onChange: (val: any) => void) => React.ReactNode;
}

export interface WizardExpectedColumn {
  name: string;
  required?: boolean;
  hint?: string;
}

export interface WizardRowData {
  rowNumber: number;
  isValid: boolean;
  errors: string[];
  [key: string]: any;
}

export interface AdminImportWizardProps<T extends WizardRowData = WizardRowData> {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  entityName?: string;
  accepted?: string;
  expectedColumns?: WizardExpectedColumn[];
  columns: WizardColumnDef<T>[];
  sampleTemplateUrl?: string;
  sampleTemplateFilename?: string;
  onDownloadTemplate?: () => void;
  previewEndpoint: string;
  executeEndpoint: string;
  transformPreviewResponse?: (data: any) => { totalRows: number; validRows: number; invalidRows: number; rows: T[] };
  transformExecutePayload?: (selectedRows: T[]) => any;
  onSuccess?: (result?: any) => void;
}

/* ─────────────────── Helpers ─────────────────── */

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const STEPS = [
  { id: 0, label: "Upload" },
  { id: 1, label: "Preview & Edit" },
  { id: 2, label: "Import" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-3.5 px-6 border-b border-[#F3F4F6] bg-white">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[11.5px] font-bold transition-all duration-300",
                current > step.id
                  ? "bg-emerald-500 text-white shadow-sm shadow-emerald-200"
                  : current === step.id
                    ? "bg-[#E31E24] text-white shadow-sm shadow-red-200"
                    : "border-2 border-[#D1D5DB] bg-white text-[#9CA3AF]"
              )}
            >
              {current > step.id ? <Check size={13} strokeWidth={3} /> : step.id + 1}
            </div>
            <span
              className={cn(
                "mt-1 text-[11px] font-semibold transition-colors",
                current >= step.id ? "text-[#1A1A1A]" : "text-[#9CA3AF]"
              )}
            >
              {step.label}
            </span>
          </div>
          {idx < STEPS.length - 1 && (
            <div className="mx-3 mb-4 h-[2px] w-14 rounded-full bg-[#E5E7EB] overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: current > step.id ? "100%" : "0%" }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── Table Cell Multi-Select Component ─────────────────── */

function WizardCellMultiSelect({
  value,
  options,
  onChange,
  hasError,
  placeholder = "Select...",
}: {
  value: any;
  options: Array<{ label: string; value: string }>;
  onChange: (val: string) => void;
  hasError?: boolean;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  } | null>(null);

  // Parse currently selected values (can be "IN, US, GB" or ["IN", "US", "GB"] or "ALL")
  const selectedValues = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
    }
    const str = String(value).trim();
    if (str.toUpperCase() === "ALL") return ["ALL"];
    return str
      .split(/[,;|]/)
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);
  }, [value]);

  const isAllSelected = selectedValues.includes("ALL");

  // Non-ALL options for individual country list
  const countryOptions = useMemo(() => {
    return options.filter((o) => o.value !== "ALL" && o.value !== "");
  }, [options]);

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const gap = 4;
    const spaceBelow = viewportHeight - rect.bottom - gap - 10;
    const spaceAbove = rect.top - gap - 10;
    const openUp = spaceBelow < 220 && spaceAbove > spaceBelow;
    const width = Math.max(260, rect.width);
    const left = Math.min(rect.left, Math.max(10, window.innerWidth - width - 16));

    if (openUp) {
      setMenuStyle({ bottom: viewportHeight - rect.top + gap, left, width });
    } else {
      setMenuStyle({ top: rect.bottom + gap, left, width });
    }
  }, []);

  useLayoutEffect(() => {
    if (isOpen) updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReflow = () => updateMenuPosition();
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);
    return () => {
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        buttonRef.current &&
        !buttonRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = (code: string) => {
    if (code === "ALL") {
      if (isAllSelected) {
        onChange("");
      } else {
        onChange("ALL");
      }
      return;
    }

    let nextList = isAllSelected ? [] : [...selectedValues];
    if (nextList.includes(code)) {
      nextList = nextList.filter((c) => c !== code);
    } else {
      nextList.push(code);
    }

    onChange(nextList.join(", "));
  };

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return countryOptions;
    const q = search.trim().toLowerCase();
    return countryOptions.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q)
    );
  }, [countryOptions, search]);

  // Display text on cell trigger button
  const displayLabel = useMemo(() => {
    if (isAllSelected) return "All countries (Global)";
    if (selectedValues.length === 0) return placeholder;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : selectedValues[0];
    }
    if (selectedValues.length <= 3) {
      return selectedValues.join(", ");
    }
    return `${selectedValues.length} countries (${selectedValues.slice(0, 2).join(", ")}...)`;
  }, [isAllSelected, selectedValues, options, placeholder]);

  return (
    <div className="relative w-full min-w-[130px]">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "w-full rounded border px-2 py-1 text-[11.5px] bg-white transition-colors cursor-pointer flex items-center justify-between gap-1 text-left",
          hasError
            ? "border-red-400 focus:border-red-600 ring-1 ring-red-200"
            : "border-[#D1D5DB] hover:border-[#9CA3AF] focus:border-[#1A1A1A]",
          selectedValues.length === 0 && "text-[#9CA3AF]"
        )}
      >
        <span className="truncate flex items-center gap-1">
          {isAllSelected ? (
            <span className="inline-flex items-center px-1.5 py-0.2 text-[10.5px] font-medium rounded bg-blue-50 text-blue-700 border border-blue-200">
              All countries
            </span>
          ) : selectedValues.length > 0 ? (
            <span className="font-medium text-[#111827]">{displayLabel}</span>
          ) : (
            displayLabel
          )}
        </span>
        <ChevronDown size={13} className={cn("shrink-0 text-[#6B7280] transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[100000] origin-top rounded-md border border-[#E5E7EB] bg-white shadow-xl flex flex-col text-xs"
              style={{
                position: "fixed",
                top: menuStyle.top !== undefined ? menuStyle.top : "auto",
                bottom: menuStyle.bottom !== undefined ? menuStyle.bottom : "auto",
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: "260px",
              }}
            >
              {/* Search input */}
              <div className="p-1.5 border-b border-[#F3F4F6] bg-[#F9FAFB] flex items-center gap-1.5">
                <Search size={12} className="text-[#9CA3AF] shrink-0" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search countries..."
                  className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-[#9CA3AF]"
                  autoFocus
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="text-[#9CA3AF] hover:text-[#4B5563]">
                    ✕
                  </button>
                )}
              </div>

              {/* All countries option */}
              <div className="border-b border-[#F3F4F6] p-1 bg-white">
                <button
                  type="button"
                  onClick={() => handleToggle("ALL")}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#F3F4F6] text-left transition-colors cursor-pointer",
                    isAllSelected && "bg-blue-50/70 font-medium text-blue-900"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    onChange={() => {}}
                    className="rounded border-[#D1D5DB] text-[#1A1A1A] h-3.5 w-3.5 cursor-pointer pointer-events-none"
                  />
                  <span className="font-semibold text-[#111827]">All countries (Global)</span>
                </button>
              </div>

              {/* Country list */}
              <div className="overflow-y-auto max-h-[160px] p-1 space-y-0.5">
                {filteredOptions.length === 0 ? (
                  <div className="px-2 py-3 text-center text-[#9CA3AF] text-[11px]">No countries found</div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isChecked = isAllSelected || selectedValues.includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleToggle(opt.value)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-[#F3F4F6] text-left transition-colors cursor-pointer",
                          isChecked && !isAllSelected && "bg-gray-50 font-medium"
                        )}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="rounded border-[#D1D5DB] text-[#1A1A1A] h-3.5 w-3.5 cursor-pointer pointer-events-none"
                        />
                        <span className="truncate text-[#374151]">{opt.label}</span>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer with count & action */}
              <div className="p-1.5 border-t border-[#F3F4F6] bg-[#F9FAFB] flex items-center justify-between text-[11px] text-[#6B7280]">
                <span>
                  {isAllSelected
                    ? "All countries"
                    : selectedValues.length === 0
                    ? "None selected"
                    : `${selectedValues.length} selected`}
                </span>
                <div className="flex items-center gap-2">
                  {selectedValues.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onChange("")}
                      className="text-red-600 hover:text-red-700 font-medium cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="px-2 py-0.5 bg-[#1A1A1A] text-white rounded text-[10.5px] font-medium hover:bg-black cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/* ─────────────────── Main AdminImportWizard Component ─────────────────── */

export function AdminImportWizard<T extends WizardRowData = WizardRowData>({
  open,
  onClose,
  title,
  subtitle,
  entityName = "records",
  accepted = ".csv,.xlsx,.xls",
  expectedColumns,
  columns,
  sampleTemplateUrl,
  sampleTemplateFilename = "template.xlsx",
  onDownloadTemplate,
  previewEndpoint,
  executeEndpoint,
  transformPreviewResponse,
  transformExecutePayload,
  onSuccess,
}: AdminImportWizardProps<T>) {
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1: Upload state
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Preview state
  const [rows, setRows] = useState<T[]>([]);
  const [totalRowsCount, setTotalRowsCount] = useState(0);
  const [selectedRowNumbers, setSelectedRowNumbers] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [editingCell, setEditingCell] = useState<{ rowNumber: number; field: string } | null>(null);

  // Step 3: Execute state
  const [executing, setExecuting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    batch: number;
    totalBatches: number;
  } | null>(null);
  const [executeResult, setExecuteResult] = useState<{ created: number; updated: number } | null>(null);
  const [executeError, setExecuteError] = useState("");

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Reset when closing
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep(0);
        setFile(null);
        setDragging(false);
        setUploading(false);
        setUploadError("");
        setRows([]);
        setTotalRowsCount(0);
        setSelectedRowNumbers(new Set());
        setFilter("all");
        setSearchQuery("");
        setCurrentPage(1);
        setPageSize(100);
        setEditingCell(null);
        setExecuting(false);
        setImportProgress(null);
        setExecuteResult(null);
        setExecuteError("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle template download
  const handleDownloadSample = useCallback(async () => {
    if (onDownloadTemplate) {
      onDownloadTemplate();
      return;
    }
    if (!sampleTemplateUrl) return;
    try {
      const response = await adminApi.get(sampleTemplateUrl, { responseType: "blob" });
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = sampleTemplateFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setUploadError(getAdminErrorMessage(err, "Failed to download sample template."));
    }
  }, [onDownloadTemplate, sampleTemplateUrl, sampleTemplateFilename]);

  // File upload & preview
  const handleFileSelect = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      setUploadError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setFile(f);
    setUploadError("");
  }, []);

  const uploadAndPreview = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await adminApi.post(previewEndpoint, formData, { timeout: 60000 });
      const rawData = res.data?.data;

      let parsedResult: { totalRows: number; validRows: number; invalidRows: number; rows: T[] };

      if (transformPreviewResponse) {
        parsedResult = transformPreviewResponse(rawData);
      } else {
        const rawRows: any[] = rawData?.rows || rawData?.sampleRows || [];
        const issues: Array<{ row: number; field: string; message: string }> = rawData?.issues || [];

        const normalizedRows: T[] = rawRows.map((r: any, idx: number) => {
          const rowNumber = Number(r.rowNumber ?? r.row ?? idx + 2);
          const rowErrors = r.errors
            ? (r.errors as string[])
            : issues
                .filter((iss) => iss.row === rowNumber)
                .map((iss) => (iss.field ? `[${iss.field}] ${iss.message}` : iss.message));

          const isValid = r.isValid !== undefined ? Boolean(r.isValid) : rowErrors.length === 0;

          return {
            ...r,
            rowNumber,
            isValid,
            errors: rowErrors,
          } as T;
        });

        parsedResult = {
          totalRows: rawData?.totalRows ?? normalizedRows.length,
          validRows: rawData?.validRows ?? normalizedRows.filter((r) => r.isValid).length,
          invalidRows: rawData?.invalidRows ?? normalizedRows.filter((r) => !r.isValid).length,
          rows: normalizedRows,
        };
      }

      setTotalRowsCount(parsedResult.totalRows);
      setRows(parsedResult.rows);

      // Default: select all valid rows
      const validRowNums = new Set(parsedResult.rows.filter((r) => r.isValid).map((r) => r.rowNumber));
      setSelectedRowNumbers(validRowNums);
      setStep(1);
    } catch (err) {
      setUploadError(getAdminErrorMessage(err, "Failed to preview file. Please check file format."));
    } finally {
      setUploading(false);
    }
  }, [file, previewEndpoint, transformPreviewResponse]);

  // Direct Inline Cell Edit
  const updateCellValue = useCallback(
    (rowNumber: number, field: string, value: any) => {
      setRows((prev) =>
        prev.map((row) => {
          if (row.rowNumber !== rowNumber) return row;
          const nextRow: any = { ...row, [field]: value };
          if (field === "name") nextRow.attributeName = value;
          if (field === "attributeName") nextRow.name = value;
          if (field === "role") nextRow.displayType = value;
          if (field === "categorySlug" || field === "category" || field === "categoryName") {
            nextRow.category = value;
            nextRow.categorySlug = value;
            nextRow.categoryName = value;
          }
          if (field === "values") nextRow.allowedValues = value;
          if (field === "allowedValues") nextRow.values = value;
          if (field === "parentCategory" || field === "parentSlug" || field === "parent") {
            nextRow.parentCategory = value;
            nextRow.parentSlug = value;
            nextRow.parent = value;
          }
          if (field === "countryCode" || field === "country" || field === "countryName" || field === "countryCodes" || field === "countries") {
            nextRow.countryCode = value;
            nextRow.country = value;
            nextRow.countryCodes = value;
            nextRow.countries = value;
          }
          if (field === "distributorPrice" || field === "doctorRetailerPrice" || field === "doctorPrice" || field === "retailerPrice") {
            nextRow.distributorPrice = value;
            nextRow.doctorRetailerPrice = value;
            nextRow.doctorPrice = value;
            nextRow.retailerPrice = value;
          }
          if (field === "productTitle" || field === "productName") {
            nextRow.productTitle = value;
            nextRow.productName = value;
          }

          // Client-side field re-validation
          const colDef = columns.find((c) => c.key === field);
          const fieldErrorPrefix = `[${field}]`;

          let customFieldError: string | null = null;
          if (colDef?.required && (value === undefined || value === null || String(value).trim() === "")) {
            customFieldError = `${colDef.header || field} is required.`;
          } else if (colDef?.validate) {
            customFieldError = colDef.validate(value, nextRow);
          }

          // Clean existing errors for this field
          let updatedErrors = (row.errors || []).filter(
            (err) =>
              !err.toLowerCase().includes(field.toLowerCase()) &&
              !err.includes(fieldErrorPrefix)
          );

          if (customFieldError) {
            updatedErrors.push(`${fieldErrorPrefix} ${customFieldError}`);
          }

          nextRow.errors = updatedErrors;
          nextRow.isValid = updatedErrors.length === 0;

          // Auto-select row if it transitioned from invalid to valid
          if (nextRow.isValid && !row.isValid) {
            setSelectedRowNumbers((prevSelected) => new Set([...prevSelected, rowNumber]));
          }

          return nextRow;
        })
      );
    },
    [columns]
  );

  // Filtered rows for Step 2
  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filter === "valid" && !r.isValid) return false;
      if (filter === "invalid" && r.isValid) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(r).some((val) => String(val ?? "").toLowerCase().includes(q));
    });
  }, [rows, filter, searchQuery]);

  // Selection helpers
  const toggleRowSelect = useCallback((rowNumber: number) => {
    setSelectedRowNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  const selectAllFiltered = useCallback(() => {
    setSelectedRowNumbers((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => next.add(r.rowNumber));
      return next;
    });
  }, [filteredRows]);

  const deselectAllFiltered = useCallback(() => {
    setSelectedRowNumbers((prev) => {
      const next = new Set(prev);
      filteredRows.forEach((r) => next.delete(r.rowNumber));
      return next;
    });
  }, [filteredRows]);

  const selectAllValid = useCallback(() => {
    const validRowNums = rows.filter((r) => r.isValid).map((r) => r.rowNumber);
    setSelectedRowNumbers(new Set(validRowNums));
  }, [rows]);

  // Pagination calculations for Step 2
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(safeCurrentPage * pageSize, filteredRows.length);
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, endIndex),
    [filteredRows, startIndex, endIndex]
  );

  // Execute Import
  const executeImport = useCallback(async () => {
    const selectedRows = rows.filter((r) => selectedRowNumbers.has(r.rowNumber));
    if (!selectedRows.length) return;

    setExecuting(true);
    setExecuteError("");
    setStep(2);

    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(selectedRows.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalUpdated = 0;
    let lastResultData: any = null;

    setImportProgress({
      current: 0,
      total: selectedRows.length,
      batch: 1,
      totalBatches,
    });

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batch = selectedRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setImportProgress({
          current: b * BATCH_SIZE,
          total: selectedRows.length,
          batch: b + 1,
          totalBatches,
        });

        const payload = transformExecutePayload ? transformExecutePayload(batch) : { rows: batch };
        const res = await adminApi.post(executeEndpoint, payload, { timeout: 120000 });
        const resultData = res.data?.data;
        lastResultData = resultData;

        totalCreated +=
          resultData?.created ??
          resultData?.createdAttributes ??
          resultData?.createdCount ??
          batch.length;
        totalUpdated +=
          resultData?.updated ??
          resultData?.updatedAttributes ??
          resultData?.updatedCount ??
          0;

        setImportProgress({
          current: Math.min((b + 1) * BATCH_SIZE, selectedRows.length),
          total: selectedRows.length,
          batch: b + 1,
          totalBatches,
        });
      }

      setExecuteResult({ created: totalCreated, updated: totalUpdated });
      if (onSuccess) onSuccess(lastResultData);
    } catch (err) {
      setExecuteError(
        getAdminErrorMessage(
          err,
          totalCreated > 0 || totalUpdated > 0
            ? `Import stopped after ${totalCreated} created, ${totalUpdated} updated. Please check error and retry remaining.`
            : "Failed to execute import. Please try again."
        )
      );
    } finally {
      setExecuting(false);
    }
  }, [rows, selectedRowNumbers, transformExecutePayload, executeEndpoint, onSuccess]);

  if (!mounted || !open) return null;

  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;
  const selectedValidCount = rows.filter((r) => selectedRowNumbers.has(r.rowNumber) && r.isValid).length;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative flex flex-col w-full max-w-[96vw] xl:max-w-6xl h-[90vh] max-h-[860px] rounded-xl bg-white shadow-2xl overflow-hidden z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA]">
            <div>
              <h2 className="text-[16px] font-bold text-[#1A1A1A]">{title}</h2>
              <p className="mt-0.5 text-[12.5px] text-[#6B7280]">
                {subtitle || `Import ${entityName} from a CSV or Excel spreadsheet with live preview & direct inline editing`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#1A1A1A] transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stepper */}
          <StepIndicator current={step} />

          {/* Step Body */}
          <div className="flex-1 overflow-hidden flex flex-col bg-[#F9FAFB]">
            {/* STEP 0: UPLOAD */}
            {step === 0 && (
              <div className="flex-1 overflow-y-auto p-6 flex flex-col">
                <div
                  className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 px-6 transition-all duration-200 cursor-pointer",
                    dragging
                      ? "border-[#E31E24] bg-red-50/40 scale-[1.005]"
                      : file
                        ? "border-emerald-300 bg-emerald-50/25"
                        : "border-[#D1D5DB] bg-white hover:border-[#9CA3AF] hover:bg-[#F9FAFB]"
                  )}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    const dropped = e.dataTransfer.files?.[0];
                    if (dropped) handleFileSelect(dropped);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setDragging(false);
                  }}
                  onClick={() => !file && fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={accepted}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFileSelect(f);
                      if (e.target) e.target.value = "";
                    }}
                  />

                  {!file ? (
                    <>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-[#E31E24] shadow-xs">
                        <Upload size={26} strokeWidth={2.2} />
                      </div>
                      <p className="mt-4 text-[14px] font-semibold text-[#1A1A1A]">
                        Drag and drop your spreadsheet here
                      </p>
                      <p className="mt-1 text-[12px] text-[#6B7280]">
                        Supports <span className="font-mono font-medium">.xlsx</span>, <span className="font-mono font-medium">.csv</span>, <span className="font-mono font-medium">.xls</span> files
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="mt-4 rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] shadow-xs transition-colors"
                      >
                        Browse Files
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 shadow-xs">
                        <FileSpreadsheet size={26} strokeWidth={2.2} />
                      </div>
                      <p className="mt-3 text-[14px] font-semibold text-[#1A1A1A] max-w-sm truncate text-center">
                        {file.name}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[#6B7280]">{formatFileSize(file.size)}</p>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="rounded-md border border-[#D1D5DB] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                        >
                          Change File
                        </button>
                        <button
                          type="button"
                          onClick={() => setFile(null)}
                          className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-[12.5px] font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Upload Error Banner */}
                {uploadError && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50/80 p-3 text-[13px] text-red-700">
                    <AlertCircle size={16} className="shrink-0 text-red-600" />
                    <span>{uploadError}</span>
                  </div>
                )}

                {/* Template & Expected Columns */}
                <div className="mt-6 rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-2xs">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#F3F4F6]">
                    <div>
                      <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">Need a spreadsheet template?</h4>
                      <p className="text-[12px] text-[#6B7280] mt-0.5">
                        Download our pre-formatted sample template with sample rows and valid columns.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadSample}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-[#1A1A1A] text-white px-3.5 py-2 text-[12.5px] font-medium hover:bg-[#333] transition-colors cursor-pointer shrink-0 shadow-xs"
                    >
                      <Download size={13} />
                      Download Sample Template
                    </button>
                  </div>

                  {expectedColumns && expectedColumns.length > 0 && (
                    <div className="mt-4">
                      <p className="text-[11.5px] font-semibold text-[#6B7280] uppercase tracking-wide">
                        Expected Columns in File:
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {expectedColumns.map((col) => (
                          <span
                            key={col.name}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11.5px] font-mono",
                              col.required
                                ? "bg-red-50 text-red-700 border border-red-200 font-semibold"
                                : "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
                            )}
                            title={col.hint || (col.required ? "Required Column" : "Optional Column")}
                          >
                            {col.name}
                            {col.required && <span className="text-[#E31E24]">*</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer buttons */}
                <div className="mt-auto pt-6 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={uploadAndPreview}
                    disabled={!file || uploading}
                    className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Validating Spreadsheet...
                      </>
                    ) : (
                      <>
                        Upload & Preview
                        <ArrowRight size={14} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 1: PREVIEW & DIRECT INLINE EDITING */}
            {step === 1 && (
              <div className="flex-1 overflow-hidden flex flex-col">
                {/* Control bar */}
                <div className="shrink-0 px-6 py-3 bg-white border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                  {/* Stats pills */}
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[12px] font-semibold text-[#4B5563]">
                      {totalRowsCount} Total
                    </span>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                      {validCount} Valid
                    </span>
                    <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-[12px] font-semibold text-red-600">
                      {invalidCount} Invalid
                    </span>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex items-center gap-3">
                    {/* Search */}
                    <div className="relative w-48 sm:w-60">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search rows..."
                        className="w-full rounded-md border border-[#D1D5DB] pl-8 pr-3 py-1.5 text-[12px] text-[#1A1A1A] placeholder-[#9CA3AF] focus:border-[#1A1A1A] focus:outline-none"
                      />
                    </div>

                    <div className="flex rounded-lg border border-[#D1D5DB] overflow-hidden">
                      {(["all", "valid", "invalid"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => {
                            setFilter(f);
                            setCurrentPage(1);
                          }}
                          className={cn(
                            "px-3 py-1 text-[11.5px] font-semibold capitalize transition-colors",
                            filter === f ? "bg-[#1A1A1A] text-white" : "bg-white text-[#6B7280] hover:bg-[#F3F4F6]"
                          )}
                        >
                          {f}
                        </button>
                      ))}
                    </div>

                    {/* Quick selection actions */}
                    <div className="flex items-center gap-2 border-l border-[#E5E7EB] pl-3">
                      <button
                        type="button"
                        onClick={selectAllValid}
                        className="text-[11.5px] font-semibold text-[#E31E24] hover:underline"
                      >
                        Select All Valid
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedRowNumbers(new Set())}
                        className="text-[11.5px] font-semibold text-[#6B7280] hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </div>

                {/* Inline Editing Tip */}
                <div className="px-6 py-1.5 bg-blue-50/60 border-b border-blue-100 flex items-center justify-between text-[11.5px] text-blue-800">
                  <span className="flex items-center gap-1.5">
                    <Pencil size={12} className="text-blue-600" />
                    <strong>Interactive Editing:</strong> Click or edit any cell below to directly change values and fix errors before importing.
                  </span>
                  <span>
                    Selected: <strong>{selectedRowNumbers.size}</strong> rows ({selectedValidCount} valid)
                  </span>
                </div>

                {/* Spreadsheet Table */}
                <div className="flex-1 overflow-auto bg-white">
                  <table className="w-full border-collapse text-[12px]">
                    <thead className="sticky top-0 z-20 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <tr>
                        <th className="px-3 py-2.5 text-center w-10">
                          <input
                            type="checkbox"
                            checked={filteredRows.length > 0 && filteredRows.every((r) => selectedRowNumbers.has(r.rowNumber))}
                            onChange={(e) => {
                              if (e.target.checked) selectAllFiltered();
                              else deselectAllFiltered();
                            }}
                            className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </th>
                        <th className="px-2.5 py-2.5 text-center text-[11px] font-bold text-[#6B7280] uppercase tracking-wider w-12">
                          #
                        </th>
                        <th className="px-2.5 py-2.5 text-center text-[11px] font-bold text-[#6B7280] uppercase tracking-wider w-16">
                          Status
                        </th>
                        {columns.map((col) => (
                          <th
                            key={col.key}
                            style={{ minWidth: col.minWidth || "120px", width: col.width }}
                            className={cn(
                              "px-3 py-2.5 text-[11px] font-bold text-[#6B7280] uppercase tracking-wider",
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                            )}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.header}
                              {col.required && <span className="text-[#E31E24]">*</span>}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#F3F4F6]">
                      {filteredRows.length === 0 ? (
                        <tr>
                          <td colSpan={columns.length + 3} className="py-12 text-center text-[#9CA3AF] text-[13px]">
                            No {filter !== "all" ? filter : ""} records match your search or filter.
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map((row) => {
                          const isSelected = selectedRowNumbers.has(row.rowNumber);
                          return (
                            <tr
                              key={row.rowNumber}
                              className={cn(
                                "transition-colors group",
                                !row.isValid
                                  ? "bg-red-50/20 hover:bg-red-50/40"
                                  : isSelected
                                    ? "bg-blue-50/20 hover:bg-blue-50/30"
                                    : "hover:bg-[#F9FAFB]"
                              )}
                            >
                              {/* Checkbox */}
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleRowSelect(row.rowNumber)}
                                  className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                                />
                              </td>

                              {/* Row Number */}
                              <td className="px-2.5 py-2 text-center font-mono text-[11px] text-[#9CA3AF]">
                                {row.rowNumber}
                              </td>

                              {/* Status / Errors Icon */}
                              <td className="px-2.5 py-2 text-center">
                                {row.isValid ? (
                                  <span className="inline-flex items-center text-emerald-600" title="Row is valid">
                                    <CheckCircle2 size={16} />
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center text-red-600 cursor-help"
                                    title={row.errors?.join("\n") || "Validation error"}
                                  >
                                    <AlertCircle size={16} />
                                  </span>
                                )}
                              </td>

                              {/* Dynamic Columns with Direct Inline Editing */}
                              {columns.map((col) => {
                                const val =
                                  row[col.key] !== undefined && row[col.key] !== null && row[col.key] !== ""
                                    ? row[col.key]
                                    : col.key === "name"
                                      ? (row["attributeName"] ?? row["title"] ?? "")
                                      : col.key === "attributeName"
                                        ? (row["name"] ?? row["title"] ?? "")
                                        : col.key === "role"
                                          ? (row["displayType"] ?? "")
                                          : col.key === "displayType"
                                            ? (row["role"] ?? "")
                                            : col.key === "allowedValues"
                                              ? (row["values"] ?? "")
                                              : col.key === "values"
                                                ? (row["allowedValues"] ?? "")
                                                : col.key === "parentCategory"
                                                  ? (row["parentCategory"] ?? row["parentSlug"] ?? row["parent"] ?? "")
                                                  : col.key === "parentSlug"
                                                    ? (row["parentCategory"] ?? row["parentSlug"] ?? row["parent"] ?? "")
                                                    : col.key === "parent"
                                                      ? (row["parentCategory"] ?? row["parentSlug"] ?? "")
                                                      : col.key === "countryCode" || col.key === "country" || col.key === "countryCodes" || col.key === "countries"
                                                        ? (Array.isArray(row["countryCodes"]) ? row["countryCodes"].join(", ") : (row["countryCodes"] ?? row["countryCode"] ?? row["country"] ?? row["countryName"] ?? ""))
                                                        : col.key === "distributorPrice" || col.key === "doctorRetailerPrice" || col.key === "doctorPrice"
                                                          ? (row["distributorPrice"] ?? row["doctorRetailerPrice"] ?? row["doctorPrice"] ?? row["retailerPrice"] ?? "")
                                                          : col.key === "productTitle" || col.key === "productName"
                                                            ? (row["productTitle"] ?? row["productName"] ?? row["product"] ?? row["title"] ?? "")
                                                            : row[col.key];
                                const hasError =
                                  !row.isValid &&
                                  row.errors?.some(
                                    (e) =>
                                      e.toLowerCase().includes(col.key.toLowerCase()) ||
                                      e.toLowerCase().includes(col.header.toLowerCase())
                                  );

                                const isCellEditing =
                                  editingCell?.rowNumber === row.rowNumber &&
                                  editingCell?.field === col.key;

                                return (
                                  <td
                                    key={col.key}
                                    className={cn(
                                      "px-3 py-1.5 transition-all",
                                      hasError ? "bg-red-100/30 text-red-900" : "",
                                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                                    )}
                                    onClick={() => setEditingCell({ rowNumber: row.rowNumber, field: col.key })}
                                  >
                                    {col.render ? (
                                      col.render(row, val, (newVal) =>
                                        updateCellValue(row.rowNumber, col.key, newVal)
                                      )
                                    ) : col.type === "multiselect" && col.options ? (
                                      <WizardCellMultiSelect
                                        value={val}
                                        options={col.options}
                                        hasError={hasError}
                                        placeholder={col.placeholder || "Select..."}
                                        onChange={(newVal) =>
                                          updateCellValue(row.rowNumber, col.key, newVal)
                                        }
                                      />
                                    ) : col.type === "select" && col.options ? (
                                      (() => {
                                        const valStr = val !== undefined && val !== null ? String(val) : "";
                                        const allOptions = [...(col.options || [])];

                                        const matchedOption = allOptions.find(
                                          (opt) =>
                                            opt.value === valStr ||
                                            opt.label.toLowerCase() === valStr.toLowerCase() ||
                                            opt.value.toLowerCase() === valStr.toLowerCase() ||
                                            (valStr && opt.label.toLowerCase().startsWith(valStr.toLowerCase())) ||
                                            ((valStr.toLowerCase() === "global" || valStr.toLowerCase() === "all countries" || valStr.toLowerCase() === "all" || valStr === "*") && (opt.value === "ALL" || opt.value === "*"))
                                        );

                                        if (!matchedOption && valStr) {
                                          const inFileMatch = rows.find(
                                            (r) =>
                                              String(r.name || "").toLowerCase() === valStr.toLowerCase() ||
                                              String(r.slug || "").toLowerCase() === valStr.toLowerCase()
                                          );
                                          if (inFileMatch) {
                                            allOptions.push({
                                              label: String(inFileMatch.name || valStr),
                                              value: String(inFileMatch.slug || valStr),
                                            });
                                          } else if (
                                            col.key === "countryCodes" ||
                                            col.key === "countryCode" ||
                                            col.key === "country" ||
                                            col.key === "countries"
                                          ) {
                                            allOptions.push({
                                              label: valStr,
                                              value: valStr,
                                            });
                                          }
                                        }

                                        const finalMatch = allOptions.find(
                                          (opt) =>
                                            opt.value === valStr ||
                                            opt.label.toLowerCase() === valStr.toLowerCase() ||
                                            opt.value.toLowerCase() === valStr.toLowerCase() ||
                                            (valStr && opt.label.toLowerCase().startsWith(valStr.toLowerCase())) ||
                                            ((valStr.toLowerCase() === "global" || valStr.toLowerCase() === "all countries" || valStr.toLowerCase() === "all" || valStr === "*") && (opt.value === "ALL" || opt.value === "*"))
                                        );

                                        const selectedVal = finalMatch ? finalMatch.value : valStr;
                                        const isUnrecognized = Boolean(valStr && !finalMatch);
                                        const hasEmptyOption = allOptions.some((o) => o.value === "");

                                        return (
                                          <select
                                            value={selectedVal}
                                            onChange={(e) =>
                                              updateCellValue(row.rowNumber, col.key, e.target.value)
                                            }
                                            className={cn(
                                              "w-full rounded border px-2 py-1 text-[11.5px] bg-white transition-colors cursor-pointer",
                                              hasError || isUnrecognized
                                                ? "border-red-400 focus:border-red-600 ring-1 ring-red-200"
                                                : "border-[#D1D5DB] focus:border-[#1A1A1A]"
                                            )}
                                          >
                                            {!hasEmptyOption && <option value="">Select...</option>}
                                            {isUnrecognized && (
                                              <option value={valStr} disabled>
                                                {valStr} (Unrecognized)
                                              </option>
                                            )}
                                            {allOptions.map((opt) => (
                                              <option key={opt.value} value={opt.value}>
                                                {opt.label}
                                              </option>
                                            ))}
                                          </select>
                                        );
                                      })()
                                    ) : (
                                      <div className="relative flex items-center">
                                        <input
                                          type={col.type === "number" ? "number" : "text"}
                                          value={val !== undefined && val !== null ? val : ""}
                                          placeholder={col.placeholder || ""}
                                          onChange={(e) =>
                                            updateCellValue(
                                              row.rowNumber,
                                              col.key,
                                              col.type === "number"
                                                ? e.target.value === ""
                                                  ? ""
                                                  : Number(e.target.value)
                                                : e.target.value
                                            )
                                          }
                                          onFocus={() =>
                                            setEditingCell({ rowNumber: row.rowNumber, field: col.key })
                                          }
                                          onBlur={() => setEditingCell(null)}
                                          className={cn(
                                            "w-full rounded border px-2 py-1 text-[11.5px] transition-all",
                                            hasError
                                              ? "border-red-400 bg-red-50/50 text-red-900 focus:bg-white focus:border-red-600 focus:ring-1 focus:ring-red-200"
                                              : isCellEditing
                                                ? "border-[#1A1A1A] bg-white ring-1 ring-[#1A1A1A]/10 shadow-xs"
                                                : "border-transparent bg-transparent hover:border-[#D1D5DB] hover:bg-white focus:border-[#1A1A1A] focus:bg-white"
                                          )}
                                        />
                                      </div>
                                    )}
                                    {hasError && (
                                      <p className="mt-0.5 text-[10px] text-red-600 font-medium truncate max-w-[200px]">
                                        {row.errors?.find(
                                          (e) =>
                                            e.toLowerCase().includes(col.key.toLowerCase()) ||
                                            e.toLowerCase().includes(col.header.toLowerCase())
                                        )}
                                      </p>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Toolbar */}
                {filteredRows.length > 0 && (
                  <div className="shrink-0 flex flex-wrap items-center justify-between border-t border-[#E5E7EB] bg-[#F9FAFB] px-6 py-2.5 text-[12px] text-[#6B7280]">
                    <div className="flex items-center gap-3">
                      <span>
                        Showing <strong className="text-[#1A1A1A]">{startIndex + 1}</strong> to{" "}
                        <strong className="text-[#1A1A1A]">{endIndex}</strong> of{" "}
                        <strong className="text-[#1A1A1A]">{filteredRows.length.toLocaleString()}</strong> rows
                      </span>
                      <div className="flex items-center gap-1.5 pl-3 border-l border-[#E5E7EB]">
                        <span className="text-[11px]">Rows per page:</span>
                        <select
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setCurrentPage(1);
                          }}
                          className="rounded border border-[#D1D5DB] bg-white px-2 py-0.5 text-[11px] font-medium text-[#1A1A1A] outline-none cursor-pointer"
                        >
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                          <option value={200}>200</option>
                          <option value={500}>500</option>
                        </select>
                      </div>
                    </div>

                    {totalPages > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={safeCurrentPage <= 1}
                          className="rounded border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          Previous
                        </button>
                        <span className="text-[11px] font-medium text-[#374151]">
                          Page {safeCurrentPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={safeCurrentPage >= totalPages}
                          className="rounded border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Footer actions */}
                <div className="shrink-0 px-6 py-3.5 bg-white border-t border-[#E5E7EB] flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2 text-[12.5px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                  >
                    <ArrowLeft size={14} />
                    Back to Upload
                  </button>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-[12.5px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={executeImport}
                      disabled={selectedRowNumbers.size === 0 || executing}
                      className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-40 cursor-pointer shadow-xs"
                    >
                      {executing ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          Importing Selected...
                        </>
                      ) : (
                        <>
                          Import {selectedRowNumbers.size} Selected
                          <ArrowRight size={14} />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: EXECUTE / COMPLETION */}
            {step === 2 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white">
                {executing && (
                  <div className="flex flex-col items-center gap-4 w-full max-w-md">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-[#E31E24] shadow-xs animate-pulse">
                      <Loader2 size={32} className="animate-spin" />
                    </div>
                    <div className="text-center w-full">
                      <h3 className="text-[17px] font-bold text-[#1A1A1A]">Importing {entityName}...</h3>
                      {importProgress ? (
                        <div className="mt-4 w-full">
                          <div className="flex items-center justify-between text-[12px] font-semibold text-[#4B5563] mb-1.5">
                            <span>Batch {importProgress.batch} of {importProgress.totalBatches}</span>
                            <span className="font-bold text-[#E31E24]">
                              {importProgress.total > 0
                                ? Math.round((importProgress.current / importProgress.total) * 100)
                                : 0}
                              %
                            </span>
                          </div>
                          <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                            <div
                              className="h-full bg-gradient-to-r from-[#E31E24] to-[#B5151B] transition-all duration-300 rounded-full"
                              style={{
                                width: `${
                                  importProgress.total > 0
                                    ? Math.min(100, Math.round((importProgress.current / importProgress.total) * 100))
                                    : 5
                                }%`,
                              }}
                            />
                          </div>
                          <p className="mt-2 text-[11.5px] text-[#6B7280]">
                            {importProgress.current.toLocaleString()} of {importProgress.total.toLocaleString()} rows processed
                          </p>
                        </div>
                      ) : (
                        <p className="mt-1 text-[13px] text-[#6B7280]">
                          Please wait while your records are processed and validated.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {!executing && executeResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", damping: 18, stiffness: 220 }}
                    className="flex flex-col items-center gap-6 max-w-md text-center"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-200">
                      <Check size={38} strokeWidth={3} />
                    </div>
                    <div>
                      <h3 className="text-[20px] font-bold text-[#1A1A1A]">Import Complete!</h3>
                      <p className="mt-1 text-[13px] text-[#6B7280]">
                        Your {entityName} have been imported and updated successfully.
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-3 min-w-[120px]">
                        <span className="text-[26px] font-bold text-emerald-600">{executeResult.created}</span>
                        <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide">
                          Created
                        </span>
                      </div>
                      <div className="flex flex-col items-center rounded-xl border border-blue-200 bg-blue-50 px-6 py-3 min-w-[120px]">
                        <span className="text-[26px] font-bold text-blue-600">{executeResult.updated}</span>
                        <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide">
                          Updated
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="mt-2 rounded-md bg-[#E31E24] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-sm cursor-pointer"
                    >
                      Done
                    </button>
                  </motion.div>
                )}

                {!executing && executeError && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-5 max-w-md text-center"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-[#E31E24]">
                      <XCircle size={38} strokeWidth={2.5} />
                    </div>
                    <div>
                      <h3 className="text-[18px] font-bold text-[#1A1A1A]">Import Failed</h3>
                      <p className="mt-1 text-[13px] text-red-600">{executeError}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-5 py-2 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
                    >
                      <RefreshCw size={14} />
                      Go Back to Preview
                    </button>
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
