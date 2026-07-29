"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Download,
  Trash2,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Check,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

/* ─────────────────── Types ─────────────────── */

interface AttributeValue {
  attributeId: string;
  attributeName: string;
  attributeValueId: string;
  value: string;
}

interface PreviewRow {
  rowNumber: number;
  sku: string;
  variantTitle: string;
  stock: number;
  lowStockThreshold: number;
  price: number;
  mrp: number;
  status: string;
  attributeValues: AttributeValue[];
  isValid: boolean;
  errors: string[];
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
}

interface ExecuteResult {
  created: number;
  updated: number;
}

interface BulkVariantImportWizardProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  attributeNames?: string[];
  onSuccess: () => void;
}

/* ─────────────────── Step Indicator ─────────────────── */

const STEPS = [
  { id: 0, label: "Upload" },
  { id: 1, label: "Preview" },
  { id: 2, label: "Import" },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 py-4 px-6">
      {STEPS.map((step, idx) => (
        <div key={step.id} className="flex items-center">
          {/* circle */}
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold transition-all duration-300",
                current > step.id
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                  : current === step.id
                    ? "bg-[#E31E24] text-white shadow-md shadow-red-200"
                    : "border-2 border-[#D1D5DB] bg-white text-[#9CA3AF]"
              )}
            >
              {current > step.id ? <Check size={14} strokeWidth={3} /> : step.id + 1}
            </div>
            <span
              className={cn(
                "mt-1.5 text-[11px] font-semibold transition-colors",
                current >= step.id ? "text-[#1A1A1A]" : "text-[#9CA3AF]"
              )}
            >
              {step.label}
            </span>
          </div>
          {/* connector line */}
          {idx < STEPS.length - 1 && (
            <div className="mx-3 mb-5 h-[2px] w-16 rounded-full bg-[#E5E7EB] overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500 rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: current > step.id ? "100%" : "0%" }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─────────────────── File Size Formatter ─────────────────── */

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ─────────────────── Main Wizard ─────────────────── */

export function BulkVariantImportWizard({
  open,
  onClose,
  productId,
  attributeNames = [],
  onSuccess,
}: BulkVariantImportWizardProps) {
  /* ── State ── */
  const [mounted, setMounted] = useState(false);
  const [step, setStep] = useState(0);

  // Step 1: Upload
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2: Preview
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  // Step 3: Execute
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<ExecuteResult | null>(null);
  const [executeError, setExecuteError] = useState("");

  /* ── Mount guard for portal ── */
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  /* ── Reset state on close ── */
  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        setStep(0);
        setFile(null);
        setDragging(false);
        setUploading(false);
        setUploadError("");
        setPreview(null);
        setRows([]);
        setSelectedIds(new Set());
        setFilter("all");
        setEditingCell(null);
        setExecuting(false);
        setExecuteResult(null);
        setExecuteError("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  /* ── File handling ── */
  const ACCEPTED = ".csv,.xlsx,.xls";
  const ACCEPTED_TYPES = [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  const handleFileSelect = useCallback((f: File) => {
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (!ext || !["csv", "xlsx", "xls"].includes(ext)) {
      setUploadError("Please upload a .csv, .xlsx, or .xls file.");
      return;
    }
    setFile(f);
    setUploadError("");
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) handleFileSelect(f);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
  }, []);

  const handleBrowse = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFileSelect(f);
      // Reset input so re-selecting the same file works
      if (e.target) e.target.value = "";
    },
    [handleFileSelect]
  );

  const removeFile = useCallback(() => {
    setFile(null);
    setUploadError("");
  }, []);

  /* ── Download Template ── */
  const downloadTemplate = useCallback(() => {
    const baseHeaders = ["SKU", "Stock", "Low Stock", "Price", "MRP", "Status"];
    const headers = [...baseHeaders, ...attributeNames];
    const baseSample = ["SAMPLE-SKU-001", "100", "10", "29.99", "39.99", "ACTIVE"];
    const attrSamples = attributeNames.map((name) => `Enter ${name}`);
    const sampleRow = [...baseSample, ...attrSamples];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "variant_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [attributeNames]);

  /* ── Upload & Preview ── */
  const uploadAndPreview = useCallback(async () => {
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await adminApi.post(
        `/products/${productId}/variants/import-preview`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }
      );
      const data: PreviewResult = res.data.data;
      setPreview(data);
      setRows(data.rows);
      // Auto-select all valid rows
      const validIds = new Set(data.rows.filter((r) => r.isValid).map((r) => r.rowNumber));
      setSelectedIds(validIds);
      setStep(1);
    } catch (err) {
      setUploadError(getAdminErrorMessage(err, "Failed to process file. Please check format."));
    } finally {
      setUploading(false);
    }
  }, [file, productId]);

  /* ── Inline edit handler ── */
  const updateRow = useCallback(
    (rowNumber: number, field: string, value: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.rowNumber !== rowNumber) return r;
          const updated = { ...r };
          switch (field) {
            case "sku":
              updated.sku = value;
              break;
            case "stock":
              updated.stock = parseInt(value) || 0;
              break;
            case "lowStockThreshold":
              updated.lowStockThreshold = parseInt(value) || 0;
              break;
            case "price":
              updated.price = parseFloat(value) || 0;
              break;
            case "mrp":
              updated.mrp = parseFloat(value) || 0;
              break;
            case "status":
              updated.status = value;
              break;
          }
          // Re-validate
          const errors: string[] = [];
          if (!updated.sku.trim()) errors.push("SKU is required.");
          if (updated.stock < 0) errors.push("Stock must be non-negative.");
          if (updated.lowStockThreshold < 0) errors.push("Low Stock must be non-negative.");
          if (updated.price < 0) errors.push("Price must be non-negative.");
          if (updated.mrp < 0) errors.push("MRP must be non-negative.");
          updated.errors = errors;
          updated.isValid = errors.length === 0;
          return updated;
        })
      );
    },
    []
  );

  /* ── Selection helpers ── */
  const toggleRow = useCallback((rowNumber: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowNumber)) next.delete(rowNumber);
      else next.add(rowNumber);
      return next;
    });
  }, []);

  const selectAllValid = useCallback(() => {
    const validIds = rows.filter((r) => r.isValid).map((r) => r.rowNumber);
    setSelectedIds(new Set(validIds));
  }, [rows]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  /* ── Filtered rows ── */
  const filteredRows = useMemo(() => {
    if (filter === "valid") return rows.filter((r) => r.isValid);
    if (filter === "invalid") return rows.filter((r) => !r.isValid);
    return rows;
  }, [rows, filter]);

  /* ── Selected valid count ── */
  const selectedValidCount = useMemo(() => {
    return rows.filter((r) => r.isValid && selectedIds.has(r.rowNumber)).length;
  }, [rows, selectedIds]);

  /* ── Execute Import ── */
  const executeImport = useCallback(async () => {
    const selectedRows = rows.filter(
      (r) => r.isValid && selectedIds.has(r.rowNumber)
    );
    if (selectedRows.length === 0) return;

    setExecuting(true);
    setExecuteError("");
    setStep(2);

    try {
      const res = await adminApi.post(
        `/products/${productId}/variants/import-execute`,
        { rows: selectedRows },
        { timeout: 120000 }
      );
      setExecuteResult(res.data.data);
    } catch (err) {
      setExecuteError(
        getAdminErrorMessage(err, "Import failed. Please try again.")
      );
    } finally {
      setExecuting(false);
    }
  }, [rows, selectedIds, productId]);

  /* ── Close with success ── */
  const handleSuccessClose = useCallback(() => {
    onSuccess();
    onClose();
  }, [onSuccess, onClose]);

  /* ── Retry ── */
  const handleRetry = useCallback(() => {
    setStep(1);
    setExecuteError("");
    setExecuteResult(null);
  }, []);

  /* ── Don't render on server ── */
  if (!mounted) return null;

  /* ── Portal ── */
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          id="bulk-import-overlay"
        >
          <motion.div
            className="flex w-full max-w-5xl max-h-[90vh] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div className="shrink-0 border-b border-[#E6E6E6] px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#1A1A1A]">
                  Bulk Import Variants
                </h3>
                <p className="text-[12px] text-[#6B6B6B] mt-0.5">
                  Import variants from a CSV or Excel spreadsheet
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-[#9CA3AF] hover:text-[#1A1A1A] hover:bg-[#F3F4F6] transition-colors"
                id="bulk-import-close"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── Step Indicator ── */}
            <div className="shrink-0 border-b border-[#F3F4F6] bg-[#FAFAFA]">
              <StepIndicator current={step} />
            </div>

            {/* ── Body (with step transitions) ── */}
            <div className="flex-1 overflow-hidden relative">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step-upload"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex flex-col"
                  >
                    <UploadStep
                      file={file}
                      dragging={dragging}
                      uploading={uploading}
                      uploadError={uploadError}
                      fileInputRef={fileInputRef}
                      accepted={ACCEPTED}
                      attributeNames={attributeNames}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onBrowse={handleBrowse}
                      onFileInputChange={handleFileInputChange}
                      onRemoveFile={removeFile}
                      onDownloadTemplate={downloadTemplate}
                      onUpload={uploadAndPreview}
                      onCancel={onClose}
                    />
                  </motion.div>
                )}

                {step === 1 && (
                  <motion.div
                    key="step-preview"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex flex-col"
                  >
                    <PreviewStep
                      preview={preview}
                      rows={rows}
                      filteredRows={filteredRows}
                      selectedIds={selectedIds}
                      filter={filter}
                      editingCell={editingCell}
                      selectedValidCount={selectedValidCount}
                      onFilterChange={setFilter}
                      onToggleRow={toggleRow}
                      onSelectAllValid={selectAllValid}
                      onClearSelection={clearSelection}
                      onUpdateRow={updateRow}
                      onEditCell={setEditingCell}
                      onBack={() => setStep(0)}
                      onExecute={executeImport}
                    />
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-execute"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 30 }}
                    transition={{ duration: 0.2 }}
                    className="h-full flex flex-col"
                  >
                    <ExecuteStep
                      executing={executing}
                      result={executeResult}
                      error={executeError}
                      onClose={handleSuccessClose}
                      onRetry={handleRetry}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 1 — Upload
   ═══════════════════════════════════════════════════════════ */

interface UploadStepProps {
  file: File | null;
  dragging: boolean;
  uploading: boolean;
  uploadError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  accepted: string;
  attributeNames: string[];
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onBrowse: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onDownloadTemplate: () => void;
  onUpload: () => void;
  onCancel: () => void;
}

function UploadStep({
  file,
  dragging,
  uploading,
  uploadError,
  fileInputRef,
  accepted,
  attributeNames,
  onDrop,
  onDragOver,
  onDragLeave,
  onBrowse,
  onFileInputChange,
  onRemoveFile,
  onDownloadTemplate,
  onUpload,
  onCancel,
}: UploadStepProps) {
  return (
    <>
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Drop zone */}
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 px-8 transition-all duration-200 cursor-pointer",
            dragging
              ? "border-[#E31E24] bg-red-50/50 scale-[1.01]"
              : file
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-[#D1D5DB] bg-[#FAFAFA] hover:border-[#9CA3AF] hover:bg-[#F5F5F5]"
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={!file ? onBrowse : undefined}
          id="bulk-import-dropzone"
        >
          <input
            ref={fileInputRef as React.RefObject<HTMLInputElement>}
            type="file"
            accept={accepted}
            onChange={onFileInputChange}
            className="hidden"
            id="bulk-import-file-input"
          />

          {!file ? (
            <>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-50 to-red-100 mb-4">
                <Upload size={28} className="text-[#E31E24]" />
              </div>
              <p className="text-[14px] font-semibold text-[#1A1A1A] mb-1">
                Drag & drop your file here
              </p>
              <p className="text-[12px] text-[#6B6B6B] mb-3">
                Supports .csv, .xlsx, .xls files
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onBrowse();
                }}
                className="text-[13px] font-semibold text-[#E31E24] hover:text-[#B5151B] underline underline-offset-2 transition-colors"
                id="bulk-import-browse"
              >
                or browse files
              </button>
            </>
          ) : (
            <div className="flex items-center gap-4 w-full max-w-md">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
                <FileSpreadsheet size={22} className="text-emerald-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">
                  {file.name}
                </p>
                <p className="text-[11px] text-[#6B6B6B]">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile();
                }}
                className="shrink-0 p-2 rounded-lg text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 transition-colors"
                id="bulk-import-remove-file"
                aria-label="Remove file"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Error */}
        {uploadError && (
          <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[12px] text-red-600">{uploadError}</p>
          </div>
        )}

        {/* Template download */}
        <div className="mt-6 flex items-center justify-between rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3.5">
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">
              Need a template?
            </p>
            <p className="text-[11px] text-[#6B6B6B] mt-0.5">
              Download a sample CSV with the required columns
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-3.5 py-2 text-[12px] font-medium text-white hover:bg-[#333] transition-colors"
            id="bulk-import-download-template"
          >
            <Download size={13} />
            Download Template
          </button>
        </div>

        {/* Column info */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3">
          <p className="text-[11px] font-semibold text-blue-700 mb-1.5">
            Expected Columns
          </p>
          <p className="text-[11px] text-blue-600 leading-relaxed">
            <span className="font-semibold">Required:</span> SKU &nbsp;|&nbsp;{" "}
            <span className="font-semibold">Optional:</span> Stock, Low Stock,
            Price, MRP, Status
            {attributeNames.length > 0 && (
              <>
                {" "}&nbsp;|&nbsp;{" "}
                <span className="font-semibold">Attributes:</span>{" "}
                {attributeNames.map((name, i) => (
                  <span key={name}>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">{name}</span>
                    {i < attributeNames.length - 1 && <>, </>}
                  </span>
                ))}
              </>
            )}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E6E6E6] bg-white px-6 py-4 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
          id="bulk-import-cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onUpload}
          disabled={!file || uploading}
          className="flex items-center gap-2 rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          id="bulk-import-upload-btn"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Processing...
            </>
          ) : (
            <>
              Upload & Preview
              <ArrowRight size={14} />
            </>
          )}
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 2 — Preview & Edit Grid
   ═══════════════════════════════════════════════════════════ */

