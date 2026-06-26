"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { ArrowRight, CheckCircle2, Eye, EyeOff, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerErrorMessage } from "@/services/customerApi";

const customerTypeOptions = [
  { value: "RETAIL", label: "Retail customer" },
  { value: "DOCTOR", label: "Doctor / Retailer" },
  { value: "DEALER", label: "Dealer" },
  { value: "WHOLESALE", label: "Wholesale customer" },
];

const registerSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
  phone: Yup.string().trim(),
  customerType: Yup.string().oneOf(["RETAIL", "DEALER", "DOCTOR", "WHOLESALE"]),
});

type RegisterFormValues = Yup.InferType<typeof registerSchema>;
type CustomerType = "RETAIL" | "DEALER" | "DOCTOR" | "WHOLESALE";

export default function RegisterPage() {
  const { register } = useCustomerAuth();
  const [returnTo, setReturnTo] = useState("/");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.startsWith("/")) setReturnTo(next);
  }, []);

  const formik = useFormik<RegisterFormValues>({
    initialValues: {
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      phone: "",
      customerType: "RETAIL",
    },
    validationSchema: registerSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try {
        await register(
          {
            firstName: values.firstName.trim(),
            lastName: values.lastName.trim(),
            email: values.email,
            password: values.password,
            phone: values.phone?.trim() || undefined,
            customerType: values.customerType as CustomerType,
          },
          returnTo,
        );
      } catch (error) {
        helpers.setStatus(getCustomerErrorMessage(error, "Could not create account."));
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <main className="relative min-h-[calc(100svh-80px)] overflow-hidden bg-[#F7F7F7] px-4 py-10 sm:px-6">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/auth/login2.jpg')" }}
      />
      <div className="absolute inset-0 bg-white/68 backdrop-blur-[1px]" />
      <div className="relative mx-auto w-full max-w-[760px]">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24] text-white">
            <UserPlus size={21} />
          </div>
          <h1 className="text-[26px] font-semibold text-[#1A1A1A]">Create customer account</h1>
          <p className="mt-1.5 text-[14px] text-[#6B6B6B]">
            Join Modern Orthodontics as a retail customer, doctor, dealer or wholesale buyer.
          </p>
        </div>

        <div className="mb-5 flex items-start justify-center">
          <div className="flex items-center">
            <div className="flex flex-col items-center gap-1 text-[12px] font-medium text-[#1A1A1A]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E31E24] text-[13px] font-semibold text-white">
                <CheckCircle2 size={15} />
              </span>
              <span>Account</span>
            </div>
            <div className="mt-4 h-[2px] w-16 bg-[#D8D8D8] sm:w-24" />
            <div className="flex flex-col items-center gap-1 text-[12px] font-medium text-[#777]">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[#D8D8D8] bg-white text-[13px] font-semibold text-[#8A8A8A]">
                2
              </span>
              <span>Profile</span>
            </div>
          </div>
        </div>

        <form
          onSubmit={formik.handleSubmit}
          noValidate
          className="rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.10)] backdrop-blur-xl sm:p-7"
        >
          <div className="mb-6">
            <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Account details</h2>
            <p className="mt-1 text-[13px] text-[#777]">
              Create your login and choose the customer type used for pricing and approval workflows.
            </p>
          </div>

          <div className="space-y-5">
            {formik.status && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {formik.status}
              </div>
            )}

            <Select
              id="customerType"
              name="customerType"
              label="Register as"
              options={customerTypeOptions}
              value={formik.values.customerType}
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              error={formik.errors.customerType}
              touched={formik.touched.customerType}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                id="firstName"
                name="firstName"
                label="First name"
                placeholder="First name"
                autoComplete="given-name"
                value={formik.values.firstName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.firstName}
                touched={formik.touched.firstName}
                required
              />
              <Input
                id="lastName"
                name="lastName"
                label="Last name"
                placeholder="Last name"
                autoComplete="family-name"
                value={formik.values.lastName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.lastName}
                touched={formik.touched.lastName}
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Input
                id="email"
                name="email"
                type="email"
                label="Email address"
                placeholder="you@example.com"
                autoComplete="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.email}
                touched={formik.touched.email}
                required
              />
              <Input
                id="phone"
                name="phone"
                label="Phone number (optional)"
                placeholder="+91 98765 43210"
                autoComplete="tel"
                value={formik.values.phone}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.phone}
                touched={formik.touched.phone}
              />
            </div>

            <div className="relative">
              <Input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                label="Password"
                placeholder="Minimum 8 characters"
                autoComplete="new-password"
                className="pr-11"
                value={formik.values.password}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.password}
                touched={formik.touched.password}
                required
              />
              <button
                type="button"
                title={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-[34px] text-[#999] hover:text-[#1A1A1A]"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <button
              type="submit"
              disabled={formik.isSubmitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#E31E24] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formik.isSubmitting ? "Creating account..." : "Create account"}
              {!formik.isSubmitting && <ArrowRight size={16} />}
            </button>
          </div>
        </form>

        <p className="mt-5 text-center text-[13px] text-[#666]">
          Already have an account?{" "}
          <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-semibold text-[#E31E24] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
