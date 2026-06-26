"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Eye, EyeOff, Lock } from "lucide-react";
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
    <main
      className={`relative grid min-h-[calc(100svh-80px)] grid-cols-1 items-center overflow-hidden bg-[#F7F7F7] lg:min-h-0 ${
        showHero ? "lg:grid-cols-2" : ""
      }`}
    >
      {showHero && (
        <section className="absolute inset-0 overflow-hidden lg:relative lg:inset-auto">
          <div
            key={heroSlide.image}
            className="relative h-full min-h-[calc(100svh-80px)] w-full bg-cover bg-center transition-[background-image] duration-700 lg:h-[calc(100vh-131.6px)] lg:min-h-0"
            style={{ backgroundImage: `url(${heroSlide.image})` }}
          >
            <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] lg:bg-black/45 lg:backdrop-blur-none" />
            <div className="absolute bottom-16 left-10 hidden max-w-[520px] text-white lg:block">
              <h2 className="text-[28px] font-semibold leading-tight">{heroSlide.heading}</h2>
              <p className="mt-3 text-[15px] leading-6 text-white/80">{heroSlide.subHeading}</p>
              <div className="mt-6 inline-flex rounded-full bg-black/35 px-4 py-2 text-[13px] backdrop-blur-md">
                Secure customer access
              </div>
            </div>
            {loginSlides.length > 1 && (
              <div className="absolute bottom-7 left-10 hidden items-center gap-2 lg:flex">
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

      <section className="relative z-10 flex items-center justify-center px-5 py-10 sm:px-8 lg:py-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24] text-white">
              <Lock size={22} />
            </div>
            <h1 className="text-[26px] font-semibold text-white lg:text-[#1A1A1A]">
              {loginSettings?.heading || "Customer Login"}
            </h1>
            <p className="mt-1.5 text-[14px] text-white/75 lg:text-[#6B6B6B]">
              {loginSettings?.subHeading || "Login to access your account"}
            </p>
          </div>

          <form
            onSubmit={formik.handleSubmit}
            className="space-y-4 rounded-2xl border border-white/80 bg-white/90 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.09)] backdrop-blur-xl sm:p-6 lg:border-[#E8E8E8] lg:bg-white/80 lg:shadow-[0_12px_35px_rgba(0,0,0,0.07)]"
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
                className={`h-[46px] w-full rounded-md border bg-white/80 px-4 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
                  formik.touched.email && formik.errors.email ? "border-[#E31E24]" : "border-[#E0E0E0]"
                }`}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="mt-1 text-[12px] text-[#E31E24]">{formik.errors.email}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]">
                Password
              </label>
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
                  className={`h-[46px] w-full rounded-md border bg-white/80 px-4 pr-10 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
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

            <div className="flex items-center justify-between gap-3 text-[12.5px]">
              <Link href="/forgot-password" className="font-medium text-[#6B6B6B] hover:text-[#E31E24]">
                Forgot password?
              </Link>
              <Link href={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-[#E31E24] hover:underline">
                Create account
              </Link>
            </div>

            {formik.status && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {formik.status}
              </div>
            )}

            <button
              type="submit"
              disabled={formik.isSubmitting || isLoading}
              className="w-full rounded-md bg-[#E31E24] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formik.isSubmitting || isLoading ? "Please wait..." : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-white/80 lg:text-[#8A8A8A]">
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
