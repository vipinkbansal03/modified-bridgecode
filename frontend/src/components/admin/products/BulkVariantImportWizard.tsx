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
  Plus,
  Globe,
} from "lucide-react";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { useAdminTiers, useAdminCountries } from "@/hooks/admin/useAdminHooks";
import { AdminMultiSelect, AdminSelect, AdminInput } from "@/components/admin/AdminComponents";

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
  dealerPrice?: number | null;
  doctorPrice?: number | null;
  countryCodes?: string;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  fragile?: boolean;
  hazardous?: boolean;
  moq?: number;
  shippingClass?: string | null;
  status: string;
  attributeValues: AttributeValue[];
  isValid: boolean;
  errors: string[];
}

export interface TierOverrideRow {
  rowNumber?: number;
  variantSku: string;
  tierName: string;
  tierId?: string;
  country: string;
  countryId?: string;
  mode: "PERCENTAGE" | "FIXED_PRICE";
  value: number;
  isValid?: boolean;
  errors?: string[];
}

export interface MoqOverrideRow {
  rowNumber?: number;
  variantSku: string;
  country: string;
  countryId?: string;
  minQuantity: number;
  maxQuantity?: number | null;
  mode: "PERCENTAGE" | "FIXED_PRICE";
  value: number;
  isValid?: boolean;
  errors?: string[];
}

interface PreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  rows: PreviewRow[];
  tierOverrides?: TierOverrideRow[];
  moqOverrides?: MoqOverrideRow[];
}

interface ExecuteResult {
  created: number;
  updated: number;
}

interface BulkVariantImportWizardProps {
  open: boolean;
  onClose: () => void;
  productId: string;
  productName?: string;
  attributeNames?: string[];
  attributeMappings?: any[];
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
  productName = "",
  attributeNames = [],
  attributeMappings = [],
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
  const [tierOverrides, setTierOverrides] = useState<TierOverrideRow[]>([]);
  const [moqOverrides, setMoqOverrides] = useState<MoqOverrideRow[]>([]);
  const [activePreviewTab, setActivePreviewTab] = useState<"variants" | "tierOverrides" | "moqOverrides">("variants");
  const { data: tiersData = [] } = useAdminTiers();
  const { data: countriesData = [] } = useAdminCountries();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<"all" | "valid" | "invalid">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [editingCell, setEditingCell] = useState<{ row: number; field: string } | null>(null);

  // Step 3: Execute
  const [executing, setExecuting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    current: number;
    total: number;
    batch: number;
    totalBatches: number;
    created: number;
    updated: number;
  } | null>(null);
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
        setTierOverrides([]);
        setMoqOverrides([]);
        setActivePreviewTab("variants");
        setSelectedIds(new Set());
        setFilter("all");
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
    const baseHeaders = ["Product", "SKU", "Stock", "Low Stock", "Price", "MRP", "Status"];
    const headers = [...baseHeaders, ...attributeNames];
    
    // Attempt to map real allowed attribute values as sample template data so the CSV is valid on import
    const attrSamples = attributeNames.map((name) => {
      const mapping = attributeMappings?.find(
        (m: any) => m.attribute?.name.toLowerCase() === name.toLowerCase()
      );
      const firstAllowed = mapping?.allowedValues?.[0]?.attributeValue?.value;
      return firstAllowed || `Enter ${name}`;
    });

