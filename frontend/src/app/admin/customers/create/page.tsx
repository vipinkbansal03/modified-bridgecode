"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, Save } from "lucide-react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminInput, AdminSelect, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminTiers,
  useCreateAdminCustomer,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

const validationSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  email: Yup.string().trim().email("Invalid email address").required("Email is required"),
  phone: Yup.string().trim().nullable(),
  companyName: Yup.string().trim().nullable(),
  customerType: Yup.string().required("Customer type is required"),
  status: Yup.string().required("Status is required"),
  customerRoleId: Yup.string().nullable(),
  tierId: Yup.string().nullable(),
  defaultCountryId: Yup.string().nullable(),
  password: Yup.string().min(6, "Password must be at least 6 characters").nullable(),
});

export default function AdminCustomerCreatePage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("customers.create")) {
      router.replace("/admin/customers");
    }
  }, [authLoading, hasPermission, router]);

  const { showToast, ToastComponent } = useToast();
  const createCustomer = useCreateAdminCustomer();
  const { data: customerRoles = [] } = useAdminCustomerRoles();
  const { data: tiers = [] } = useAdminTiers();
  const { data: countries = [] } = useAdminCountries() as { data?: any[] };

  const countryOptions = Array.isArray(countries)
    ? countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
    : [];

  const roleOptions = [
    { value: "", label: "No specific role" },
    ...(Array.isArray(customerRoles) ? customerRoles.map((r: any) => ({ value: r.id, label: r.name })) : []),
  ];

  const tierOptions = [
    { value: "", label: "Default tier (Base pricing)" },
    ...(Array.isArray(tiers) ? tiers.map((t: any) => ({ value: t.id, label: t.name })) : []),
  ];

  const form = useFormik({
    initialValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: "",
      customerType: "RETAIL",
      status: "ACTIVE",
      customerRoleId: "",
      tierId: "",
      defaultCountryId: "",
      password: "",
      taxId: "",
      taxIdType: "",
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const payload: Record<string, any> = {
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email.trim(),
          customerType: values.customerType,
          status: values.status,
          phone: values.phone?.trim() || null,
          companyName: values.companyName?.trim() || null,
          customerRoleId: values.customerRoleId || null,
          tierId: values.tierId || null,
          defaultCountryId: values.defaultCountryId || null,
          taxId: values.taxId?.trim() || null,
          taxIdType: values.taxIdType?.trim() || null,
        };
        if (values.password?.trim()) {
          payload.password = values.password.trim();
        }

        const res = await createCustomer.mutateAsync(payload);
        showToast("Customer created successfully.", "success");
        const newId = res?.data?.id || res?.id;
        if (newId) {
          router.push(`/admin/customers/${newId}`);
        } else {
          router.push("/admin/customers");
        }
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to create customer."), "error");
      }
    },
  });

  return (
    <AdminLayout title="Add Customer" breadcrumb={[{ label: "Customers", href: "/admin/customers" }, { label: "Add Customer" }]}>
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center justify-between">
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
          >
            <ArrowLeft size={16} />
            Back to customers
          </Link>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white shadow-2xs overflow-hidden">
          <div className="border-b border-[#F0F0F0] px-6 py-4">
            <h2 className="text-[16px] font-semibold text-[#1A1A1A]">Customer Information</h2>
            <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
              Add a new customer account, specify account type, role, and pricing tier overrides.
            </p>
          </div>

          <form onSubmit={form.handleSubmit} className="p-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <AdminInput
                required
                label="First Name"
                placeholder="e.g. Jane"
                {...form.getFieldProps("firstName")}
                error={form.touched.firstName && form.errors.firstName ? form.errors.firstName : undefined}
              />
              <AdminInput
                required
                label="Last Name"
                placeholder="e.g. Doe"
                {...form.getFieldProps("lastName")}
                error={form.touched.lastName && form.errors.lastName ? form.errors.lastName : undefined}
              />
              <AdminInput
                required
                type="email"
                label="Email Address"
                placeholder="jane.doe@example.com"
                {...form.getFieldProps("email")}
                error={form.touched.email && form.errors.email ? form.errors.email : undefined}
              />
              <AdminInput
                type="text"
                label="Phone"
                placeholder="+1 555-0199"
                {...form.getFieldProps("phone")}
                error={form.touched.phone && form.errors.phone ? form.errors.phone : undefined}
              />
              <AdminInput
                type="text"
                label="Company Name"
                placeholder="Clinic / Business Name"
                {...form.getFieldProps("companyName")}
                error={form.touched.companyName && form.errors.companyName ? form.errors.companyName : undefined}
              />
              <AdminInput
                type="password"
                label="Password (Optional)"
                placeholder="Leave blank for auto-generated temporary password"
                {...form.getFieldProps("password")}
                error={form.touched.password && form.errors.password ? form.errors.password : undefined}
              />
            </div>

            <div className="border-t border-[#F0F0F0] pt-6">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-4">Account Classification & Settings</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminSelect
                  label="Customer Type"
                  {...form.getFieldProps("customerType")}
                  options={[
                    { value: "RETAIL", label: "Retail" },
                    { value: "DEALER", label: "Dealer" },
                    { value: "DOCTOR", label: "Doctor" },
                    { value: "WHOLESALE", label: "Wholesale" },
                  ]}
                />
                <AdminSelect
                  label="Status"
                  {...form.getFieldProps("status")}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminSelect
                  label="Customer Role"
                  value={form.values.customerRoleId}
                  onChange={(e) => form.setFieldValue("customerRoleId", e.target.value)}
                  options={roleOptions}
                />
                <AdminSelect
                  label="Pricing Tier"
                  value={form.values.tierId}
                  onChange={(e) => form.setFieldValue("tierId", e.target.value)}
                  options={tierOptions}
                />
                <div className="sm:col-span-2">
                  <AdminSearchableSelect
                    label="Default Country"
                    value={form.values.defaultCountryId}
                    onChange={(e) => form.setFieldValue("defaultCountryId", e.target.value)}
                    options={[{ value: "", label: "No default country" }, ...countryOptions]}
                    placeholder="Select country"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-[#F0F0F0] pt-6">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-4">Tax Information (Optional)</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminInput
                  type="text"
                  label="Tax ID / GSTIN / VAT"
                  placeholder="e.g. 27AAAAA0000A1Z5"
                  {...form.getFieldProps("taxId")}
                />
                <AdminInput
                  type="text"
                  label="Tax ID Type"
                  placeholder="e.g. GSTIN, VAT, EIN"
                  {...form.getFieldProps("taxIdType")}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 border-t border-[#F0F0F0] pt-4">
              <Link
                href="/admin/customers"
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors"
              >
                Cancel
              </Link>
              <LoadingButton
                type="submit"
                loading={form.isSubmitting || createCustomer.isPending}
                loadingText="Creating Customer..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs cursor-pointer"
              >
                Create Customer
              </LoadingButton>
            </div>
          </form>
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
