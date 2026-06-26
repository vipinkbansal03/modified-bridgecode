"use client";

import Link from "next/link";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { getIn, useFormik } from "formik";
import * as Yup from "yup";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useCountries } from "@/hooks/api/useCurrencies";
import { useCustomerRegister } from "@/hooks/api/useCustomerRegister";
import {
  REGISTER_STEP_ONE_FIELDS,
  registerInitialValues,
  registerValidationSchema,
} from "@/validations/register.validation";

const accountOptions = [
  { value: "", label: "Select account type" },
  { value: "DOCTOR_RETAILER", label: "Doctor / Retailer" },
  { value: "DEALER", label: "Dealer / Wholesale Customer" },
];

const prescriptionOptions = [
  { value: "", label: "No preference" },
  { value: "MBT", label: "MBT" },
  { value: "ROTH", label: "Roth" },
  { value: "OTHER", label: "Other" },
];

const REGISTER_STEP_TWO_FIELDS = [
  "address.countryCode",
  "address.addressLine1",
  "address.city",
  "address.state",
  "address.postalCode",
] as const;

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [canVisitProfile, setCanVisitProfile] = useState(false);
  const handledSubmitCountRef = useRef(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { data: countries = [], isLoading: countriesLoading } = useCountries();
  const registerMutation = useCustomerRegister();

  function focusField(fieldName: string) {
    let attempts = 0;

    const focusWhenReady = () => {
      const field = document.querySelector<HTMLElement>(
        `[name="${fieldName}"]`,
      );

      if (field) {
        field.focus();
        field.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      attempts += 1;
      if (attempts < 5) {
        window.setTimeout(focusWhenReady, 50);
      }
    };

    window.setTimeout(focusWhenReady, 0);
  }

  const formik = useFormik({
    initialValues: registerInitialValues,
    validationSchema: registerValidationSchema,
    onSubmit: (values, { setFieldError, setFieldTouched, setSubmitting }) => {
      registerMutation.mutate(values, {
        onError: (error) => {
          if (error.message.toLowerCase().includes("email")) {
            setStep(1);
            setFieldTouched("email", true, false);
            setFieldError("email", error.message);
            focusField("email");
          }
        },
        onSettled: () => {
          setSubmitting(false);
        },
      });
    },
  });

  const countryOptions = [
    {
      value: "",
      label: countriesLoading ? "Loading countries..." : "Select country",
    },
    ...countries.map((country) => ({
      value: country.code,
      label: country.name,
    })),
  ];

  async function continueToProfile() {
    let hasError = false;
    let firstErrorField = "";

    for (const field of REGISTER_STEP_ONE_FIELDS) {
      formik.setFieldTouched(field, true, false);
      try {
        await registerValidationSchema.validateAt(field, formik.values);
        formik.setFieldError(field, undefined);
      } catch (error) {
        hasError = true;
        firstErrorField ||= field;
        if (error instanceof Yup.ValidationError) {
          formik.setFieldError(field, error.message);
        }
      }
    }

    if (!hasError) {
      setCanVisitProfile(true);
      setStep(2);
      registerMutation.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      focusField(firstErrorField);
    }
  }

  async function handleStepClick(targetStep: number) {
    registerMutation.reset();

    if (targetStep === 1) {
      setStep(1);
      return;
    }

    if (step === 1 || !canVisitProfile) {
      await continueToProfile();
      return;
    }

    setStep(2);
  }

  function fieldError(path: string) {
    return getIn(formik.errors, path) as string | undefined;
  }

  function fieldTouched(path: string) {
    return Boolean(getIn(formik.touched, path));
  }

  function handleEmailChange(event: ChangeEvent<HTMLInputElement>) {
    formik.handleChange(event);

    if (registerMutation.isError) {
      registerMutation.reset();
    }

    if (formik.errors.email === registerMutation.error?.message) {
      formik.setFieldError("email", undefined);
    }
  }

  const registrationErrorMessage = registerMutation.isError
    ? registerMutation.error.message
    : "";

  useEffect(() => {
    if (
      formik.submitCount === 0 ||
      handledSubmitCountRef.current === formik.submitCount ||
      registerMutation.isPending
    ) {
      return;
    }

    const fieldsToCheck =
      step === 1 ? REGISTER_STEP_ONE_FIELDS : REGISTER_STEP_TWO_FIELDS;
    const firstErrorField = fieldsToCheck.find((field) =>
      Boolean(getIn(formik.errors, field)),
    );

    if (firstErrorField) {
      handledSubmitCountRef.current = formik.submitCount;
      focusField(firstErrorField);
    }
  }, [
    formik.errors,
    formik.submitCount,
    registerMutation.isPending,
    step,
  ]);

  if (registerMutation.isSuccess) {
    return (
      <main className="flex min-h-[calc(100svh-80px)] items-center justify-center bg-[#F7F7F7] px-5 py-12">
        <div className="w-full max-w-[480px] rounded-2xl border border-[#E8E8E8] bg-white p-7 text-center shadow-[0_12px_35px_rgba(0,0,0,0.07)] sm:p-9">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-600">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-[26px] font-semibold text-[#1A1A1A]">
            Account created
          </h1>
          <p className="mt-2 text-[14px] leading-6 text-[#6B6B6B]">
            Your {registerMutation.data.role.name} account is ready. You can now
            continue to customer login.
          </p>
          <Link
            href="/login"
            className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#E31E24] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B]"
          >
            Go to login
            <ArrowRight size={16} />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[calc(100svh-80px)] overflow-hidden bg-[#F7F7F7] px-4 py-10 sm:px-6">
      <div
        className="absolute inset-0 bg-cover bg-center opacity-[0.08]"
        style={{ backgroundImage: "url('/auth/login2.jpg')" }}
      />
      <div className="relative mx-auto w-full max-w-[760px]">
        <div className="mb-6 text-center">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#E31E24] text-white">
            <UserPlus size={21} />
          </div>
          <h1 className="text-[26px] font-semibold text-[#1A1A1A]">
            Create customer account
          </h1>
          <p className="mt-1.5 text-[14px] text-[#6B6B6B]">
            Join Modern Orthodontics as a doctor, retailer or dealer
          </p>
        </div>

        <div className="mb-5 flex items-start justify-center">
          {[1, 2].map((item) => {
            const isLocked = item === 2 && !canVisitProfile;

            return (
              <div key={item} className="flex items-center">
                <button
                  type="button"
                  onClick={() => handleStepClick(item)}
                  disabled={isLocked}
                  aria-current={step === item ? "step" : undefined}
                  title={
                    isLocked
                      ? "Complete account details first"
                      : item === 1
                        ? "Account details"
                        : "Business and address details"
                  }
                  className={`flex flex-col items-center gap-1 text-[12px] font-medium text-[#777] transition-transform duration-200 ${
                    isLocked
                      ? "cursor-not-allowed opacity-55"
                      : "hover:scale-105 active:scale-95"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                      step >= item
                        ? "bg-[#E31E24] text-white"
                        : "border border-[#D8D8D8] bg-white text-[#8A8A8A]"
                    }`}
                  >
                    {step > item ? <Check size={15} /> : item}
                  </span>
                  <span
                    className={
                      step === item ? "text-[#1A1A1A]" : "text-[#777]"
                    }
                  >
                    {item === 1 ? "Account" : "Profile"}
                  </span>
                </button>
                {item === 1 && (
                  <div
                    className={`mt-4 h-[2px] w-16 sm:w-24 ${
                      step === 2 ? "bg-[#E31E24]" : "bg-[#D8D8D8]"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <form
          onSubmit={formik.handleSubmit}
          noValidate
          className="rounded-2xl border border-white/80 bg-white/95 p-5 shadow-[0_12px_35px_rgba(0,0,0,0.08)] backdrop-blur-xl sm:p-7"
        >
          <div className="mb-6">
            <h2 className="text-[18px] font-semibold text-[#1A1A1A]">
              {step === 1 ? "Account details" : "Business and address details"}
            </h2>
            <p className="mt-1 text-[13px] text-[#777]">
              {step === 1
                ? "Tell us who you are and create your login."
                : "Add the details used for your profile and future orders."}
            </p>
          </div>

          {step === 1 ? (
            <div className="space-y-5">
              <Select
                id="accountType"
                name="accountType"
                label="Register as"
                options={accountOptions}
                value={formik.values.accountType}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.accountType}
                touched={formik.touched.accountType}
                required
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  id="name"
                  name="name"
                  label="Full name"
                  placeholder="Your full name"
                  autoComplete="name"
                  value={formik.values.name}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.name}
                  touched={formik.touched.name}
                  required
                />
                <Input
                  id="phone"
                  name="phone"
                  label="Phone number"
                  placeholder="+91 98765 43210"
                  autoComplete="tel"
                  value={formik.values.phone}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.phone}
                  touched={formik.touched.phone}
                  required
                />
              </div>

              <Input
                id="email"
                name="email"
                type="email"
                label="Email address"
                placeholder="you@example.com"
                autoComplete="email"
                value={formik.values.email}
                onChange={handleEmailChange}
                onBlur={formik.handleBlur}
                error={formik.errors.email}
                touched={formik.touched.email}
                required
              />

              <div className="grid gap-5 sm:grid-cols-2">
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

                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    label="Confirm password"
                    placeholder="Re-enter password"
                    autoComplete="new-password"
                    className="pr-11"
                    value={formik.values.confirmPassword}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.errors.confirmPassword}
                    touched={formik.touched.confirmPassword}
                    required
                  />
                  <button
                    type="button"
                    title={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    onClick={() =>
                      setShowConfirmPassword((value) => !value)
                    }
                    className="absolute right-3 top-[34px] text-[#999] hover:text-[#1A1A1A]"
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {registrationErrorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {registrationErrorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={continueToProfile}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#E31E24] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B]"
              >
                Continue
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input
                  id="companyName"
                  name="companyName"
                  label="Company / clinic name (optional)"
                  placeholder="Business or clinic name"
                  value={formik.values.companyName}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.companyName}
                  touched={formik.touched.companyName}
                />
                <Input
                  id="website"
                  name="website"
                  type="url"
                  label="Website (optional)"
                  placeholder="https://example.com"
                  value={formik.values.website}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.website}
                  touched={formik.touched.website}
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Select
                  id="preferredPrescription"
                  name="preferredPrescription"
                  label="Preferred prescription (optional)"
                  options={prescriptionOptions}
                  value={formik.values.preferredPrescription}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.preferredPrescription}
                  touched={formik.touched.preferredPrescription}
                />
                <Select
                  id="address.countryCode"
                  name="address.countryCode"
                  label="Country"
                  options={countryOptions}
                  value={formik.values.address.countryCode}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError("address.countryCode")}
                  touched={fieldTouched("address.countryCode")}
                  disabled={countriesLoading}
                  required
                />
              </div>

              <Input
                id="address.addressLine1"
                name="address.addressLine1"
                label="Address"
                placeholder="Street address"
                autoComplete="address-line1"
                value={formik.values.address.addressLine1}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError("address.addressLine1")}
                touched={fieldTouched("address.addressLine1")}
                required
              />

              <Input
                id="address.addressLine2"
                name="address.addressLine2"
                label="Address line 2 (optional)"
                placeholder="Apartment, suite or landmark"
                autoComplete="address-line2"
                value={formik.values.address.addressLine2}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={fieldError("address.addressLine2")}
                touched={fieldTouched("address.addressLine2")}
              />

              <div className="grid gap-5 sm:grid-cols-3">
                <Input
                  id="address.city"
                  name="address.city"
                  label="City"
                  autoComplete="address-level2"
                  value={formik.values.address.city}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError("address.city")}
                  touched={fieldTouched("address.city")}
                  required
                />
                <Input
                  id="address.state"
                  name="address.state"
                  label="State"
                  autoComplete="address-level1"
                  value={formik.values.address.state}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError("address.state")}
                  touched={fieldTouched("address.state")}
                  required
                />
                <Input
                  id="address.postalCode"
                  name="address.postalCode"
                  label="Postal code"
                  autoComplete="postal-code"
                  value={formik.values.address.postalCode}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={fieldError("address.postalCode")}
                  touched={fieldTouched("address.postalCode")}
                  required
                />
              </div>

              {registrationErrorMessage && (
                <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                  {registrationErrorMessage}
                </div>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    registerMutation.reset();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-[#D8D8D8] bg-white py-3 text-[14px] font-semibold text-[#333] transition-colors hover:border-[#999]"
                >
                  <ArrowLeft size={16} />
                  Back
                </button>
                <button
                  type="submit"
                  disabled={formik.isSubmitting || registerMutation.isPending}
                  className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-md bg-[#E31E24] py-3 text-[14px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {registerMutation.isPending
                    ? "Creating account..."
                    : "Create account"}
                </button>
              </div>
            </div>
          )}
        </form>

        <p className="mt-5 text-center text-[13px] text-[#666]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#E31E24] hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
