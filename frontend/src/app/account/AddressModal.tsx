"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Check } from "lucide-react";
import {
  createCustomerAddress,
  updateCustomerAddress,
  validateCustomerAddress,
  getCustomerErrorMessage,
  type CustomerAddress,
} from "@/services/customerApi";
import { worldCountries } from "@/data/world-countries";
import PhoneInputField from "@/components/ui/PhoneInput";
import { isValidPhoneNumber } from "react-phone-number-input";
import { Modal } from "@/components/ui/Modal";
import { AddressValidationDialog, type AddressData } from "@/components/ui/delivery/AddressValidationDialog";

interface AddressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (address: CustomerAddress) => void;
  editingAddress?: CustomerAddress | null;
}

const addressSchema = Yup.object({
  label: Yup.string().trim(),
  fullName: Yup.string().trim().required("Full name is required"),
  phone: Yup.string()
    .trim()
    .required("Phone number is required")
    .test("is-valid-phone", "Please enter a valid phone number for the selected country", (value) => {
      if (!value) return false;
      return isValidPhoneNumber(value);
    }),
  addressLine1: Yup.string().trim().required("Address is required"),
  addressLine2: Yup.string().trim(),
  city: Yup.string().trim().required("City is required"),
  state: Yup.string().trim().required("State is required"),
  postalCode: Yup.string().trim().required("Postal/ZIP code is required"),
  country: Yup.string().trim().required("Country is required"),
  isDefault: Yup.boolean(),
});

