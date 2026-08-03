"use client";

import { Modal } from "@/components/ui/Modal";
import { Check, AlertTriangle, HelpCircle } from "lucide-react";

export interface AddressData {
  fullName?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
}

interface AddressValidationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  originalAddress: AddressData;
  recommendedAddress: AddressData | null;
  isValid: boolean;
  onSelectOriginal: () => void;
  onSelectRecommended: () => void;
}

export function AddressValidationDialog({
  isOpen,
  onClose,
  originalAddress,
  recommendedAddress,
  isValid,
  onSelectOriginal,
  onSelectRecommended,
}: AddressValidationDialogProps) {
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Verify Shipping Address"
      panelClassName="max-w-xl rounded-2xl border border-line bg-white shadow-xl"
    >
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-3 bg-[#FFF9EB] border border-[#FEEFC7] rounded-xl p-3.5 text-xs text-[#B54708]">
          <AlertTriangle size={18} className="shrink-0 mt-0.5 text-[#D04900]" />
          <div>
            <p className="font-semibold mb-0.5">Google Address Validation Alert</p>
            <p className="leading-relaxed font-normal">
              {isValid
                ? "We found a standardized version of your address. Please choose which version you prefer to use for correct shipping delivery:"
                : "The address you entered might not be fully deliverable. We suggest the standardized address below. Please select the correct version:"}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Original Address Box */}
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F9] p-4 flex flex-col justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E5E7EB] px-2.5 py-0.5 text-[10px] font-semibold text-[#4A4A4A]">
                Entered Address
              </span>
              <div className="text-xs text-[#333] space-y-1 mt-2">
                <p className="font-semibold">{originalAddress.fullName}</p>
                <p>{originalAddress.addressLine1}</p>
                {originalAddress.addressLine2 && <p>{originalAddress.addressLine2}</p>}
                <p>
                  {originalAddress.city}, {originalAddress.state} {originalAddress.postalCode}
                </p>
                <p className="font-medium text-[#6B7280]">
                  {originalAddress.countryCode.toUpperCase()}
                </p>
                {originalAddress.phone && <p className="text-[11px] text-[#6B7280]">Phone: {originalAddress.phone}</p>}
              </div>
            </div>

            <button
              type="button"
              onClick={onSelectOriginal}
              className="mt-5 w-full rounded-lg border border-[#D1D5DB] bg-white px-3.5 py-2 text-xs font-semibold text-[#374151] hover:bg-[#F9FAFB] transition-colors focus:outline-none"
            >
              Keep Original Address
            </button>
          </div>

          {/* Recommended Address Box */}
          {recommendedAddress ? (
            <div className="rounded-xl border border-[#E31E24]/20 bg-[#FFF5F5]/30 p-4 flex flex-col justify-between shadow-xs">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E31E24]/10 px-2.5 py-0.5 text-[10px] font-semibold text-[#B5151B]">
                  <Check size={11} /> Recommended Address
                </span>
                <div className="text-xs text-[#111] space-y-1 mt-2">
                  <p className="font-semibold">{originalAddress.fullName}</p>
                  <p className="font-medium">{recommendedAddress.addressLine1}</p>
                  {recommendedAddress.addressLine2 && <p>{recommendedAddress.addressLine2}</p>}
                  <p className="font-medium">
                    {recommendedAddress.city}, {recommendedAddress.state} {recommendedAddress.postalCode}
                  </p>
                  <p className="font-semibold text-[#E31E24]">
                    {recommendedAddress.countryCode.toUpperCase()}
                  </p>
                  {originalAddress.phone && <p className="text-[11px] text-[#6B7280]">Phone: {originalAddress.phone}</p>}
                </div>
              </div>

              <button
                type="button"
                onClick={onSelectRecommended}
                className="mt-5 w-full rounded-lg bg-[#E31E24] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#B5151B] transition-colors shadow-2xs focus:outline-none"
              >
                Use Recommended Address
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#D1D5DB] bg-white p-4 flex flex-col items-center justify-center text-center">
              <HelpCircle size={24} className="text-[#9CA3AF] mb-2" />
              <p className="text-xs font-medium text-[#4A4A4A]">No standardized match found.</p>
              <p className="text-[10px] text-[#9CA3AF] mt-1 max-w-[200px]">
                Please double check your spelling or choose to keep original.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2 border-t border-[#F0F0F0]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors focus:outline-none"
          >
            Go Back &amp; Edit
          </button>
        </div>
      </div>
    </Modal>
  );
}