    const baseSample = [
      productName || "Product Name",
      "SAMPLE-SKU-001",
      "100",
      "10",
      "29.99",
      "39.99",
      "ACTIVE"
    ];
    const sampleRow = [...baseSample, ...attrSamples];
    const csvContent = [headers.join(","), sampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sanitizedProdName = productName ? productName.replace(/[^a-zA-Z0-9]/g, "_") : "variants";
    a.download = `import_template_for_${sanitizedProdName}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [attributeNames, attributeMappings, productName]);

  const downloadMultiSheetTemplate = useCallback(async () => {
    try {
      const response = await adminApi.get(`/products/${productId}/variants/sample-template`, {
        responseType: "blob",
      });
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const sanitizedProdName = productName ? productName.replace(/[^a-zA-Z0-9]/g, "_") : "variants";
      a.download = `variant_import_template_${sanitizedProdName}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      downloadTemplate();
    }
  }, [productId, productName, downloadTemplate]);

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
        { timeout: 60000 }
      );
      const data: PreviewResult = res.data.data;
      setPreview(data);
      setRows(data.rows);
      setTierOverrides(data.tierOverrides || []);
      setMoqOverrides(data.moqOverrides || []);
      setActivePreviewTab("variants");
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

  /* ── Override item helpers ── */
  const handleAddTierOverride = useCallback((rule: TierOverrideRow) => {
    setTierOverrides((prev) => [...prev, rule]);
  }, []);

  const handleUpdateTierOverride = useCallback(
    (index: number, field: keyof TierOverrideRow, value: any) => {
      setTierOverrides((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { ...next[index], [field]: value };
          if (field === "tierName") {
            const match = tiersData.find(
              (t: any) => t.name.toLowerCase() === String(value).toLowerCase()
            );
            if (match) next[index].tierId = match.id;
          }
        }
        return next;
      });
    },
    [tiersData]
  );

  const handleDeleteTierOverride = useCallback((index: number) => {
    setTierOverrides((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMoqOverride = useCallback((rule: MoqOverrideRow) => {
    setMoqOverrides((prev) => [...prev, rule]);
  }, []);

  const handleUpdateMoqOverride = useCallback(
    (index: number, field: keyof MoqOverrideRow, value: any) => {
      setMoqOverrides((prev) => {
        const next = [...prev];
        if (next[index]) {
          next[index] = { ...next[index], [field]: value };
        }
        return next;
      });
    },
    []
  );

  const handleDeleteMoqOverride = useCallback((index: number) => {
    setMoqOverrides((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /* ── Inline edit handler ── */
  const updateRow = useCallback(
    (rowNumber: number, field: string, value: string) => {
      setRows((prev) => {
        let isRowNowValid = false;
        const next = prev.map((r) => {
          if (r.rowNumber !== rowNumber) return r;
          const updated = { ...r };

          if (field.startsWith("attr:")) {
            const attrName = field.substring(5);
            const mapping = attributeMappings?.find(
              (m: any) => m.attribute?.name.toLowerCase() === attrName.toLowerCase()
            );
            const allowedVal = mapping?.allowedValues?.find(
              (av: any) => av.attributeValueId === value
            );

            if (allowedVal) {
              const av = {
                attributeId: mapping.attributeId,
                attributeName: mapping.attribute.name,
                attributeValueId: allowedVal.attributeValueId,
                value: allowedVal.attributeValue.value,
              };

              const nextAttributeValues = [...updated.attributeValues];
              const idx = nextAttributeValues.findIndex(
                (item) => item.attributeName.toLowerCase() === attrName.toLowerCase()
              );
              if (idx !== -1) {
                nextAttributeValues[idx] = av;
              } else {
                nextAttributeValues.push(av);
              }
              updated.attributeValues = nextAttributeValues;
            }

            // Update title
            const titles = attributeNames?.map((name) => {
              const matched = updated.attributeValues.find(
                (av) => av.attributeName.toLowerCase() === name.toLowerCase()
              );
              return matched ? matched.value : "?";
            }).filter(Boolean);
            updated.variantTitle = titles?.join(" / ") || updated.variantTitle;

            // Clear errors for this attribute
            const cleanErrors = updated.errors.filter(
              (err) => !err.includes(`"${attrName}"`) && !err.includes(`for "${attrName}"`)
            );
            updated.errors = cleanErrors;
            updated.isValid = cleanErrors.length === 0;

            isRowNowValid = updated.isValid;
            return updated;
          }

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
            case "dealerPrice":
              updated.dealerPrice = value ? parseFloat(value) : null;
              break;
            case "doctorPrice":
              updated.doctorPrice = value ? parseFloat(value) : null;
              break;
            case "countryCodes":
              updated.countryCodes = value;
              break;
            case "status":
              updated.status = value;
              break;
          }
          // Re-validate basic fields
          const errors: string[] = [];
          if (!updated.sku.trim()) errors.push("SKU is required.");
          if (updated.stock < 0) errors.push("Stock must be non-negative.");
          if (updated.lowStockThreshold < 0) errors.push("Low Stock must be non-negative.");
          if (updated.price < 0) errors.push("Price must be non-negative.");
          if (updated.mrp < 0) errors.push("MRP must be non-negative.");

          // Keep remaining attribute errors that weren't resolved
          const attrErrors = updated.errors.filter(
            (err) => err.includes("mapped for") || err.includes("is required")
          );
          updated.errors = [...errors, ...attrErrors];
          updated.isValid = updated.errors.length === 0;

          isRowNowValid = updated.isValid;
          return updated;
        });

        // Update selected IDs set based on final validation status of this row
        setSelectedIds((prevSelected) => {
          const nextSelected = new Set(prevSelected);
          if (isRowNowValid) {
            nextSelected.add(rowNumber);
          } else {
            nextSelected.delete(rowNumber);
          }
          return nextSelected;
        });

        return next;
      });
    },
    [attributeMappings, attributeNames]
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

  /* ── Filter change handler (resets page) ── */
  const handleFilterChange = useCallback((f: "all" | "valid" | "invalid") => {
    setFilter(f);
    setCurrentPage(1);
  }, []);

  /* ── Execute Import ── */
  const executeImport = useCallback(async () => {
    const selectedRows = rows.filter(
      (r) => r.isValid && selectedIds.has(r.rowNumber)
    );
    if (selectedRows.length === 0) return;

    setExecuting(true);
    setExecuteError("");
    setStep(2);

    const BATCH_SIZE = 1000;
    const totalBatches = Math.ceil(selectedRows.length / BATCH_SIZE);
    let totalCreated = 0;
    let totalUpdated = 0;

    setImportProgress({
      current: 0,
      total: selectedRows.length,
      batch: 1,
      totalBatches,
      created: 0,
      updated: 0,
    });

    try {
      for (let b = 0; b < totalBatches; b++) {
        const batchRows = selectedRows.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
        setImportProgress({
          current: b * BATCH_SIZE,
          total: selectedRows.length,
          batch: b + 1,
          totalBatches,
          created: totalCreated,
          updated: totalUpdated,
        });

        const res = await adminApi.post(
          `/products/${productId}/variants/import-execute`,
          {
            rows: batchRows,
            tierOverrides: b === 0 ? tierOverrides.filter((t) => t.isValid !== false) : [],
            moqOverrides: b === 0 ? moqOverrides.filter((m) => m.isValid !== false) : [],
          },
          { timeout: 120000 }
        );

        const data = res.data?.data;
        totalCreated += data?.created ?? 0;
        totalUpdated += data?.updated ?? 0;

        setImportProgress({
          current: Math.min((b + 1) * BATCH_SIZE, selectedRows.length),
          total: selectedRows.length,
          batch: b + 1,
          totalBatches,
          created: totalCreated,
          updated: totalUpdated,
        });
      }

      setExecuteResult({ created: totalCreated, updated: totalUpdated });
    } catch (err) {
      setExecuteError(
        getAdminErrorMessage(
          err,
          totalCreated > 0 || totalUpdated > 0
            ? `Import stopped after ${totalCreated} created, ${totalUpdated} updated. Please check error and retry remaining.`
            : "Import failed. Please try again."
        )
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
            className="flex w-full max-w-6xl h-[90vh] max-h-[860px] min-h-0 flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
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
                  Bulk Import Variants {productName ? `for "${productName}"` : ""}
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
            <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col">
              <AnimatePresence mode="wait">
                {step === 0 && (
                  <motion.div
                    key="step-upload"
                    initial={{ opacity: 0, x: -30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.2 }}
                    className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
                  >
                    <UploadStep
                      file={file}
                      dragging={dragging}
                      uploading={uploading}
                      uploadError={uploadError}
                      fileInputRef={fileInputRef}
                      accepted={ACCEPTED}
                      attributeNames={attributeNames}
                      productName={productName}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onBrowse={handleBrowse}
                      onFileInputChange={handleFileInputChange}
                      onRemoveFile={removeFile}
                      onDownloadTemplate={downloadTemplate}
                      onDownloadMultiSheetTemplate={downloadMultiSheetTemplate}
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
                    className="h-full min-h-0 flex-1 flex flex-col overflow-hidden"
                  >
                    <PreviewStep
                      preview={preview}
                      rows={rows}
                      filteredRows={filteredRows}
                      selectedIds={selectedIds}
                      filter={filter}
                      currentPage={currentPage}
                      pageSize={pageSize}
                      onPageChange={setCurrentPage}
                      onPageSizeChange={setPageSize}
                      editingCell={editingCell}
                      selectedValidCount={selectedValidCount}
                      productName={productName}
                      onFilterChange={handleFilterChange}
                      onToggleRow={toggleRow}
                      onSelectAllValid={selectAllValid}
                      onClearSelection={clearSelection}
                      onUpdateRow={updateRow}
                      onEditCell={setEditingCell}
                      onBack={() => setStep(0)}
                      onExecute={executeImport}
                      attributeNames={attributeNames}
                      attributeMappings={attributeMappings}
                      tierOverrides={tierOverrides}
                      onAddTierOverride={handleAddTierOverride}
                      onUpdateTierOverride={handleUpdateTierOverride}
                      onDeleteTierOverride={handleDeleteTierOverride}
                      moqOverrides={moqOverrides}
                      onAddMoqOverride={handleAddMoqOverride}
                      onUpdateMoqOverride={handleUpdateMoqOverride}
                      onDeleteMoqOverride={handleDeleteMoqOverride}
                      tiers={tiersData}
                      countries={countriesData}
                      activeTab={activePreviewTab}
                      onTabChange={setActivePreviewTab}
                    />
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step-execute"
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.2 }}
                    className="h-full min-h-0 flex-1 flex flex-col overflow-y-auto"
                  >
                    <ExecuteStep
                      executing={executing}
                      progress={importProgress}
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
  productName?: string;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onBrowse: () => void;
  onFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveFile: () => void;
  onDownloadTemplate: () => void;
  onDownloadMultiSheetTemplate: () => void;
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
  productName = "",
  onDrop,
  onDragOver,
  onDragLeave,
  onBrowse,
  onFileInputChange,
  onRemoveFile,
  onDownloadTemplate,
  onDownloadMultiSheetTemplate,
  onUpload,
  onCancel,
}: UploadStepProps) {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
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
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
          <div>
            <p className="text-[13px] font-semibold text-[#1A1A1A]">
              Need a template?
            </p>
            <p className="text-[12px] text-[#6B6B6B] mt-0.5">
              Download a pre-formatted template with all mapped attributes and optional Tier &amp; MOQ sheets.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadMultiSheetTemplate}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 py-2 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-sm cursor-pointer shrink-0"
            id="bulk-import-download-template"
          >
            <Download size={14} />
            <span>Download Template</span>
          </button>
        </div>

        {/* Column info */}
        <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-3 text-[11px] text-blue-800 leading-relaxed">
          <p className="font-semibold text-blue-900 mb-1">
            Template Structure &amp; Supported Sheets
          </p>
          <p className="text-blue-700">
            <strong className="text-blue-900">Sheet 1 (Variants):</strong> SKU (Required), Stock, Low Stock, Price, MRP, Dealer Price, Doctor Price, Country Codes, Weight, Dimensions, Fragile, Hazardous, MOQ, Status
            {attributeNames.length > 0 && (
              <>
                {" "}&nbsp;|&nbsp;{" "}
                <strong className="text-blue-900">Mapped Attributes:</strong>{" "}
                {attributeNames.map((name, i) => (
                  <span key={name}>
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 font-semibold text-blue-800">{name}</span>
                    {i < attributeNames.length - 1 && <>, </>}
                  </span>
                ))}
              </>
            )}
          </p>
          <p className="mt-1 text-blue-600">
            <strong className="text-blue-900">Sheet 2 (Tier_Overrides):</strong> Optional customer tier pricing rules (can be left blank).
          </p>
          <p className="mt-0.5 text-blue-600">
            <strong className="text-blue-900">Sheet 3 (MOQ_Overrides):</strong> Optional volume discount rules (can be left blank).
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

interface CountryDropdownProps {
  value: string;
  onChange: (val: string) => void;
  countries: any[];
  className?: string;
}

function CountryDropdown({ value, onChange, countries, className }: CountryDropdownProps) {
  const options = useMemo(() => {
    return (countries || []).map((c: any) => ({
      value: String(c.code || c.id).toUpperCase(),
      label: `${c.name} (${c.code || c.id})`,
    }));
  }, [countries]);

  const allCodes = useMemo(() => options.map((o) => o.value), [options]);

  const isAll = useMemo(() => {
    if (!value) return true;
    const trimmed = value.trim().toUpperCase();
    return trimmed === "ALL" || trimmed === "*" || trimmed === "GLOBAL";
  }, [value]);

  const currentValues = useMemo(() => {
    if (isAll) {
      return allCodes;
    }
    const tokens = value.split(/[,;|]/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    return allCodes.filter((code) => {
      if (tokens.includes(code)) return true;
      const countryObj = (countries || []).find(
        (c: any) => String(c.code || c.id).toUpperCase() === code
      );
      if (countryObj?.name && tokens.includes(countryObj.name.toUpperCase())) return true;
      return false;
    });
  }, [value, isAll, allCodes, countries]);

  const displayLabel = useMemo(() => {
    if (isAll || (allCodes.length > 0 && currentValues.length === allCodes.length)) {
      return "ALL (Global)";
    }
    if (currentValues.length === 0) {
      return "None";
    }
    if (currentValues.length <= 2) {
      return currentValues.join(", ");
    }
    return `${currentValues[0]}, ${currentValues[1]} +${currentValues.length - 2}`;
  }, [isAll, allCodes, currentValues]);

  const handleChange = useCallback(
    (nextValues: string[]) => {
      if (nextValues.length === 0) {
        onChange("");
      } else if (allCodes.length > 0 && nextValues.length === allCodes.length) {
        onChange("ALL");
      } else {
        onChange(nextValues.join(", "));
      }
    },
    [allCodes, onChange]
  );

  return (
    <div className="flex items-center justify-center">
      <AdminMultiSelect
        options={options}
        value={currentValues}
        onChange={handleChange}
        displayValue={displayLabel}
        placeholder="Select..."
        selectAllLabel="Select All Countries"
        containerClassName="w-full min-w-[120px] max-w-[165px] space-y-0"
        className={cn(
          "h-7 py-0 px-2 text-[11px] font-medium border-[#D1D5DB] rounded bg-white hover:border-[#E31E24] shadow-none gap-1",
          className
        )}
      />
    </div>
  );
}

interface PreviewStepProps {
  preview: PreviewResult | null;
  rows: PreviewRow[];
  filteredRows: PreviewRow[];
  selectedIds: Set<number>;
  filter: "all" | "valid" | "invalid";
  currentPage: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  editingCell: { row: number; field: string } | null;
  selectedValidCount: number;
  productName?: string;
  onFilterChange: (f: "all" | "valid" | "invalid") => void;
  onToggleRow: (rowNumber: number) => void;
  onSelectAllValid: () => void;
  onClearSelection: () => void;
  onUpdateRow: (rowNumber: number, field: string, value: string) => void;
  onEditCell: (cell: { row: number; field: string } | null) => void;
  onBack: () => void;
  onExecute: () => void;
  attributeNames?: string[];
  attributeMappings?: any[];
  tierOverrides: TierOverrideRow[];
  onAddTierOverride: (rule: TierOverrideRow) => void;
  onUpdateTierOverride: (index: number, field: keyof TierOverrideRow, value: any) => void;
  onDeleteTierOverride: (index: number) => void;
  moqOverrides: MoqOverrideRow[];
  onAddMoqOverride: (rule: MoqOverrideRow) => void;
  onUpdateMoqOverride: (index: number, field: keyof MoqOverrideRow, value: any) => void;
  onDeleteMoqOverride: (index: number) => void;
  tiers: any[];
  countries: any[];
  activeTab: "variants" | "tierOverrides" | "moqOverrides";
  onTabChange: (tab: "variants" | "tierOverrides" | "moqOverrides") => void;
}

function PreviewStep({
  preview,
  rows,
  filteredRows,
  selectedIds,
  filter,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  editingCell,
  selectedValidCount,
  productName = "",
  onFilterChange,
  onToggleRow,
  onSelectAllValid,
  onClearSelection,
  onUpdateRow,
  onEditCell,
  onBack,
  onExecute,
  attributeNames,
  attributeMappings,
  tierOverrides,
  onAddTierOverride,
  onUpdateTierOverride,
  onDeleteTierOverride,
  moqOverrides,
  onAddMoqOverride,
  onUpdateMoqOverride,
  onDeleteMoqOverride,
  tiers,
  countries,
  activeTab,
  onTabChange,
}: PreviewStepProps) {
  const validCount = rows.filter((r) => r.isValid).length;
  const invalidCount = rows.filter((r) => !r.isValid).length;

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(safeCurrentPage * pageSize, filteredRows.length);
  const paginatedRows = useMemo(
    () => filteredRows.slice(startIndex, endIndex),
    [filteredRows, startIndex, endIndex]
  );

  // Unique SKUs from imported rows for rule assignment dropdown
  const uniqueSkus = useMemo(() => {
    const list: { sku: string; title: string }[] = [{ sku: "ALL", title: "All Variants (Product Default)" }];
    const map = new Map<string, string>();
    rows.forEach((r) => {
      const s = r.sku?.trim();
      if (s && !map.has(s) && s.toUpperCase() !== "ALL") {
        map.set(s, r.variantTitle || s);
      }
    });
    list.push(...Array.from(map.entries()).map(([sku, title]) => ({ sku, title })));
    return list;
  }, [rows]);

  const countryMultiSelectOptions = useMemo(() => {
    return (countries || []).map((c: any) => ({
      value: c.code || c.id,
      label: `${c.name} (${c.code || c.id})`,
    }));
  }, [countries]);

  const tierSelectOptions = useMemo(() => {
    return [
      { value: "", label: "Select tier..." },
      ...(tiers || []).map((t: any) => ({
        value: t.id,
        label: t.name,
      })),
    ];
  }, [tiers]);

  // Direct Tier rule form state
  const [showAddTierForm, setShowAddTierForm] = useState(false);
  const [tierSkuDraft, setTierSkuDraft] = useState("");
  const [tierIdDraft, setTierIdDraft] = useState("");
  const [tierCountriesDraft, setTierCountriesDraft] = useState<string[]>([]);
  const [tierModeDraft, setTierModeDraft] = useState<"PERCENTAGE" | "FIXED_PRICE">("PERCENTAGE");
  const [tierValueDraft, setTierValueDraft] = useState("");
  const [tierFormError, setTierFormError] = useState("");

  // Direct MOQ rule form state
  const [showAddMoqForm, setShowAddMoqForm] = useState(false);
  const [moqSkuDraft, setMoqSkuDraft] = useState("");
  const [moqCountriesDraft, setMoqCountriesDraft] = useState<string[]>([]);
  const [moqMinQtyDraft, setMoqMinQtyDraft] = useState("10");
  const [moqMaxQtyDraft, setMoqMaxQtyDraft] = useState("");
  const [moqModeDraft, setMoqModeDraft] = useState<"PERCENTAGE" | "FIXED_PRICE">("PERCENTAGE");
  const [moqValueDraft, setMoqValueDraft] = useState("");
  const [moqFormError, setMoqFormError] = useState("");

  const handleSaveTierRule = useCallback(() => {
    if (!tierSkuDraft) {
      setTierFormError("Please select a variant SKU (or 'All Variants').");
      return;
    }
    if (!tierIdDraft) {
      setTierFormError("Please select a customer tier.");
      return;
    }
    const numVal = parseFloat(tierValueDraft);
    if (isNaN(numVal) || numVal < 0) {
      setTierFormError("Please enter a valid non-negative number.");
      return;
    }
    if (tierModeDraft === "PERCENTAGE" && numVal > 100) {
      setTierFormError("Discount percentage cannot exceed 100%.");
      return;
    }

    const selectedTier = (tiers || []).find((t: any) => t.id === tierIdDraft);
    const tierName = selectedTier?.name || "Tier";

    const skusToApply = [tierSkuDraft];
    const countriesToApply = tierCountriesDraft.length === 0 ? ["ALL"] : tierCountriesDraft;

    for (const sku of skusToApply) {
      for (const country of countriesToApply) {
        onAddTierOverride({
          variantSku: sku,
          tierId: tierIdDraft,
          tierName,
          country,
          mode: tierModeDraft,
          value: numVal,
          isValid: true,
          errors: [],
        });
      }
    }

    setTierSkuDraft("");
    setTierIdDraft("");
    setTierCountriesDraft([]);
    setTierValueDraft("");
    setTierFormError("");
    setShowAddTierForm(false);
  }, [tierSkuDraft, tierIdDraft, tierValueDraft, tierModeDraft, tierCountriesDraft, tiers, onAddTierOverride]);

  const handleSaveMoqRule = useCallback(() => {
    if (!moqSkuDraft) {
      setMoqFormError("Please select a variant SKU (or 'All Variants').");
      return;
    }
    const minQ = parseInt(moqMinQtyDraft);
    if (isNaN(minQ) || minQ < 1) {
      setMoqFormError("Min Quantity must be at least 1.");
      return;
    }
    const maxQ = moqMaxQtyDraft ? parseInt(moqMaxQtyDraft) : null;
    if (maxQ !== null && (isNaN(maxQ) || maxQ < minQ)) {
      setMoqFormError("Max Quantity must be greater than or equal to Min Quantity.");
      return;
    }
    const numVal = parseFloat(moqValueDraft);
    if (isNaN(numVal) || numVal < 0) {
      setMoqFormError("Please enter a valid non-negative number.");
      return;
    }
    if (moqModeDraft === "PERCENTAGE" && numVal > 100) {
      setMoqFormError("Discount percentage cannot exceed 100%.");
      return;
    }

    const skusToApply = [moqSkuDraft];
    const countriesToApply = moqCountriesDraft.length === 0 ? ["ALL"] : moqCountriesDraft;

    for (const sku of skusToApply) {
      for (const country of countriesToApply) {
        onAddMoqOverride({
          variantSku: sku,
          country,
          minQuantity: minQ,
          maxQuantity: maxQ,
          mode: moqModeDraft,
          value: numVal,
          isValid: true,
          errors: [],
        });
      }
    }

    setMoqSkuDraft("");
    setMoqCountriesDraft([]);
    setMoqMinQtyDraft("10");
    setMoqMaxQtyDraft("");
    setMoqValueDraft("");
    setMoqFormError("");
    setShowAddMoqForm(false);
  }, [moqSkuDraft, moqMinQtyDraft, moqMaxQtyDraft, moqValueDraft, moqModeDraft, moqCountriesDraft, uniqueSkus, onAddMoqOverride]);

  return (
    <>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {/* Navigation Sub-Tabs */}
        <div className="shrink-0 flex items-center justify-between border-b border-[#E5E7EB] bg-[#F9FAFB] px-6">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onTabChange("variants")}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 px-3 text-[13px] font-semibold transition-all cursor-pointer",
                activeTab === "variants"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#6B7280] hover:text-[#1A1A1A] hover:border-gray-300"
              )}
            >
              <span>Variants Matrix</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  activeTab === "variants"
                    ? "bg-red-50 text-[#E31E24] border border-red-200"
                    : "bg-[#E5E7EB] text-[#4B5563]"
                )}
              >
                {rows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("tierOverrides")}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 px-3 text-[13px] font-semibold transition-all cursor-pointer",
                activeTab === "tierOverrides"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#6B7280] hover:text-[#1A1A1A] hover:border-gray-300"
              )}
            >
              <span>Tier Overrides</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  tierOverrides.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-[#E5E7EB] text-[#6B7280]"
                )}
              >
                {tierOverrides.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => onTabChange("moqOverrides")}
              className={cn(
                "flex items-center gap-2 border-b-2 py-3 px-3 text-[13px] font-semibold transition-all cursor-pointer",
                activeTab === "moqOverrides"
                  ? "border-[#E31E24] text-[#E31E24]"
                  : "border-transparent text-[#6B7280] hover:text-[#1A1A1A] hover:border-gray-300"
              )}
            >
              <span>MOQ Overrides</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-bold",
                  moqOverrides.length > 0
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-[#E5E7EB] text-[#6B7280]"
                )}
              >
                {moqOverrides.length}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[12px] text-[#6B7280]">
            {productName && (
              <span className="font-medium">
                Product: <strong className="text-[#1A1A1A]">{productName}</strong>
              </span>
            )}
          </div>
        </div>

        {/* ── Tab 1: Variants Matrix ── */}
        {activeTab === "variants" && (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {/* Summary bar */}
            <div className="shrink-0 px-6 py-3.5 flex flex-wrap items-center justify-between border-b border-[#F3F4F6] bg-white gap-3">
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
                      "px-3 py-1 text-[11px] font-semibold transition-colors capitalize cursor-pointer",
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
                  className="text-[11px] font-semibold text-[#E31E24] hover:text-[#B5151B] underline underline-offset-2 transition-colors cursor-pointer"
                  id="bulk-import-select-valid"
                >
                  Select all valid
                </button>
                {selectedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="text-[11px] font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] underline underline-offset-2 transition-colors cursor-pointer"
                    id="bulk-import-clear-selection"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 min-h-0 overflow-auto">
              <table className="w-full text-[12px]">
                <thead className="sticky top-0 z-10 bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="px-3 py-2.5 text-left w-10">
                      <span className="sr-only">Select</span>
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">
                      Row
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[130px]">
                      SKU
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[150px]">
                      Variant Title
                    </th>
                    {attributeNames?.map((name) => (
                      <th
                        key={name}
                        className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[95px]"
                      >
                        {name}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                      Stock
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                      Low Stk
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                      Price
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                      MRP
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">
                      Dealer Price
                    </th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">
                      Doctor Price
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[135px]">
                      Countries
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[95px]">
                      Shipping
                    </th>
                    <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-20">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[180px]">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F3F4F6]">
                  {paginatedRows.map((row) => (
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
                      {/* SKU */}
                      <EditableCell
                        value={row.sku}
                        rowNumber={row.rowNumber}
                        field="sku"
                        editing={editingCell}
                        onEdit={onEditCell}
                        onUpdate={onUpdateRow}
                      />
                      {/* Variant title */}
                      <td className="px-3 py-2 text-[#374151] font-medium">
                        {row.variantTitle}
                      </td>
                      {/* Dynamic attributes */}
                      {attributeNames?.map((name) => {
                        const attrVal = row.attributeValues?.find(
                          (v) => v.attributeName.toLowerCase() === name.toLowerCase()
                        );
                        const isEditing = editingCell?.row === row.rowNumber && editingCell?.field === `attr:${name}`;
                        const mapping = attributeMappings?.find(
                          (m: any) => m.attribute?.name.toLowerCase() === name.toLowerCase()
                        );

                        if (isEditing && mapping) {
                          return (
                            <td key={name} className="px-1 py-1">
                              <select
                                autoFocus
                                value={attrVal?.attributeValueId ?? ""}
                                onChange={(e) => {
                                  onUpdateRow(row.rowNumber, `attr:${name}`, e.target.value);
                                  onEditCell(null);
                                }}
                                onBlur={() => onEditCell(null)}
                                className="w-full rounded border border-[#E31E24] bg-white px-2 py-1 text-[12px] text-[#1A1A1A] outline-none ring-2 ring-red-100"
                              >
                                <option value="">Select value...</option>
                                {mapping.allowedValues?.map((av: any) => (
                                  <option key={av.attributeValueId} value={av.attributeValueId}>
                                    {av.attributeValue.value}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={name}
                            className="px-3 py-2 cursor-pointer transition-colors hover:bg-yellow-50/50"
                            onClick={() => onEditCell({ row: row.rowNumber, field: `attr:${name}` })}
                            title="Click to edit attribute"
                          >
                            <span className={cn(
                              "inline-block rounded px-1.5 py-0.5 text-[11px] font-mono transition-colors group-hover:bg-yellow-50 group-hover:ring-1 group-hover:ring-yellow-200",
                              attrVal ? "bg-gray-100 text-gray-800" : "bg-red-50 text-red-700 border border-red-200"
                            )}>
                              {attrVal ? attrVal.value : "Missing / Bad"}
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
                      <EditableCell
                        value={row.dealerPrice !== null && row.dealerPrice !== undefined ? String(row.dealerPrice) : ""}
                        rowNumber={row.rowNumber}
                        field="dealerPrice"
                        editing={editingCell}
                        onEdit={onEditCell}
                        onUpdate={onUpdateRow}
                        align="right"
                        type="number"
                      />
                      <EditableCell
                        value={row.doctorPrice !== null && row.doctorPrice !== undefined ? String(row.doctorPrice) : ""}
                        rowNumber={row.rowNumber}
                        field="doctorPrice"
                        editing={editingCell}
                        onEdit={onEditCell}
                        onUpdate={onUpdateRow}
                        align="right"
                        type="number"
                      />
                      {/* Country dropdown */}
                      <td className="px-2 py-1 text-center">
                        <CountryDropdown
                          value={row.countryCodes || "ALL"}
                          onChange={(next) => onUpdateRow(row.rowNumber, "countryCodes", next)}
                          countries={countries}
                        />
                      </td>
                      {/* Shipping summary */}
                      <td className="px-3 py-2 text-center text-[11px] text-[#4B5563]">
                        {row.weight ? `${row.weight}kg` : "—"}
                        {row.fragile && <span className="ml-1 text-amber-600 font-semibold" title="Fragile">⚠️F</span>}
                        {row.hazardous && <span className="ml-1 text-red-600 font-semibold" title="Hazardous">☢️H</span>}
                      </td>
                      {/* Status */}
                      <td className="px-2 py-1 text-center">
                        <select
                          value={row.status}
                          onChange={(e) => onUpdateRow(row.rowNumber, "status", e.target.value)}
                          className={cn(
                            "rounded border px-2 py-1 text-[10.5px] font-semibold outline-none cursor-pointer",
                            row.status === "ACTIVE"
                              ? "border-emerald-300 bg-emerald-50 text-emerald-700 focus:border-emerald-500"
                              : "border-gray-300 bg-gray-50 text-gray-600 focus:border-gray-500"
                          )}
                        >
                          <option value="ACTIVE">ACTIVE</option>
                          <option value="INACTIVE">INACTIVE</option>
                        </select>
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
                        colSpan={14 + (attributeNames?.length || 0)}
                        className="px-6 py-12 text-center text-[13px] text-[#9CA3AF]"
                      >
                        No rows to display
                      </td>
                    </tr>
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
                        onPageSizeChange(Number(e.target.value));
                        onPageChange(1);
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
                      onClick={() => onPageChange(safeCurrentPage - 1)}
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
                      onClick={() => onPageChange(safeCurrentPage + 1)}
                      disabled={safeCurrentPage >= totalPages}
                      className="rounded border border-[#D1D5DB] bg-white px-2.5 py-1 text-[11px] font-medium text-[#374151] hover:bg-[#F3F4F6] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Tab 2: Tier Overrides ── */}
        {activeTab === "tierOverrides" && (
          <div className="flex-1 min-h-0 overflow-auto flex flex-col p-6 space-y-4">
            {/* Header / Info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div>
                <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">
                  Tier-Based Pricing Overrides (Sheet: Tier_Overrides)
                </h4>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Optional: Set custom pricing or discount percentages for customer tiers (Gold, Silver, etc.) and countries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddTierForm(!showAddTierForm);
                  setTierFormError("");
                }}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-black transition-colors cursor-pointer"
              >
                <Plus size={14} />
                {showAddTierForm ? "Hide Form" : "Add Tier Rule Directly"}
              </button>
            </div>

            {/* Inline Direct Rule Form */}
            {showAddTierForm && (
              <div className="rounded-lg border-2 border-red-100 bg-white p-4 shadow-sm space-y-3">
                <div className="text-[13px] font-bold text-[#1A1A1A]">
                  Add New Tier Override Rule
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                      Variant SKU
                    </label>
                    <select
                      value={tierSkuDraft}
                      onChange={(e) => setTierSkuDraft(e.target.value)}
                      className="w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                    >
                      <option value="">Select Variant...</option>
                      <option value="ALL">Apply to All Variants</option>
                      {uniqueSkus.filter((u) => u.sku !== "ALL").map((u) => (
                        <option key={u.sku} value={u.sku}>
                          {u.sku} ({u.title})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <AdminSelect
                      label="Customer Tier"
                      value={tierIdDraft}
                      onChange={(e) => setTierIdDraft(e.target.value)}
                      options={tierSelectOptions}
                    />
                  </div>

                  <div className="min-w-0">
                    <AdminMultiSelect
                      label="Country"
                      options={countryMultiSelectOptions}
                      value={tierCountriesDraft}
                      onChange={setTierCountriesDraft}
                      placeholder="Select countries (or ALL)..."
                      selectAllLabel="Select All Countries"
                    />
                  </div>

                  <div className="min-w-0">
                    <AdminSelect
                      label="Mode"
                      value={tierModeDraft}
                      onChange={(e) => setTierModeDraft(e.target.value as any)}
                      options={[
                        { value: "PERCENTAGE", label: "% Discount" },
                        { value: "FIXED_PRICE", label: "Fixed Price" },
                      ]}
                    />
                  </div>

                  <div>
                    <AdminInput
                      label={tierModeDraft === "PERCENTAGE" ? "Discount %" : "Fixed Price ($)"}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 15"
                      value={tierValueDraft}
                      onChange={(e) => setTierValueDraft(e.target.value)}
                    />
                  </div>
                </div>

                {tierFormError && (
                  <p className="text-[11.5px] text-red-500 font-medium">
                    ⚠️ {tierFormError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTierForm(false);
                      setTierFormError("");
                    }}
                    className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveTierRule}
                    className="rounded-md bg-[#E31E24] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            )}

            {/* Table or Empty State */}
            {tierOverrides.length > 0 ? (
              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden bg-white">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">#</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[140px]">Variant SKU</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[120px]">Tier</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[135px]">Country</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Mode</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Discount / Price</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[150px]">Status</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {tierOverrides.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-3 py-2 text-[#9CA3AF] font-mono">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <select
                            value={rule.variantSku || "ALL"}
                            onChange={(e) => onUpdateTierOverride(idx, "variantSku", e.target.value)}
                            className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[11.5px] font-mono text-[#1A1A1A] outline-none focus:border-[#E31E24] cursor-pointer max-w-[170px]"
                          >
                            {uniqueSkus.map((u) => (
                              <option key={u.sku} value={u.sku}>
                                {u.sku === "ALL" ? "All Variants (Product Default)" : `${u.sku} (${u.title})`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={rule.tierName}
                            onChange={(e) => {
                              const selectedName = e.target.value;
                              onUpdateTierOverride(idx, "tierName", selectedName);
                            }}
                            className="rounded border border-purple-200 bg-purple-50/50 px-2 py-1 text-[11.5px] font-medium text-purple-800 outline-none focus:border-[#E31E24] cursor-pointer"
                          >
                            {(tiers || []).map((t: any) => (
                              <option key={t.id} value={t.name}>
                                {t.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <CountryDropdown
                            value={rule.country || "ALL"}
                            onChange={(next) => onUpdateTierOverride(idx, "country", next)}
                            countries={countries}
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={rule.mode}
                            onChange={(e) => onUpdateTierOverride(idx, "mode", e.target.value as any)}
                            className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 outline-none focus:border-[#E31E24] cursor-pointer"
                          >
                            <option value="PERCENTAGE">% Discount</option>
                            <option value="FIXED_PRICE">Fixed Price</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={rule.value}
                            onChange={(e) => onUpdateTierOverride(idx, "value", parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-[#D1D5DB] bg-white px-2 py-1 text-right text-[11.5px] font-semibold text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {rule.errors && rule.errors.length > 0 ? (
                            <span className="text-[11px] text-red-500">• {rule.errors.join(", ")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 size={13} /> Ready to Apply
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteTierOverride(idx)}
                            className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !showAddTierForm && (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] p-8 text-center bg-[#FAFAFA]">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                  <h5 className="text-[14px] font-bold text-[#1A1A1A]">
                    No Tier Override Rules Specified
                  </h5>
                  <p className="text-[12px] text-[#6B7280] max-w-md mx-auto mt-1">
                    The <code>Tier_Overrides</code> sheet was left empty or not included in your upload. This is 100% optional. Standard variant prices will apply. You can add override rules anytime using the button above.
                  </p>
                </div>
              )
            )}
          </div>
        )}

        {/* ── Tab 3: MOQ Overrides ── */}
        {activeTab === "moqOverrides" && (
          <div className="flex-1 min-h-0 overflow-auto flex flex-col p-6 space-y-4">
            {/* Header / Info bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] p-4">
              <div>
                <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">
                  MOQ Volume Pricing Overrides (Sheet: MOQ_Overrides)
                </h4>
                <p className="text-[12px] text-[#6B7280] mt-0.5">
                  Optional: Set volume-based tiered discounts (e.g. Min 50 qty → 10% off) for specific countries.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowAddMoqForm(!showAddMoqForm);
                  setMoqFormError("");
                }}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-3 py-1.5 text-[12px] font-medium text-white hover:bg-black transition-colors cursor-pointer"
              >
                <Plus size={14} />
                {showAddMoqForm ? "Hide Form" : "Add MOQ Rule Directly"}
              </button>
            </div>

            {/* Inline Direct Rule Form */}
            {showAddMoqForm && (
              <div className="rounded-lg border-2 border-red-100 bg-white p-4 shadow-sm space-y-3">
                <div className="text-[13px] font-bold text-[#1A1A1A]">
                  Add New MOQ Volume Pricing Rule
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#4B5563] mb-1">
                      Variant SKU
                    </label>
                    <select
                      value={moqSkuDraft}
                      onChange={(e) => setMoqSkuDraft(e.target.value)}
                      className="w-full rounded-md border border-[#D1D5DB] bg-white px-3 py-2 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                    >
                      <option value="">Select Variant...</option>
                      <option value="ALL">Apply to All Variants</option>
                      {uniqueSkus.filter((u) => u.sku !== "ALL").map((u) => (
                        <option key={u.sku} value={u.sku}>
                          {u.sku} ({u.title})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="min-w-0">
                    <AdminMultiSelect
                      label="Country"
                      options={countryMultiSelectOptions}
                      value={moqCountriesDraft}
                      onChange={setMoqCountriesDraft}
                      placeholder="Select countries (or ALL)..."
                      selectAllLabel="Select All Countries"
                    />
                  </div>

                  <div>
                    <AdminInput
                      label="Min Quantity"
                      type="number"
                      min={1}
                      value={moqMinQtyDraft}
                      onChange={(e) => setMoqMinQtyDraft(e.target.value)}
                    />
                  </div>

                  <div>
                    <AdminInput
                      label="Max Quantity"
                      type="number"
                      min={1}
                      placeholder="None"
                      value={moqMaxQtyDraft}
                      onChange={(e) => setMoqMaxQtyDraft(e.target.value)}
                    />
                  </div>

                  <div className="min-w-0">
                    <AdminSelect
                      label="Mode"
                      value={moqModeDraft}
                      onChange={(e) => setMoqModeDraft(e.target.value as any)}
                      options={[
                        { value: "PERCENTAGE", label: "% Discount" },
                        { value: "FIXED_PRICE", label: "Fixed Price" },
                      ]}
                    />
                  </div>

                  <div>
                    <AdminInput
                      label={moqModeDraft === "PERCENTAGE" ? "Discount %" : "Fixed Price ($)"}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="e.g. 10"
                      value={moqValueDraft}
                      onChange={(e) => setMoqValueDraft(e.target.value)}
                    />
                  </div>
                </div>

                {moqFormError && (
                  <p className="text-[11.5px] text-red-500 font-medium">
                    ⚠️ {moqFormError}
                  </p>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddMoqForm(false);
                      setMoqFormError("");
                    }}
                    className="rounded-md border border-[#E5E7EB] px-3 py-1.5 text-[12px] font-medium text-[#6B7280] hover:bg-[#F3F4F6] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveMoqRule}
                    className="rounded-md bg-[#E31E24] px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer"
                  >
                    Save Rule
                  </button>
                </div>
              </div>
            )}

            {/* Table or Empty State */}
            {moqOverrides.length > 0 ? (
              <div className="rounded-lg border border-[#E5E7EB] overflow-hidden bg-white">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                    <tr>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-12">#</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[140px]">Variant SKU</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[135px]">Country</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Min Qty</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-24">Max Qty</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Mode</th>
                      <th className="px-3 py-2.5 text-right text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-28">Discount / Price</th>
                      <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider min-w-[150px]">Status</th>
                      <th className="px-3 py-2.5 text-center text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider w-16">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3F4F6]">
                    {moqOverrides.map((rule, idx) => (
                      <tr key={idx} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="px-3 py-2 text-[#9CA3AF] font-mono">{idx + 1}</td>
                        <td className="px-3 py-2">
                          <select
                            value={rule.variantSku || "ALL"}
                            onChange={(e) => onUpdateMoqOverride(idx, "variantSku", e.target.value)}
                            className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[11.5px] font-mono text-[#1A1A1A] outline-none focus:border-[#E31E24] cursor-pointer max-w-[170px]"
                          >
                            {uniqueSkus.map((u) => (
                              <option key={u.sku} value={u.sku}>
                                {u.sku === "ALL" ? "All Variants (Product Default)" : `${u.sku} (${u.title})`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <CountryDropdown
                            value={rule.country || "ALL"}
                            onChange={(next) => onUpdateMoqOverride(idx, "country", next)}
                            countries={countries}
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            value={rule.minQuantity}
                            onChange={(e) => onUpdateMoqOverride(idx, "minQuantity", parseInt(e.target.value) || 1)}
                            className="w-20 rounded border border-[#D1D5DB] bg-white px-2 py-1 text-right text-[11.5px] font-semibold text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            placeholder="None"
                            value={rule.maxQuantity ?? ""}
                            onChange={(e) => onUpdateMoqOverride(idx, "maxQuantity", e.target.value ? parseInt(e.target.value) : null)}
                            className="w-20 rounded border border-[#D1D5DB] bg-white px-2 py-1 text-right text-[11.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <select
                            value={rule.mode}
                            onChange={(e) => onUpdateMoqOverride(idx, "mode", e.target.value as any)}
                            className="rounded border border-[#D1D5DB] bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 outline-none focus:border-[#E31E24] cursor-pointer"
                          >
                            <option value="PERCENTAGE">% Discount</option>
                            <option value="FIXED_PRICE">Fixed Price</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={rule.value}
                            onChange={(e) => onUpdateMoqOverride(idx, "value", parseFloat(e.target.value) || 0)}
                            className="w-24 rounded border border-[#D1D5DB] bg-white px-2 py-1 text-right text-[11.5px] font-semibold text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {rule.errors && rule.errors.length > 0 ? (
                            <span className="text-[11px] text-red-500">• {rule.errors.join(", ")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                              <CheckCircle2 size={13} /> Ready to Apply
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => onDeleteMoqOverride(idx)}
                            className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete rule"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              !showAddMoqForm && (
                <div className="rounded-xl border border-dashed border-[#D1D5DB] p-8 text-center bg-[#FAFAFA]">
                  <FileSpreadsheet className="mx-auto h-10 w-10 text-gray-400 mb-2" />
                  <h5 className="text-[14px] font-bold text-[#1A1A1A]">
                    No MOQ Override Rules Specified
                  </h5>
                  <p className="text-[12px] text-[#6B7280] max-w-md mx-auto mt-1">
                    The <code>MOQ_Overrides</code> sheet was left empty or not included in your upload. This is 100% optional. Standard variant prices and minimum order quantities will apply. You can add volume discount rules anytime using the button above.
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E6E6E6] bg-white px-6 py-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
          id="bulk-import-back"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="hidden sm:flex items-center gap-3 text-[12px] text-[#6B7280]">
          <span>
            <strong className="text-[#1A1A1A]">{selectedValidCount}</strong> valid variants selected
          </span>
          {tierOverrides.length > 0 && (
            <span className="text-purple-700 font-medium bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
              +{tierOverrides.length} tier rules
            </span>
          )}
          {moqOverrides.length > 0 && (
            <span className="text-blue-700 font-medium bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              +{moqOverrides.length} MOQ rules
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onExecute}
          disabled={selectedValidCount === 0}
          className="flex items-center gap-2 rounded-md bg-[#E31E24] px-5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
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
  progress: {
    current: number;
    total: number;
    batch: number;
    totalBatches: number;
    created: number;
    updated: number;
  } | null;
  result: ExecuteResult | null;
  error: string;
  onClose: () => void;
  onRetry: () => void;
}

function ExecuteStep({
  executing,
  progress,
  result,
  error,
  onClose,
  onRetry,
}: ExecuteStepProps) {
  const percent = progress && progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : 0;

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-12">
      <AnimatePresence mode="wait">
        {executing && (
          <motion.div
            key="executing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-5 w-full max-w-md"
          >
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-[#F3F4F6] border-t-[#E31E24] animate-spin" />
            </div>
            <div className="text-center w-full">
              <p className="text-[16px] font-bold text-[#1A1A1A]">
                Importing Variants...
              </p>
              {progress ? (
                <div className="mt-4 w-full">
                  <div className="flex items-center justify-between text-[12px] font-semibold text-[#4B5563] mb-1.5">
                    <span>Batch {progress.batch} of {progress.totalBatches}</span>
                    <span className="font-bold text-[#E31E24]">{percent}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                    <div
                      className="h-full bg-gradient-to-r from-[#E31E24] to-[#B5151B] transition-all duration-300 rounded-full"
                      style={{ width: `${Math.max(percent, 4)}%` }}
                    />
                  </div>
                  <div className="mt-2.5 flex items-center justify-between text-[11.5px] text-[#6B7280]">
                    <span>
                      {progress.current.toLocaleString()} of {progress.total.toLocaleString()} rows processed
                    </span>
                    <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      +{progress.created} created / +{progress.updated} updated
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[#6B6B6B] mt-1">
                  Creating and updating variant records
                </p>
              )}
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
