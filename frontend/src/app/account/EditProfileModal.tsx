"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { User, Building2, Globe, Check } from "lucide-react";
import { useCustomerAuth, type CustomerSession } from "@/contexts/CustomerAuthContext";
import { updateCustomerProfile, getCustomerErrorMessage } from "@/services/customerApi";
import { isValidPhoneNumber } from "react-phone-number-input";
import PhoneInputField from "@/components/ui/PhoneInput";
import { Modal } from "@/components/ui/Modal";

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: CustomerSession) => void;
}

const profileSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  phone: Yup.string()
    .trim()
    .required("Phone number is required")
    .test("is-valid-phone", "Please enter a valid phone number for the selected country", (value) => {
      if (!value) return false;
      return isValidPhoneNumber(value);
    }),
  companyName: Yup.string().trim(),
  website: Yup.string().trim(),
  preferredPrescription: Yup.string().nullable(),
  preferredSlot: Yup.string().nullable(),
  currentPractice: Yup.string().nullable(),
});

export default function EditProfileModal({ isOpen, onClose, onSuccess }: EditProfileModalProps) {
  const { currentCustomer } = useCustomerAuth();
  const [error, setError] = useState<string | null>(null);

  const formik = useFormik({
    initialValues: {
      firstName: currentCustomer?.firstName || "",
      lastName: currentCustomer?.lastName || "",
      phone: currentCustomer?.phone || "",
      companyName: currentCustomer?.companyName || "",
      website: currentCustomer?.website || "",
      preferredPrescription: currentCustomer?.preferredPrescription || "",
      preferredSlot: currentCustomer?.preferredSlot || "",
      currentPractice: currentCustomer?.currentPractice || "",
    },
    enableReinitialize: true,
    validationSchema: profileSchema,
    onSubmit: async (values) => {
      setError(null);
      try {
        const updated = await updateCustomerProfile({
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          companyName: values.companyName || undefined,
          website: values.website || undefined,
          preferredPrescription: values.preferredPrescription || null,
          preferredSlot: values.preferredSlot || null,
          currentPractice: values.currentPractice || null,
        });
        onSuccess(updated);
        onClose();
      } catch (err) {
        setError(getCustomerErrorMessage(err, "Failed to update profile."));
      }
    },
  });

  if (!currentCustomer) return null;

  return (
    <Modal open={isOpen} onClose={onClose} title="Edit Profile" panelClassName="max-w-lg rounded-2xl">
      <div className="max-h-[80vh] overflow-y-auto custom-scrollbar p-6 space-y-4">
        {error && (
          <div className="rounded-xl border border-[#FEE2E2] bg-[#FEF2F2] p-3 text-xs text-[#B91C1C]">
            {error}
          </div>
        )}

        <form onSubmit={formik.handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">First Name *</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  name="firstName"
                  value={formik.values.firstName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="w-full rounded-lg border border-[#D1D5DB] pl-9 pr-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
                />
              </div>
              {formik.touched.firstName && formik.errors.firstName && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.firstName}</p>
              )}
            </div>

            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Last Name *</label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  name="lastName"
                  value={formik.values.lastName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className="w-full rounded-lg border border-[#D1D5DB] pl-9 pr-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
                />
              </div>
              {formik.touched.lastName && formik.errors.lastName && (
                <p className="mt-1 text-[11.5px] text-[#E31E24]">{formik.errors.lastName}</p>
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
              defaultCountry="IN"
              placeholder="Mobile number with country code"
            />
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Company / Clinic Name</label>
            <div className="relative">
              <Building2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                name="companyName"
                value={formik.values.companyName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] pl-9 pr-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Website</label>
            <div className="relative">
              <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                name="website"
                placeholder="https://example.com"
                value={formik.values.website}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className="w-full rounded-lg border border-[#D1D5DB] pl-9 pr-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Preferred Prescription</label>
              <select
                name="preferredPrescription"
                value={formik.values.preferredPrescription}
                onChange={formik.handleChange}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none bg-white"
              >
                <option value="">None Selected</option>
                <option value="MBT">MBT</option>
                <option value="ROTH">ROTH</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Preferred Slot</label>
              <select
                name="preferredSlot"
                value={formik.values.preferredSlot}
                onChange={formik.handleChange}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13.5px] text-[#111827] focus:border-[#E31E24] focus:outline-none bg-white"
              >
                <option value="">None Selected</option>
                <option value="022">.022</option>
                <option value="018">.018</option>
              </select>
            </div>
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
              {formik.isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