export default function AddressModal({
  isOpen,
  onClose,
  onSuccess,
  editingAddress,
}: AddressModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [validationState, setValidationState] = useState<{
    isOpen: boolean;
    originalAddress: AddressData;
    recommendedAddress: AddressData | null;
    isValid: boolean;
    pendingValues: any;
  } | null>(null);

  const handleSelectOriginal = async () => {
    if (!validationState) return;
    setError(null);
    try {
      const savePayload = {
        ...validationState.pendingValues,
        originalAddress: validationState.originalAddress,
        normalizedAddress: null,
        validationProvider: "google-address-validation",
        validationResult: null,
        validationStatus: "VALIDATED",
      };

      let result: CustomerAddress;
      if (editingAddress) {
        result = await updateCustomerAddress(editingAddress.id, savePayload);
      } else {
        result = await createCustomerAddress(savePayload);
      }
      onSuccess(result);
      setValidationState(null);
      onClose();
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Failed to save address."));
      setValidationState(null);
    }
  };

  const handleSelectRecommended = async () => {
    if (!validationState || !validationState.recommendedAddress) return;
    const recommended = validationState.recommendedAddress;
    setError(null);
    try {
      const finalValues = {
        ...validationState.pendingValues,
        addressLine1: recommended.addressLine1,
        addressLine2: recommended.addressLine2 || "",
        city: recommended.city,
        state: recommended.state,
        postalCode: recommended.postalCode,
      };

      const savePayload = {
        ...finalValues,
        originalAddress: validationState.originalAddress,
        normalizedAddress: recommended,
        validationProvider: "google-address-validation",
        validationResult: null,
        validationStatus: "CORRECTED",
      };

      let result: CustomerAddress;
      if (editingAddress) {
        result = await updateCustomerAddress(editingAddress.id, savePayload);
      } else {
        result = await createCustomerAddress(savePayload);
      }
      onSuccess(result);
      setValidationState(null);
      onClose();
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Failed to save address."));
      setValidationState(null);
    }
  };

  const formik = useFormik({
    initialValues: {
      label: editingAddress?.label || "Home",
      fullName: editingAddress?.fullName || "",
      phone: editingAddress?.phone || "",
      addressLine1: editingAddress?.addressLine1 || "",
      addressLine2: editingAddress?.addressLine2 || "",
      city: editingAddress?.city || "",
      state: editingAddress?.state || "",
      postalCode: editingAddress?.postalCode || "",
      country: editingAddress?.country?.name || editingAddress?.country?.code || "India",
      isDefault: editingAddress?.isDefault || false,
    },
    enableReinitialize: true,
    validationSchema: addressSchema,
    onSubmit: async (values) => {
      setError(null);
      try {
        const selectedCountry = worldCountries.find(
          (c) => c.name.toLowerCase() === values.country.toLowerCase() || c.code.toLowerCase() === values.country.toLowerCase()
        );
        const countryCode = selectedCountry?.code || "IN";

        const addressPayload = {
          addressLine1: values.addressLine1,
          addressLine2: values.addressLine2 || undefined,
          city: values.city,
          state: values.state,
          postalCode: values.postalCode,
          countryCode: countryCode.toUpperCase(),
        };

        const valResult = await validateCustomerAddress(addressPayload);

        if (valResult.isCorrected) {
          setValidationState({
            isOpen: true,
            originalAddress: {
              ...addressPayload,
              fullName: values.fullName,
              phone: values.phone,
            },
            recommendedAddress: valResult.normalizedAddress,
            isValid: valResult.isValid,
            pendingValues: values,
          });
        } else {
          const savePayload = {
            ...values,
            originalAddress: addressPayload,
            normalizedAddress: null,
            validationProvider: valResult.validationProvider,
            validationResult: valResult.validationResult,
            validationStatus: valResult.isValid ? "VALIDATED" : "INVALID",
          };
          let result: CustomerAddress;
          if (editingAddress) {
            result = await updateCustomerAddress(editingAddress.id, savePayload);
          } else {
            result = await createCustomerAddress(savePayload);
          }
          onSuccess(result);
          onClose();
        }
      } catch (err) {
        setError(getCustomerErrorMessage(err, "Failed to save address."));
      }
    },
  });

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={editingAddress ? "Edit Address" : "Add New Address"}
      panelClassName="max-w-lg rounded-2xl"
    >
      <div className="max-h-[80vh] overflow-y-auto custom-scrollbar p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]">
            {error}
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Address Label</label>
              <input
                type="text"
                name="label"
                placeholder="e.g. Home, Clinic, Work"
                value={formik.values.label}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={formik.values.fullName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
              {formik.touched.fullName && formik.errors.fullName && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.fullName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Phone Number *</label>
            <PhoneInputField
              value={formik.values.phone}
              onChange={(val) => formik.setFieldValue("phone", val || "")}
              onBlur={() => formik.setFieldTouched("phone", true)}
              error={formik.errors.phone}
              touched={formik.touched.phone}
              defaultCountry={(worldCountries.find((c) => c.name === formik.values.country)?.code as any) || "IN"}
              placeholder="Mobile number with country code"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Address Line 1 *</label>
            <input
              type="text"
              name="addressLine1"
              placeholder="Street address, P.O. Box"
              value={formik.values.addressLine1}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
            />
            {formik.touched.addressLine1 && formik.errors.addressLine1 && (
              <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.addressLine1}</p>
            )}
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Address Line 2</label>
            <input
              type="text"
              name="addressLine2"
              placeholder="Apartment, suite, unit, building"
              value={formik.values.addressLine2}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">City *</label>
              <input
                type="text"
                name="city"
                value={formik.values.city}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
              {formik.touched.city && formik.errors.city && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.city}</p>
              )}
            </div>

            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">State / Province *</label>
              <input
                type="text"
                name="state"
                value={formik.values.state}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
              {formik.touched.state && formik.errors.state && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.state}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Postal / ZIP Code *</label>
              <input
                type="text"
                name="postalCode"
                value={formik.values.postalCode}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
              {formik.touched.postalCode && formik.errors.postalCode && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.postalCode}</p>
              )}
            </div>

            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Country *</label>
              <select
                name="country"
                value={formik.values.country}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none bg-white"
              >
                {worldCountries.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isDefault"
              name="isDefault"
              checked={formik.values.isDefault}
              onChange={formik.handleChange}
              className="h-4 w-4 rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24]"
            />
            <label htmlFor="isDefault" className="text-[13px] font-medium text-[#374151] cursor-pointer">
              Set as default shipping address
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#F3F4F6]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[13px] font-semibold text-[#6B7280] hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formik.isSubmitting || !formik.isValid}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#E31E24] text-[13px] font-bold text-white shadow-xs hover:bg-[#B5151B] disabled:opacity-50"
            >
              <Check size={15} />
              {formik.isSubmitting ? "Saving..." : editingAddress ? "Update Address" : "Add Address"}
            </button>
          </div>
        </form>
      </div>

      {validationState && (
        <AddressValidationDialog
          isOpen={validationState.isOpen}
          onClose={() => setValidationState(null)}
          originalAddress={validationState.originalAddress}
          recommendedAddress={validationState.recommendedAddress}
          isValid={validationState.isValid}
          onSelectOriginal={handleSelectOriginal}
          onSelectRecommended={handleSelectRecommended}
        />
      )}
    </Modal>
  );
}
