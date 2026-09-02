"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput } from "@/components/admin/AdminComponents";
import { Eye, EyeOff, Lock, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

const schema = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
  password: Yup.string().min(6, "Min 6 characters").required("Password is required"),
});

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, login, isLoading } = useAdminAuth();
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const reasonParam = searchParams.get("reason");
  const [expiredBanner, setExpiredBanner] = useState<string | null>(
    reasonParam === "expired" ? "Your session has expired. Please log in again." : null
  );

  useEffect(() => {
    if (reasonParam === "expired") {
      setExpiredBanner("Your session has expired. Please log in again.");
    }
  }, [reasonParam]);

  const returnToParam = searchParams.get("returnTo");
  const targetRedirect = returnToParam && returnToParam.startsWith("/admin") ? returnToParam : "/admin/dashboard";

  useEffect(() => {
    if (!isLoading && user) {
      router.replace(targetRedirect);
    }
  }, [isLoading, user, targetRedirect, router]);

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting }) => {
      setError("");
      setExpiredBanner(null);
      try {
        await login(values.email, values.password);
        router.push(targetRedirect);
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Login failed. Check your credentials.";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  if (isLoading || user) {
    return (
      <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#E31E24] border-t-transparent" />
          <p className="text-[13px] font-medium text-[#6B6B6B]">Redirecting to admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#E31E24] text-white mb-3 shadow-xs">
            <Lock size={22} />
          </div>
          <h1 className="text-[22px] font-semibold text-[#1A1A1A]">Admin Login</h1>
          <p className="mt-1 text-[13.5px] text-[#6B6B6B]">Modern Orthodontics B2B Platform</p>
        </div>

        <form onSubmit={formik.handleSubmit} className="rounded-xl bg-white border border-[#E6E6E6] p-6 space-y-4 shadow-sm">
          {expiredBanner && !error && (
            <div className="flex items-center gap-2.5 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-[13px] font-medium text-amber-800 shadow-2xs">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>{expiredBanner}</span>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3 text-[13.5px] text-red-700">
              {error}
            </div>
          )}

          <AdminInput
            label="Email address"
            type="email"
            placeholder="Enter your email"
            {...formik.getFieldProps("email")}
            error={formik.touched.email ? (formik.errors.email as string) : ""}
          />

          <div>
            <label className="block text-[13px] font-medium text-[#1A1A1A] mb-1.5">
              Password
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                placeholder="Enter password"
                {...formik.getFieldProps("password")}
                className={cn(
                  "w-full rounded-md border bg-white pl-3.5 pr-10 py-2.5 text-[14px] text-[#1A1A1A] outline-none transition-colors placeholder:text-[#9A9A9A]",
                  formik.touched.password && formik.errors.password
                    ? "border-red-400 focus:border-red-500"
                    : "border-[#E6E6E6] focus:border-[#E31E24]"
                )}
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#1A1A1A] transition-colors p-1"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {formik.touched.password && formik.errors.password && (
              <p className="mt-1.5 text-[12px] text-red-500">{formik.errors.password as string}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={formik.isSubmitting}
            className="w-full rounded-md bg-[#E31E24] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:opacity-60"
          >
            {formik.isSubmitting ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F2F2F2] flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-[#E31E24] border-t-transparent" />
        </div>
      }
    >
      <AdminLoginForm />
    </Suspense>
  );
}
