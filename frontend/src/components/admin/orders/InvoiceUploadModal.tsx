"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { LoadingButton } from "@/components/admin/AdminComponents";
import { UploadCloud, FileText, FolderOpen, X } from "lucide-react";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";
import type { MediaItem } from "@/services/mediaService";

interface InvoiceUploadModalProps {
  open: boolean;
  onClose: () => void;
  orderNumber: string;
  onUpload: (
    file: File | null,
    meta: {
      invoiceNumber?: string;
      invoiceDate?: string;
      invoiceDueDate?: string;
      notes?: string;
      fileUrl?: string;
      fileName?: string;
    }
  ) => Promise<void>;
}

export function InvoiceUploadModal({
  open,
  onClose,
  orderNumber,
  onUpload,
}: InvoiceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; name: string; size?: number } | null>(null);
  const [isMediaOpen, setIsMediaOpen] = useState(false);

  const [invoiceNumber, setInvoiceNumber] = useState(`INV-${orderNumber}`);
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceDueDate, setInvoiceDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!file && !selectedMedia) return;
    setIsUploading(true);
    try {
      await onUpload(file, {
        invoiceNumber: invoiceNumber.trim() || undefined,
        invoiceDate: invoiceDate || undefined,
        invoiceDueDate: invoiceDueDate || undefined,
        notes: notes.trim() || undefined,
        fileUrl: selectedMedia?.url || undefined,
        fileName: selectedMedia?.name || undefined,
      });
      onClose();
      setFile(null);
      setSelectedMedia(null);
    } finally {
      setIsUploading(false);
    }
  }

  const hasDocument = Boolean(file || selectedMedia);

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Upload Custom Invoice"
        subtitle={`Upload or attach an invoice document from media library for Order #${orderNumber}`}
        size="lg"
        bodyClassName="px-7 py-5 md:px-8 md:py-6"
        footer={
          <div className="flex items-center justify-between w-full">
            <p className="text-[11.5px] text-[#6B7280]">
              Directly available for customer download on dashboard.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isUploading}
                className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#374151] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={() => handleSubmit()}
                loading={isUploading}
                disabled={!hasDocument}
                loadingText="Attaching..."
                className="rounded-md bg-[#E31E24] px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs disabled:opacity-50 cursor-pointer"
              >
                {selectedMedia ? "Attach From Media" : "Upload Invoice"}
              </LoadingButton>
            </div>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12.5px] font-semibold text-[#333]">
                Select Invoice Document (PDF, Image, or Word Document)
              </label>
              <button
                type="button"
                onClick={() => setIsMediaOpen(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors cursor-pointer"
              >
                <FolderOpen size={14} /> Browse Media Library
              </button>
            </div>

            {selectedMedia ? (
              <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                    <FileText className="h-5 w-5 text-[#E31E24]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{selectedMedia.name}</p>
                    <p className="text-[11.5px] text-[#6B7280] truncate">{selectedMedia.url}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMedia(null)}
                  className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : file ? (
              <div className="rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-md bg-red-50 flex items-center justify-center shrink-0 border border-red-100">
                    <FileText className="h-5 w-5 text-[#E31E24]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[#111] truncate">{file.name}</p>
                    <p className="text-[11.5px] text-[#6B7280]">{(file.size / 1024).toFixed(1)} KB (Local file)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFile(null)}
                  className="p-1.5 rounded-md text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="relative border-2 border-dashed border-[#D1D5DB] rounded-lg p-6 text-center hover:border-[#E31E24] transition-colors bg-[#FAFAFA]">
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setFile(e.target.files[0]);
                      setSelectedMedia(null);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center">
                  <UploadCloud className="h-8 w-8 text-[#999] mb-1" />
                  <span className="text-[13px] font-medium text-[#444]">
                    Drag and drop or <span className="text-[#E31E24] font-semibold">browse computer</span>
                  </span>
                  <span className="text-[11px] text-[#888] mt-1">Supports PDF, PNG, JPG, JPEG, DOC, DOCX up to 50MB</span>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Invoice Number</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] font-mono focus:border-[#E31E24] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Invoice Date</label>
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#333] mb-1">Due Date (Optional)</label>
            <input
              type="date"
              value={invoiceDueDate}
              onChange={(e) => setInvoiceDueDate(e.target.value)}
              className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#333] mb-1">Admin Notes / Remarks (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Uploaded from Tally / ERP..."
              className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
            />
          </div>
        </form>
      </Modal>

      <MediaSelectorModal
        isOpen={isMediaOpen}
        onClose={() => setIsMediaOpen(false)}
        title="Select Invoice Document from Media Library"
        acceptTypes={["DOCUMENT", "IMAGE"]}
        onSelect={(media: MediaItem) => {
          setSelectedMedia({
            url: media.url,
            name: media.originalName || media.filename || media.title || "invoice-document.pdf",
            size: media.size,
          });
          setFile(null);
          setIsMediaOpen(false);
        }}
      />
    </>
  );
}
