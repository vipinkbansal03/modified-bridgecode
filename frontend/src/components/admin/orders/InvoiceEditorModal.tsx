"use client";

import React, { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { AdminInput, LoadingButton } from "@/components/admin/AdminComponents";
import { Plus, Trash2, RotateCcw, Calculator, FileText, Building, User, ShoppingBag, ShieldCheck } from "lucide-react";

export interface InvoiceItemForm {
  id?: string;
  sl?: number;
  title: string;
  variantTitle?: string;
  sku?: string;
  hsnCode?: string;
  unitPrice: number;
  quantity: number;
  netAmount: number;
  taxType: string;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export interface InvoiceFormData {
  documentTitle: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceDueDate: string;
  seller: {
    name: string;
    address: string;
    email: string;
    website: string;
    pan: string;
    gstin: string;
    iec: string;
    shipFromState: string;
  };
  buyer: {
    name: string;
    companyName: string;
    addressLines: string[];
    taxId: string;
    taxIdType: string;
    stateCode: string;
    placeOfSupply: string;
    email: string;
    phone: string;
  };
  items: InvoiceItemForm[];
  summary: {
    subtotal: number;
    discount: number;
    shippingCharge: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    vatAmount: number;
    taxAmount: number;
    total: number;
  };
  notes: string;
  terms: string;
  bankDetails: string;
  authorizedSignatory: string;
}

interface InvoiceEditorModalProps {
  open: boolean;
  onClose: () => void;
  initialData: InvoiceFormData | null;
  defaultData?: InvoiceFormData | null;
  onSave: (data: InvoiceFormData) => Promise<void>;
  currencySymbol?: string;
}

export function InvoiceEditorModal({
  open,
  onClose,
  initialData,
  defaultData,
  onSave,
  currencySymbol = "₹",
}: InvoiceEditorModalProps) {
  const [formData, setFormData] = useState<InvoiceFormData | null>(null);
  const [activeTab, setActiveTab] = useState<"header" | "seller" | "buyer" | "items" | "summary" | "terms">("header");
  const [isSaving, setIsSaving] = useState(false);
  const [buyerAddressText, setBuyerAddressText] = useState("");

  useEffect(() => {
    if (initialData) {
      setFormData(JSON.parse(JSON.stringify(initialData)));
      setBuyerAddressText((initialData.buyer?.addressLines || []).join("\n"));
    }
  }, [initialData, open]);

  if (!formData) return null;

  function handleResetAllToDefault() {
    const source = defaultData || initialData;
    if (!source) return;
    setFormData(JSON.parse(JSON.stringify(source)));
    setBuyerAddressText((source.buyer?.addressLines || []).join("\n"));
  }

  function handleResetItemsToDefault() {
    const sourceItems = defaultData?.items || initialData?.items;
    if (!sourceItems || sourceItems.length === 0) return;
    const restoredItems = JSON.parse(JSON.stringify(sourceItems));

    let netSubtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalVat = 0;

    for (const item of restoredItems) {
      netSubtotal += Number(item.netAmount || 0);
      const tax = Number(item.taxAmount || 0);
      totalTax += tax;
      if (item.taxType === "CGST/SGST") {
        totalCgst += tax / 2;
        totalSgst += tax / 2;
      } else if (item.taxType === "IGST") {
        totalIgst += tax;
      } else if (item.taxType === "VAT") {
        totalVat += tax;
      }
    }

    const discount = Number(formData?.summary.discount ?? defaultData?.summary.discount ?? 0);
    const shipping = Number(formData?.summary.shippingCharge ?? defaultData?.summary.shippingCharge ?? 0);
    const finalTotal = Math.max(0, Math.round((netSubtotal + totalTax + shipping - discount) * 100) / 100);

    setFormData((prev) => (prev ? {
      ...prev,
      items: restoredItems,
      summary: {
        ...prev.summary,
        subtotal: Math.round(netSubtotal * 100) / 100,
        taxAmount: Math.round(totalTax * 100) / 100,
        cgstAmount: Math.round(totalCgst * 100) / 100,
        sgstAmount: Math.round(totalSgst * 100) / 100,
        igstAmount: Math.round(totalIgst * 100) / 100,
        vatAmount: Math.round(totalVat * 100) / 100,
        total: finalTotal,
      },
    } : null));
  }

  function updateField<T extends keyof InvoiceFormData>(field: T, value: InvoiceFormData[T]) {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  function updateSeller(field: keyof InvoiceFormData["seller"], value: string) {
    setFormData((prev) =>
      prev ? { ...prev, seller: { ...prev.seller, [field]: value } } : null
    );
  }

  function updateBuyer(field: keyof InvoiceFormData["buyer"], value: any) {
    setFormData((prev) =>
      prev ? { ...prev, buyer: { ...prev.buyer, [field]: value } } : null
    );
  }

  function updateSummary(field: keyof InvoiceFormData["summary"], value: number) {
    setFormData((prev) =>
      prev ? { ...prev, summary: { ...prev.summary, [field]: value } } : null
    );
  }

  function handleItemChange(index: number, field: keyof InvoiceItemForm, value: any) {
    if (!formData) return;
    const newItems = [...formData.items];
    const item = { ...newItems[index], [field]: value };

    // Auto-calculate netAmount, taxAmount, total if quantity, unitPrice or taxRate changed
    if (field === "quantity" || field === "unitPrice" || field === "taxRate") {
      const qty = field === "quantity" ? Number(value) : item.quantity;
      const rate = field === "unitPrice" ? Number(value) : item.unitPrice;
      const taxRate = field === "taxRate" ? Number(value) : item.taxRate;

      const net = Math.round(qty * rate * 100) / 100;
      const tax = Math.round(net * (taxRate / 100) * 100) / 100;
      const tot = Math.round((net + tax) * 100) / 100;

      item.netAmount = net;
      item.taxAmount = tax;
      item.total = tot;
    }

    newItems[index] = item;
    setFormData({ ...formData, items: newItems });
  }

  function addItem() {
    if (!formData) return;
    const newItem: InvoiceItemForm = {
      sl: formData.items.length + 1,
      title: "New Item",
      variantTitle: "",
      sku: "",
      hsnCode: "",
      unitPrice: 0,
      quantity: 1,
      netAmount: 0,
      taxType: "IGST",
      taxRate: 18,
      taxAmount: 0,
      total: 0,
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });
  }

  function removeItem(index: number) {
    if (!formData) return;
    const newItems = formData.items.filter((_, i) => i !== index).map((item, idx) => ({ ...item, sl: idx + 1 }));
    setFormData({ ...formData, items: newItems });
  }

  function recalculateAllTotals() {
    if (!formData) return;
    let netSubtotal = 0;
    let totalTax = 0;
    let totalCgst = 0;
    let totalSgst = 0;
    let totalIgst = 0;
    let totalVat = 0;

    for (const item of formData.items) {
      netSubtotal += Number(item.netAmount || 0);
      const tax = Number(item.taxAmount || 0);
      totalTax += tax;
      if (item.taxType === "CGST/SGST") {
        totalCgst += tax / 2;
        totalSgst += tax / 2;
      } else if (item.taxType === "IGST") {
        totalIgst += tax;
      } else if (item.taxType === "VAT") {
        totalVat += tax;
      }
    }

    const discount = Number(formData.summary.discount || 0);
    const shipping = Number(formData.summary.shippingCharge || 0);
    const finalTotal = Math.max(0, Math.round((netSubtotal + totalTax + shipping - discount) * 100) / 100);

    setFormData({
      ...formData,
      summary: {
        ...formData.summary,
        subtotal: Math.round(netSubtotal * 100) / 100,
        taxAmount: Math.round(totalTax * 100) / 100,
        cgstAmount: Math.round(totalCgst * 100) / 100,
        sgstAmount: Math.round(totalSgst * 100) / 100,
        igstAmount: Math.round(totalIgst * 100) / 100,
        vatAmount: Math.round(totalVat * 100) / 100,
        total: finalTotal,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData) return;
    setIsSaving(true);
    try {
      const addressLines = buyerAddressText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      const finalData: InvoiceFormData = {
        ...formData,
        buyer: {
          ...formData.buyer,
          addressLines,
        },
      };

      await onSave(finalData);
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Invoice Details"
      subtitle="Customize document metadata, line items, taxes, and bank terms for this order"
      size="4xl"
      bodyClassName="px-7 py-5 md:px-8 md:py-6"
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
          <div className="flex items-center gap-3">
            {Boolean(defaultData || initialData) && (
              <button
                type="button"
                onClick={handleResetAllToDefault}
                className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6B7280] hover:text-[#E31E24] transition-colors cursor-pointer"
                title="Reset all tabs and values back to original order defaults"
              >
                <RotateCcw size={13} /> Reset All to Order Defaults
              </button>
            )}
            <span className="hidden sm:inline text-[#D1D5DB]">|</span>
            <p className="text-[12px] text-[#6B7280]">
              Updates invoice and PDF in real time.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-md border border-[#D1D5DB] bg-white px-4 py-2 text-[12.5px] font-semibold text-[#374151] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleSubmit}
              loading={isSaving}
              loadingText="Saving..."
              className="rounded-md bg-[#E31E24] px-5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs cursor-pointer"
            >
              Save Invoice Changes
            </LoadingButton>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#F0F0F0] pb-3 text-[13px] font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("header")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "header" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <FileText size={14} /> Header & Dates
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("seller")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "seller" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <Building size={14} /> Seller Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("buyer")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "buyer" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <User size={14} /> Buyer Details
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "items" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <ShoppingBag size={14} /> Items Table ({formData.items.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "summary" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <Calculator size={14} /> Taxes & Totals
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("terms")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors cursor-pointer ${
              activeTab === "terms" ? "bg-[#E31E24] text-white shadow-xs" : "bg-[#F3F4F6] text-[#4B5563] hover:bg-[#E5E7EB] hover:text-[#111]"
            }`}
          >
            <ShieldCheck size={14} /> Notes & Terms
          </button>
        </div>

        {/* Tab 1: Header & Dates */}
        {activeTab === "header" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Document Title</label>
              <input
                type="text"
                value={formData.documentTitle}
                onChange={(e) => updateField("documentTitle", e.target.value)}
                placeholder="TAX INVOICE"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
              <p className="mt-1 text-[11px] text-[#888]">e.g. TAX INVOICE, COMMERCIAL INVOICE, BILL OF SUPPLY</p>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Invoice Number</label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => updateField("invoiceNumber", e.target.value)}
                placeholder="INV-10042"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Invoice Date</label>
              <input
                type="date"
                value={formData.invoiceDate}
                onChange={(e) => updateField("invoiceDate", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Due Date (Optional)</label>
              <input
                type="date"
                value={formData.invoiceDueDate || ""}
                onChange={(e) => updateField("invoiceDueDate", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Seller Info */}
        {activeTab === "seller" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Seller Legal Name</label>
              <input
                type="text"
                value={formData.seller.name}
                onChange={(e) => updateSeller("name", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Seller Full Address</label>
              <textarea
                rows={2}
                value={formData.seller.address}
                onChange={(e) => updateSeller("address", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">GSTIN</label>
              <input
                type="text"
                value={formData.seller.gstin}
                onChange={(e) => updateSeller("gstin", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">PAN</label>
              <input
                type="text"
                value={formData.seller.pan}
                onChange={(e) => updateSeller("pan", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">IEC (Import Export Code)</label>
              <input
                type="text"
                value={formData.seller.iec}
                onChange={(e) => updateSeller("iec", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Ship-From State</label>
              <input
                type="text"
                value={formData.seller.shipFromState}
                onChange={(e) => updateSeller("shipFromState", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Support Email</label>
              <input
                type="email"
                value={formData.seller.email}
                onChange={(e) => updateSeller("email", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Website URL</label>
              <input
                type="text"
                value={formData.seller.website}
                onChange={(e) => updateSeller("website", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Buyer Details */}
        {activeTab === "buyer" && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Customer / Doctor Name</label>
              <input
                type="text"
                value={formData.buyer.name}
                onChange={(e) => updateBuyer("name", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Clinic / Company Name</label>
              <input
                type="text"
                value={formData.buyer.companyName}
                onChange={(e) => updateBuyer("companyName", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Billing & Shipping Address Lines (One per line)</label>
              <textarea
                rows={3}
                value={buyerAddressText}
                onChange={(e) => setBuyerAddressText(e.target.value)}
                placeholder="Address line 1&#10;City, State, Postal Code&#10;Country"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Customer Tax ID / GSTIN</label>
              <input
                type="text"
                value={formData.buyer.taxId}
                onChange={(e) => updateBuyer("taxId", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Tax ID Label</label>
              <input
                type="text"
                value={formData.buyer.taxIdType}
                onChange={(e) => updateBuyer("taxIdType", e.target.value)}
                placeholder="GSTIN or Tax ID"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">State / UT Code</label>
              <input
                type="text"
                value={formData.buyer.stateCode}
                onChange={(e) => updateBuyer("stateCode", e.target.value)}
                placeholder="03"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Place of Supply</label>
              <input
                type="text"
                value={formData.buyer.placeOfSupply}
                onChange={(e) => updateBuyer("placeOfSupply", e.target.value)}
                placeholder="PUNJAB"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Email</label>
              <input
                type="email"
                value={formData.buyer.email}
                onChange={(e) => updateBuyer("email", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Phone</label>
              <input
                type="text"
                value={formData.buyer.phone}
                onChange={(e) => updateBuyer("phone", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
          </div>
        )}

        {/* Tab 4: Items Table */}
        {activeTab === "items" && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[13px] font-medium text-[#666]">
                Adjust line items, unit rates, quantities, HSN codes, and tax rates.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {Boolean(defaultData?.items?.length || initialData?.items?.length) && (
                  <button
                    type="button"
                    onClick={handleResetItemsToDefault}
                    className="inline-flex items-center gap-1 rounded-md border border-[#D1D5DB] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111] transition-colors cursor-pointer"
                    title="Restore original items from the order"
                  >
                    <RotateCcw size={12} className="text-gray-500" /> Reset Items
                  </button>
                )}
                <button
                  type="button"
                  onClick={recalculateAllTotals}
                  className="inline-flex items-center gap-1 rounded-md border border-brand/30 bg-brand/5 px-2.5 py-1 text-[12px] font-semibold text-brand hover:bg-brand/10 transition-colors cursor-pointer"
                >
                  <Calculator size={13} /> Recalculate Totals
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-1 rounded-md bg-[#1A1A1A] px-2.5 py-1 text-[12px] font-semibold text-white hover:bg-black transition-colors cursor-pointer"
                >
                  <Plus size={13} /> Add Line Item
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[380px] border border-[#E6E6E6] rounded-lg">
              <table className="w-full text-left text-[12.5px]">
                <thead className="bg-[#F8F8F8] sticky top-0 border-b border-[#E6E6E6] text-[11px] uppercase font-bold text-[#666]">
                  <tr>
                    <th className="p-2 w-10 text-center">#</th>
                    <th className="p-2 min-w-[180px]">Product / Description</th>
                    <th className="p-2 w-24">HSN</th>
                    <th className="p-2 w-20 text-center">Qty</th>
                    <th className="p-2 w-24">Rate ({currencySymbol})</th>
                    <th className="p-2 w-24">Tax %</th>
                    <th className="p-2 w-24">Tax ({currencySymbol})</th>
                    <th className="p-2 w-28">Total ({currencySymbol})</th>
                    <th className="p-2 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {formData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FCFCFC]">
                      <td className="p-2 text-center text-[#888] font-mono">{idx + 1}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => handleItemChange(idx, "title", e.target.value)}
                          placeholder="Product Name"
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-medium"
                        />
                        <input
                          type="text"
                          value={item.variantTitle || ""}
                          onChange={(e) => handleItemChange(idx, "variantTitle", e.target.value)}
                          placeholder="Variant info (Optional)"
                          className="w-full rounded border border-[#E6E6E6] px-2 py-0.5 mt-1 text-[11px] text-[#666]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={item.hsnCode || ""}
                          onChange={(e) => handleItemChange(idx, "hsnCode", e.target.value)}
                          placeholder="9021"
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-mono"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, "quantity", e.target.value)}
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px] text-center"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(idx, "unitPrice", e.target.value)}
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px]"
                        />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            step="0.5"
                            value={item.taxRate}
                            onChange={(e) => handleItemChange(idx, "taxRate", e.target.value)}
                            className="w-12 rounded border border-[#E6E6E6] px-1.5 py-1 text-[12px]"
                          />
                          <select
                            value={item.taxType}
                            onChange={(e) => handleItemChange(idx, "taxType", e.target.value)}
                            className="rounded border border-[#E6E6E6] text-[11px] py-1"
                          >
                            <option value="IGST">IGST</option>
                            <option value="CGST/SGST">CGST/SGST</option>
                            <option value="VAT">VAT</option>
                            <option value="LUT">LUT</option>
                          </select>
                        </div>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.taxAmount}
                          onChange={(e) => handleItemChange(idx, "taxAmount", Number(e.target.value))}
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          step="0.01"
                          value={item.total}
                          onChange={(e) => handleItemChange(idx, "total", Number(e.target.value))}
                          className="w-full rounded border border-[#E6E6E6] px-2 py-1 text-[12px] font-semibold"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Remove Line"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 5: Taxes & Totals */}
        {activeTab === "summary" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <p className="text-[13px] text-[#666]">
                Review or override summary amounts and tax breakdown.
              </p>
              <button
                type="button"
                onClick={recalculateAllTotals}
                className="inline-flex items-center gap-1.5 rounded-md border border-brand/40 bg-brand/5 px-3 py-1.5 text-[12.5px] font-semibold text-brand hover:bg-brand/10"
              >
                <Calculator size={14} /> Recalculate From Items
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">Taxable Subtotal ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.subtotal}
                  onChange={(e) => updateSummary("subtotal", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">Discount Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.discount}
                  onChange={(e) => updateSummary("discount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">Shipping Charge ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.shippingCharge}
                  onChange={(e) => updateSummary("shippingCharge", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">Total Tax Amount ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.taxAmount}
                  onChange={(e) => updateSummary("taxAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">CGST ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.cgstAmount}
                  onChange={(e) => updateSummary("cgstAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">SGST ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.sgstAmount}
                  onChange={(e) => updateSummary("sgstAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">IGST ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.igstAmount}
                  onChange={(e) => updateSummary("igstAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#333] mb-1">VAT ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.vatAmount}
                  onChange={(e) => updateSummary("vatAmount", Number(e.target.value))}
                  className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px]"
                />
              </div>
              <div className="sm:col-span-2 rounded-lg bg-[#F8F9FA] p-3 border border-[#E6E6E6]">
                <label className="block text-[13px] font-bold text-[#111] mb-1">Final Invoice Total ({currencySymbol})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.summary.total}
                  onChange={(e) => updateSummary("total", Number(e.target.value))}
                  className="w-full rounded-md border border-[#CCC] bg-white px-3 py-2 text-[15px] font-bold text-brand"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: Notes & Terms */}
        {activeTab === "terms" && (
          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Notes / Remarks</label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Special notes or dispatch remarks..."
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Terms & Conditions</label>
              <textarea
                rows={3}
                value={formData.terms}
                onChange={(e) => updateField("terms", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Bank Account Details (For Wire / NEFT Transfer)</label>
              <textarea
                rows={2}
                value={formData.bankDetails}
                onChange={(e) => updateField("bankDetails", e.target.value)}
                placeholder="Bank Name: HDFC Bank&#10;Account No: 1234567890&#10;IFSC: HDFC0001234"
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-mono"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#333] mb-1">Authorized Signatory Declaration Text</label>
              <input
                type="text"
                value={formData.authorizedSignatory}
                onChange={(e) => updateField("authorizedSignatory", e.target.value)}
                className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px]"
              />
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}