interface PreviewStepProps {
  preview: PreviewResult | null;
  rows: PreviewRow[];
  filteredRows: PreviewRow[];
  selectedIds: Set<number>;
  filter: "all" | "valid" | "invalid";
  editingCell: { row: number; field: string } | null;
  selectedValidCount: number;
  onFilterChange: (f: "all" | "valid" | "invalid") => void;
  onToggleRow: (rowNumber: number) => void;
  onSelectAllValid: () => void;
  onClearSelection: () => void;
  onUpdateRow: (rowNumber: number, field: string, value: string) => void;
  onEditCell: (cell: { row: number; field: string } | null) => void;
  onBack: () => void;
  onExecute: () => void;
}

function PreviewStep({
  preview,
  rows,
  filteredRows,
  selectedIds,
  filter,
  editingCell,
  selectedValidCount,
  onFilterChange,
  onToggleRow,
  onSelectAllValid,
  onClearSelection,
  onUpdateRow,
  onEditCell,
  onBack,
  onExecute,
}: PreviewStepProps) {
  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  return (
    <>
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Summary bar */}
        <div className="shrink-0 px-6 py-4 flex flex-wrap items-center gap-4 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#F3F4F6] px-3 py-1 text-[12px] font-semibold text-[#4B5563]">
              {preview?.totalRows ?? 0} Total
            </span>
            <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[12px] font-semibold text-emerald-700">
              {validCount} Valid
            </span>
            <span className="rounded-full bg-red-50 border border-red-200 px-3 py-1 text-[12px] font-semibold text-red-600">
              {invalidCount} Invalid
            </span>
          </div>

          <div className="flex-1" />

          {/* Filter tabs */}
          <div className="flex rounded-lg border border-[#E6E6E6] overflow-hidden">
            {(["all", "valid", "invalid"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => onFilterChange(f)}
                className={cn(
                  "px-3 py-1.5 text-[11px] font-semibold transition-colors capitalize",
                  filter === f
                    ? "bg-[#1A1A1A] text-white"
                    : "bg-white text-[#6B6B6B] hover:bg-[#F5F5F5]"
                )}
                id={`bulk-import-filter-${f}`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Selection actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSelectAllValid}
              className="text-[11px] font-semibold text-[#E31E24] hover:text-[#B5151B] underline underline-offset-2 transition-colors"
              id="bulk-import-select-valid"
            >
              Select all valid
            </button>
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={onClearSelection}
                className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] underline underline-offset-2 transition-colors"
                id="bulk-import-clear-selection"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
              <tr>
                <th className="px-3 py-2.5 text-left w-10">
                  <span className="sr-only">Select</span>
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">
                  Row
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[140px]">
                  SKU
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[160px]">
                  Variant Title
                </th>
                {attributeNames?.map((name) => (
                  <th
                    key={name}
                    className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[100px]"
                  >
                    {name}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                  Stock
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">
                  Low Stock
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                  Price
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                  MRP
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                  Status
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[200px]">
                  Errors
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3F4F6]">
              {filteredRows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    "group transition-colors",
                    !row.isValid
                      ? "bg-red-50/60 hover:bg-red-50"
                      : selectedIds.has(row.rowNumber)
                        ? "bg-emerald-50/40 hover:bg-emerald-50/60"
                        : "hover:bg-[#F9FAFB]"
                  )}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.rowNumber)}
                      onChange={() => onToggleRow(row.rowNumber)}
                      className="h-3.5 w-3.5 rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                      id={`bulk-import-row-check-${row.rowNumber}`}
                    />
                  </td>
                  {/* Row number */}
                  <td className="px-3 py-2 text-[#9CA3AF] font-mono">
                    {row.rowNumber}
                  </td>
                  {/* Editable cells */}
                  <EditableCell
                    value={row.sku}
                    rowNumber={row.rowNumber}
                    field="sku"
                    editing={editingCell}
                    onEdit={onEditCell}
                    onUpdate={onUpdateRow}
                  />
                  {/* Variant title (read only) */}
                  <td className="px-3 py-2 text-[#374151] font-medium">
                    {row.variantTitle}
                  </td>
                  {/* Dynamic parsed attributes (read only for reference/mismatch correction) */}
                  {attributeNames?.map((name) => {
                    const attrVal = row.attributeValues?.find(
                      (v) => v.attributeName.toLowerCase() === name.toLowerCase()
                    );
                    return (
                      <td key={name} className="px-3 py-2 text-[#4B5563]">
                        <span className={cn(
                          "inline-block rounded px-1.5 py-0.5 text-[11px] font-mono",
                          attrVal ? "bg-gray-100 text-gray-800" : "bg-red-50 text-red-700 border border-red-200"
                        )}>
                          {attrVal ? attrVal.value : "Missing / Bad Value"}
                        </span>
                      </td>
                    );
                  })}
                  <EditableCell
                    value={String(row.stock)}
                    rowNumber={row.rowNumber}
                    field="stock"
                    editing={editingCell}
                    onEdit={onEditCell}
                    onUpdate={onUpdateRow}
                    align="right"
                    type="number"
                  />
                  <EditableCell
                    value={String(row.lowStockThreshold)}
                    rowNumber={row.rowNumber}
                    field="lowStockThreshold"
                    editing={editingCell}
                    onEdit={onEditCell}
                    onUpdate={onUpdateRow}
                    align="right"
                    type="number"
                  />
                  <EditableCell
                    value={String(row.price)}
                    rowNumber={row.rowNumber}
                    field="price"
                    editing={editingCell}
                    onEdit={onEditCell}
                    onUpdate={onUpdateRow}
                    align="right"
                    type="number"
                  />
                  <EditableCell
                    value={String(row.mrp)}
                    rowNumber={row.rowNumber}
                    field="mrp"
                    editing={editingCell}
                    onEdit={onEditCell}
                    onUpdate={onUpdateRow}
                    align="right"
                    type="number"
                  />
                  {/* Status */}
                  <td className="px-3 py-2 text-center">
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  {/* Errors */}
                  <td className="px-3 py-2">
                    {row.errors.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {row.errors.map((err, i) => (
                          <span
                            key={i}
                            className="text-[11px] text-red-500 leading-snug"
                          >
                            • {err}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-emerald-500">
                        <CheckCircle2 size={14} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-12 text-center text-[13px] text-[#9CA3AF]"
                  >
                    No rows to display
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E6E6E6] bg-white px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors"
          id="bulk-import-back"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <button
          type="button"
          onClick={onExecute}
          disabled={selectedValidCount === 0}
          className="flex items-center gap-2 rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          id="bulk-import-execute-btn"
        >
          Import {selectedValidCount} Variant{selectedValidCount !== 1 ? "s" : ""}
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

/* ── Editable Cell ── */

interface EditableCellProps {
  value: string;
  rowNumber: number;
  field: string;
  editing: { row: number; field: string } | null;
  onEdit: (cell: { row: number; field: string } | null) => void;
  onUpdate: (rowNumber: number, field: string, value: string) => void;
  align?: "left" | "right";
  type?: "text" | "number";
}

function EditableCell({
  value,
  rowNumber,
  field,
  editing,
  onEdit,
  onUpdate,
  align = "left",
  type = "text",
}: EditableCellProps) {
  const isEditing = editing?.row === rowNumber && editing?.field === field;
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commitEdit = useCallback(() => {
    onUpdate(rowNumber, field, draft);
    onEdit(null);
  }, [draft, field, onEdit, onUpdate, rowNumber]);

  if (isEditing) {
    return (
      <td className={cn("px-1 py-1", align === "right" && "text-right")}>
        <input
          autoFocus
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") onEdit(null);
          }}
          className={cn(
            "w-full rounded border border-[#E31E24] bg-white px-2 py-1 text-[12px] text-[#1A1A1A] outline-none ring-2 ring-red-100",
            align === "right" && "text-right"
          )}
        />
      </td>
    );
  }

  return (
    <td
      className={cn(
        "px-3 py-2 cursor-pointer transition-colors group-hover:bg-transparent",
        align === "right" ? "text-right" : "text-left",
        "text-[#374151]"
      )}
      onClick={() => onEdit({ row: rowNumber, field })}
      title="Click to edit"
    >
      <span className="inline-block rounded px-1 py-0.5 transition-colors group-hover:bg-yellow-50 group-hover:ring-1 group-hover:ring-yellow-200">
        {value}
      </span>
    </td>
  );
}

/* ═══════════════════════════════════════════════════════════
   Step 3 — Execution & Results
   ═══════════════════════════════════════════════════════════ */

interface ExecuteStepProps {
  executing: boolean;
  result: ExecuteResult | null;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}

function ExecuteStep({
  executing,
  result,
  error,
  onClose,
  onRetry,
}: ExecuteStepProps) {
  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <AnimatePresence mode="wait">
        {executing && (
          <motion.div
            key="executing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-[#F3F4F6] border-t-[#E31E24] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-bold text-[#1A1A1A]">
                Importing Variants...
              </p>
              <p className="text-[12px] text-[#6B6B6B] mt-1">
                Creating and updating variant records
              </p>
            </div>
            {/* Pulsing dots */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="h-2 w-2 rounded-full bg-[#E31E24]"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: i * 0.2,
                  }}
                />
              ))}
            </div>
          </motion.div>
        )}

        {!executing && result && (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", damping: 15, stiffness: 200 }}
            className="flex flex-col items-center gap-5"
          >
            {/* Success icon */}
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-200">
              <Check size={36} className="text-white" strokeWidth={3} />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-[#1A1A1A]">
                Import Complete!
              </p>
              <p className="text-[13px] text-[#6B6B6B] mt-1">
                Your variants have been imported successfully
              </p>
            </div>
            {/* Stats */}
            <div className="flex items-center gap-6 mt-2">
              <div className="flex flex-col items-center rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 min-w-[120px]">
                <span className="text-[28px] font-bold text-emerald-600">
                  {result.created}
                </span>
                <span className="text-[11px] font-semibold text-emerald-500 uppercase tracking-wide mt-0.5">
                  Created
                </span>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-blue-200 bg-blue-50 px-6 py-4 min-w-[120px]">
                <span className="text-[28px] font-bold text-blue-600">
                  {result.updated}
                </span>
                <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mt-0.5">
                  Updated
                </span>
              </div>
            </div>
            {/* Close */}
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-md bg-[#E31E24] px-8 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-md shadow-red-100"
              id="bulk-import-done"
            >
              Done
            </button>
          </motion.div>
        )}

        {!executing && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-red-400 to-red-600 shadow-lg shadow-red-200">
              <XCircle size={36} className="text-white" strokeWidth={2.5} />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-[#1A1A1A]">
                Import Failed
              </p>
              <p className="text-[13px] text-red-500 mt-1 max-w-md">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 flex items-center gap-2 rounded-md border border-[#E6E6E6] px-5 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
              id="bulk-import-retry"
            >
              <RefreshCw size={14} />
              Go Back & Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
