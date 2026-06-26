"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { useAuthPageSettings } from "@/hooks/api/useAuthPageSettings";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerErrorMessage } from "@/services/customerApi";

const loginSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

const fallbackSlides = [
  {
    image: "/auth/login1.jpg",
    heading: "Modern orthodontic care designed for confident smiles.",
    subHeading: "Premium products and account access for dental professionals.",
  },
  {
    image: "/auth/login2.jpg",
    heading: "Track your treatment journey with ease and comfort.",
    subHeading: "Manage orders, quotes, and account details in one secure place.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, currentCustomer, isLoading } = useCustomerAuth();
  const [returnTo, setReturnTo] = useState("/");
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const {
    data: authSettings,
    isError: isAuthSettingsError,
    isLoading: isAuthSettingsLoading,
  } = useAuthPageSettings();

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.startsWith("/")) setReturnTo(next);
  }, []);

  useEffect(() => {
    if (!isLoading && currentCustomer) {
      window.location.assign(returnTo);
    }
  }, [currentCustomer, isLoading, returnTo]);

  const loginSettings = authSettings?.login;
  const loginSlides = isAuthSettingsError
    ? fallbackSlides
    : loginSettings?.slides?.filter((slide) => slide.isVisible !== false) || fallbackSlides;
  const showHero =
    !isAuthSettingsLoading &&
    (isAuthSettingsError || loginSettings?.sliderEnabled !== false) &&
    loginSlides.length > 0;
  const heroSlide = loginSlides[activeSlideIndex % loginSlides.length] ?? fallbackSlides[0];

  useEffect(() => {
    if (!showHero || loginSlides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveSlideIndex((index) => (index + 1) % loginSlides.length);
    }, 3500);

    return () => window.clearInterval(timer);
  }, [loginSlides.length, showHero]);

  useEffect(() => {
    setActiveSlideIndex(0);
  }, [loginSlides.length]);

  const formik = useFormik({
    initialValues: { email: "", password: "" },
    validationSchema: loginSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try {
        await login(values.email, values.password, returnTo);
      } catch (error) {
        helpers.setStatus(getCustomerErrorMessage(error, "Invalid email or password."));
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <main className="grid min-h-svh grid-cols-1 overflow-hidden bg-white lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,0.95fr)]">
      {showHero && (
        <section className="relative hidden min-h-svh overflow-hidden lg:block">
          <div
            key={heroSlide.image}
            className="relative h-full min-h-svh w-full bg-cover bg-center transition-[background-image] duration-700"
            style={{ backgroundImage: `url(${heroSlide.image})` }}
          >
            <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/75" />
            <div className="absolute left-9 top-9 flex h-10 w-10 items-center justify-center border border-white/35 bg-white/10 text-[26px] font-serif text-white backdrop-blur-sm">
              &quot;
            </div>
            <div className="absolute bottom-20 left-9 max-w-[520px] text-white">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-2 text-[12px] font-medium backdrop-blur-md">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Secure customer access
              </div>
              <p className="text-[18px] italic leading-8 text-white/95">
                “{heroSlide.subHeading}”
              </p>
              <p className="mt-5 text-[13px] font-semibold text-white">{heroSlide.heading}</p>
              <p className="mt-1 text-[12px] text-white/65">Modern Orthodontics</p>
            </div>
            {loginSlides.length > 1 && (
              <div className="absolute bottom-9 left-9 flex items-center gap-2">
                {loginSlides.map((slide, index) => (
                  <button
                    key={slide.image}
                    type="button"
                    aria-label={`Show login slide ${index + 1}`}
                    onClick={() => setActiveSlideIndex(index)}
                    className={`h-2 rounded-full transition-all ${
                      index === activeSlideIndex % loginSlides.length ? "w-7 bg-white" : "w-2 bg-white/45 hover:bg-white/75"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="relative flex min-h-svh items-center justify-center bg-white px-5 py-8 sm:px-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="absolute left-5 top-5 inline-flex h-9 items-center gap-2 rounded-md border border-[#E0E0E0] bg-white px-3 text-[13px] text-[#555] shadow-sm transition-colors hover:border-[#BBBBBB] hover:text-[#1A1A1A] sm:left-10 sm:top-8"
        >
          <ArrowLeft size={14} />
          Back
        </button>

        <div className="w-full max-w-[430px] pt-14 sm:pt-10">
          <div className="mb-8">
            <h1 className="font-serif text-[34px] font-semibold leading-tight text-[#111]">
              {loginSettings?.heading || "Customer Login"}
            </h1>
            <p className="mt-2 text-[14px] text-[#8A8A8A]">
              {loginSettings?.subHeading || "Login to access your account"}
            </p>
          </div>

          <form
            onSubmit={formik.handleSubmit}
            className="space-y-5"
            noValidate
          >
            <div>
              <label htmlFor="email" className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                className={`h-[50px] w-full rounded-md border bg-[#EEF4FF] px-4 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
                  formik.touched.email && formik.errors.email ? "border-[#E31E24]" : "border-[#E0E0E0]"
                }`}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="mt-1 text-[12px] text-[#E31E24]">{formik.errors.email}</p>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="block text-[13px] font-semibold text-[#1A1A1A]">
                  Password
                </label>
                <Link href="/forgot-password" className="text-[12px] font-medium text-[#111] underline underline-offset-2">
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  className={`h-[50px] w-full rounded-md border bg-[#EEF4FF] px-4 pr-10 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
                    formik.touched.password && formik.errors.password ? "border-[#E31E24]" : "border-[#E0E0E0]"
                  }`}
                />
                <button
                  type="button"
                  title={showPassword ? "Hide Password" : "Show Password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#1A1A1A]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {formik.touched.password && formik.errors.password && (
                <p className="mt-1 text-[12px] text-[#E31E24]">{formik.errors.password}</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-[12px] text-[#8A8A8A]">
              <input type="checkbox" className="h-4 w-4 rounded border-[#D1D5DB]" />
              I agree to the terms and conditions.
            </label>

            {formik.status && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {formik.status}
              </div>
            )}

            <button
              type="submit"
              disabled={formik.isSubmitting || isLoading}
              className="h-12 w-full rounded-md bg-[#E31E24] text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formik.isSubmitting || isLoading ? "Please wait..." : "Sign In"}
            </button>
          </form>

          <p className="mt-6 text-center text-[13px] text-[#8A8A8A]">
            Don&apos;t have an account?{" "}
            <Link href={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-[#E31E24] hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
