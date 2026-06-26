"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import { useQueryClient } from "@tanstack/react-query";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import {
  loginInitialValues,
  loginValidationSchema,
} from "@/validations/login.validation";
import { useAuthPageSettings } from "@/hooks/api/useAuthPageSettings";
import { useCustomerLogin, useCustomerMe } from "@/hooks/api/useCustomerLogin";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

const slides = [
  {
    image: "/auth/login1.jpg",
    heading: "Modern orthodontic care designed for confident smiles.",
    subHeading: "Premium products and account access for dental professionals.",
  },
  {
    image: "/auth/login2.jpg",
    heading: "Track your treatment journey with ease and comfort.",
    subHeading: "Manage orders, quotes, and account details in one secure place.",
  }
];

export default function LoginPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showPassword, setShowPassword] = useState(false);
  const {
    data: authSettings,
    isError: isAuthSettingsError,
    isLoading: isAuthSettingsLoading,
  } = useAuthPageSettings();
  const loginMutation = useCustomerLogin();
  const { data: customer, isLoading: isCheckingCustomer } = useCustomerMe();
  const loginSettings = authSettings?.login;
  const loginSlides = (
    isAuthSettingsError
      ? slides
      : loginSettings?.slides?.filter((slide) => slide.isVisible !== false) || []
  );
  const showSlider =
    !isAuthSettingsLoading &&
    (isAuthSettingsError || loginSettings?.sliderEnabled !== false) &&
    loginSlides.length > 0;

  useEffect(() => {
    if (customer) {
      router.replace("/account");
    }
  }, [customer, router]);

  const formik = useFormik({
    initialValues: loginInitialValues,
    validationSchema: loginValidationSchema,
    onSubmit: (values, { setSubmitting }) => {
      loginMutation.mutate(values, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["customer", "me"] });
          router.push("/account");
        },
        onSettled: () => {
          setSubmitting(false);
        },
      });
    },
  });

  return (
    <main
      className={`relative grid min-h-[calc(100svh-80px)] grid-cols-1 items-center overflow-hidden bg-[#F7F7F7] lg:min-h-0 ${
        showSlider ? "lg:grid-cols-2" : ""
      }`}
    >
      {showSlider && (
      <section className="absolute inset-0 overflow-hidden lg:relative lg:inset-auto">
        <Swiper
          modules={[Autoplay, Pagination, EffectFade]}
          effect="fade"
          loop
          pagination={{ clickable: true }}
          autoplay={{
            delay: 2500,
            disableOnInteraction: false,
          }}
          breakpoints={{
            1024: {
              autoplay: {
                delay: 3500,
                disableOnInteraction: false,
              },
            },
          }}
          className="login-slider h-full w-full"
        >
          {loginSlides.map((slide) => (
            <SwiperSlide key={slide.image}>
              <div
                className="relative h-full min-h-[calc(100svh-80px)] w-full bg-cover bg-center lg:h-[calc(100vh-131.6px)] lg:min-h-0"
                style={{ backgroundImage: `url(${slide.image})` }}
              >
                <div className="absolute inset-0 bg-black/55 backdrop-blur-[1px] lg:bg-black/45 lg:backdrop-blur-none"></div>

                <div className="absolute bottom-16 left-10 hidden max-w-[520px] text-white lg:block">
                  <h2 className="text-[28px] font-semibold leading-tight">
                    {slide.heading}
                  </h2>

                  <p className="mt-3 text-[15px] leading-6 text-white/80">
                    {slide.subHeading}
                  </p>

                  <div className="mt-6 inline-flex rounded-full bg-black/35 px-4 py-2 text-[13px] backdrop-blur-md">
                    92% Satisfaction rate
                  </div>
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
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
          >
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]"
              >
                Email address
              </label>

              <input
                id="email"
                type="email"
                placeholder="Enter your email"
                autoComplete="email"
                {...formik.getFieldProps("email")}
                onChange={(event) => {
                  formik.handleChange(event);
                  if (loginMutation.isError) {
                    loginMutation.reset();
                  }
                }}
                className={`h-[46px] w-full rounded-md border bg-white/80 px-4 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
                  formik.touched.email && formik.errors.email
                    ? "border-[#E31E24]"
                    : "border-[#E0E0E0]"
                }`}
              />
              {formik.touched.email && formik.errors.email && (
                <p className="mt-1 text-[12px] text-[#E31E24]">
                  {formik.errors.email}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-[13px] font-semibold text-[#1A1A1A]"
              >
                Password
              </label>

              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  {...formik.getFieldProps("password")}
                  onChange={(event) => {
                    formik.handleChange(event);
                    if (loginMutation.isError) {
                      loginMutation.reset();
                    }
                  }}
                  className={`h-[46px] w-full rounded-md border bg-white/80 px-4 pr-10 text-[14px] text-[#1A1A1A] outline-none placeholder:text-[#9A9A9A] focus:border-[#1A1A1A] ${
                    formik.touched.password && formik.errors.password
                      ? "border-[#E31E24]"
                      : "border-[#E0E0E0]"
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
                <p className="mt-1 text-[12px] text-[#E31E24]">
                  {formik.errors.password}
                </p>
              )}
            </div>

            <div className="flex items-center text-[12.5px]">
              <label className="flex cursor-pointer select-none items-center gap-2 text-[#6B6B6B]">
                <input
                  type="checkbox"
                  {...formik.getFieldProps("rememberMe")}
                  checked={formik.values.rememberMe}
                  className="h-3.5 w-3.5 accent-[#E31E24]"
                />
                Remember me
              </label>
            </div>

            {loginMutation.isError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {loginMutation.error.message}
              </div>
            )}

            <button
              type="submit"
              disabled={
                formik.isSubmitting ||
                loginMutation.isPending ||
                isCheckingCustomer
              }
              className="w-full rounded-md bg-[#E31E24] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loginMutation.isPending || isCheckingCustomer
                ? "Please wait..."
                : "Sign In"}
            </button>
          </form>

          <p className="mt-5 text-center text-[12px] text-white/80 lg:text-[#8A8A8A]">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-medium text-[#E31E24] hover:underline"
            >
              Create account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
