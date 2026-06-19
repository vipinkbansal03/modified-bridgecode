"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput } from "@/components/admin/AdminComponents";
import { Eye, EyeOff, Lock } from "lucide-react";

const schema = Yup.object({ email: Yup.string().email("Invalid email").required("Email is required"), password: Yup.string().min(6, "Min 6 characters").required("Password is required") });

export default function AdminLoginPage() {
  const { login } = useAdminAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting }) => {
      setError("");
      try {
        await login(values.email, values.password);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Login failed. Check your credentials.";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E31E24] text-white mb-3">
            <Lock size={22} />
          </div>
          <h1 className="text-[22px] font-semibold text-[#1A1A1A]">Admin Login</h1>
          <p className="mt-1 text-[13.5px] text-[#6B6B6B]">Modern Orthodontics B2B Platform</p>
        </div>

        <form onSubmit={formik.handleSubmit} className="rounded-xl bg-white border border-[#E6E6E6] p-6 space-y-4 shadow-sm">
          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-[13.5px] text-red-700">
              {error}
            </div>
          )}

          <AdminInput
            label="Email address"
            type="email"
            placeholder="admin@modortho.com"
            {...formik.getFieldProps("email")}
            error={formik.touched.email ? (formik.errors.email as string) : ""}
          />

          <div className="relative">
            <AdminInput
              label="Password"
              type={showPw ? "text" : "password"}
              placeholder="Enter password"
              {...formik.getFieldProps("password")}
              error={formik.touched.password ? (formik.errors.password as string) : ""}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-[34px] text-[#9A9A9A] hover:text-[#1A1A1A]"
            >
              {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="w-full rounded-md bg-[#E31E24] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:opacity-60"
          >
            {formik.isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-[12px] text-[#9A9A9A]">
          Default credentials: admin@modortho.com / Admin@1234
        </p>
      </div>
    </div>
  );
}
