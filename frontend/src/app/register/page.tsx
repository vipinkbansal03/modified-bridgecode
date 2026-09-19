"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  Smartphone,
  User,
} from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerErrorMessage } from "@/services/customerApi";
import PhoneInputField from "@/components/ui/PhoneInput";
import OtpVerificationModal from "@/components/auth/OtpVerificationModal";
import { isValidPhoneNumber } from "react-phone-number-input";
import { useCountries } from "@/hooks/api/useCurrencies";
import { worldCountries } from "@/data/world-countries";
import { apiClient } from "@/lib/apiClient";

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

const registerSchema = Yup.object({
  customerType: Yup.string()
    .oneOf(["DOCTOR", "DEALER", "STUDENT"])
    .required("Choose account type"),
  name: Yup.string().trim().required("Name is required"),
  companyName: Yup.string()
    .trim()
    .when("customerType", {
      is: "DEALER",
      then: (schema) => schema.required("Company / Business name is required"),
      otherwise: (schema) => schema.optional(),
    }),
  email: Yup.string()
    .trim()
    .email("Please enter a valid email address")
    .required("Email is required"),
  mobile: Yup.string()
    .trim()
    .required("Mobile number is required")
    .test("is-valid-phone", "Please enter a valid mobile phone number", (value) => {
      if (!value) return false;
      return isValidPhoneNumber(value);
    }),
  address: Yup.string().trim().optional(),
  addressLine2: Yup.string().trim().optional(),
  city: Yup.string().trim().optional(),
  state: Yup.string().trim().optional(),
  country: Yup.string().trim().required("Country is required"),
  zipcode: Yup.string().trim().optional(),
  website: Yup.string()
    .trim()
    .test("is-valid-url", "Please enter a valid website URL (e.g. https://example.com)", (value) => {
      if (!value || value.trim() === "") return true;
      try {
        const urlToTest = value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
        const parsed = new URL(urlToTest);
        return Boolean(parsed.hostname && parsed.hostname.includes("."));
      } catch {
        return false;
      }
    })
    .optional(),
  taxId: Yup.string()
    .trim()
    .when("customerType", {
      is: "DEALER",
      then: (schema) =>
        schema
          .required("GSTIN / Tax ID is required for dealers")
          .test("is-valid-dealer-tax-id", function (value) {
            if (!value || value.trim() === "") {
              return this.createError({ message: "GSTIN / Tax ID is required for dealers" });
            }
            const { taxIdType, country } = this.parent;
            const type = taxIdType || (country === "India" || country === "IN" ? "GSTIN" : "TAX_ID");
            if (type === "GSTIN") {
              const clean = value.trim().toUpperCase();
              if (!GSTIN_REGEX.test(clean)) {
                return this.createError({ message: "Invalid GSTIN format (e.g. 27AAAAA1111A1Z5)" });
              }
            } else if (value.trim().length < 3) {
              return this.createError({ message: "Please enter a valid Tax ID / VAT number" });
            }
            return true;
          }),
      otherwise: (schema) =>
        schema.nullable().test("is-valid-tax-id", function (value) {
          if (!value || value.trim() === "") return true;
          const { taxIdType, country } = this.parent;
          const type = taxIdType || (country === "India" || country === "IN" ? "GSTIN" : "TAX_ID");
          if (type === "GSTIN") {
            const clean = value.trim().toUpperCase();
            if (!GSTIN_REGEX.test(clean)) {
              return this.createError({ message: "Invalid GSTIN format (e.g. 27AAAAA1111A1Z5)" });
            }
          }
          return true;
        }),
    }),
  taxIdType: Yup.string().trim().nullable(),
  password: Yup.string()
    .min(8, "Password must be at least 8 characters")
    .required("Password is required"),
  confirmPassword: Yup.string()
    .oneOf([Yup.ref("password")], "Passwords must match")
    .required("Confirm password is required"),
  preferredPrescription: Yup.string().oneOf(["MBT", "ROTH", "OTHER"]).optional(),
  preferredPrescriptionOther: Yup.string().trim().optional(),
  preferredSlot: Yup.string().oneOf(["022", "018"]).optional(),
  currentPractice: Yup.string().oneOf(["STUDENT", "ORTHODONTIST", "OTHER"]).optional(),
  currentPracticeOther: Yup.string().trim().optional(),
  usingModernProducts: Yup.string().oneOf(["YES", "NO"]).optional(),
  termsAccepted: Yup.boolean().oneOf(
    [true],
    "You must agree to the terms and conditions",
  ).required("You must agree to the terms and conditions"),
  subscribeNewsletter: Yup.boolean().oneOf(
    [true],
    "You must agree to receive product updates and promotions",
  ).required("You must agree to receive product updates and promotions"),
});

type RegisterFormValues = Yup.InferType<typeof registerSchema>;
type CustomerType = "DOCTOR" | "DEALER" | "STUDENT";

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? fullName.trim(),
    lastName: parts.slice(1).join(" ") || "-",
  };
}

function FieldLabel({
  label,
  required,
  optional,
}: {
  label: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pb-1 text-[12px] font-semibold text-[#2D3748]">
      <span>{label}</span>
      {required && (
        <span className="text-[11px] font-medium text-[#E31E24]">
          (Mandatory)
        </span>
      )}
      {optional && (
        <span className="text-[11px] font-normal text-[#718096]">
          (Optional)
        </span>
      )}
    </div>
  );
}

function IconInput({
  label,
  required,
  optional,
  icon,
  error,
  touched,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  required?: boolean;
  optional?: boolean;
  icon?: React.ReactNode;
  error?: string;
  touched?: boolean;
}) {
  const showError = Boolean(touched && error);
  return (
    <div className="w-full">
      {label && (
        <FieldLabel
          label={label}
          required={required}
          optional={optional}
        />
      )}
      <div
        className={`flex h-10 sm:h-9 overflow-hidden rounded-md border bg-[#EEF4FF] transition-colors ${
          showError
            ? "border-[#E31E24]"
            : "border-[#E0E0E0] focus-within:border-[#E31E24]"
        } ${className}`}
      >
        {icon && (
          <span className="flex w-10 shrink-0 items-center justify-center border-r border-[#E0E0E0] bg-white/65 text-[#6B6B6B]">
            {icon}
          </span>
        )}
        <input
          {...props}
          className="min-w-0 flex-1 bg-transparent px-3 text-[16px] sm:text-[12.5px] text-[#1A1A1A] outline-none placeholder:text-[#8A8A8A]"
        />
      </div>
      {showError && (
        <p className="mt-0.5 text-[11px] text-[#E31E24]">{error}</p>
      )}
    </div>
  );
}

function RadioOption({
  name,
  value,
  checked,
  label,
  onChange,
}: {
  name: string;
  value: string;
  checked: boolean;
  label: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <label className="inline-flex items-center gap-2 text-[12.5px] sm:text-[12px] font-medium text-[#1A1A1A] cursor-pointer select-none">
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 sm:h-3.5 sm:w-3.5 accent-[#E31E24] cursor-pointer shrink-0"
      />
      {label}
    </label>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const { initiateRegister, verifyRegisterOtp, resendOtp } = useCustomerAuth();
  const [returnTo, setReturnTo] = useState("/");
  const [otpSession, setOtpSession] = useState<{
    verificationId: string;
    maskedPhone: string;
    cooldownSeconds?: number;
    debugOtp?: string;
  } | null>(null);

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.startsWith("/")) {
      setReturnTo(next);
    }
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { data: dbCountries = [] } = useCountries();
  const activeCountries = dbCountries.length > 0
    ? dbCountries.filter((c) => c.status?.toUpperCase() === "ACTIVE")
    : worldCountries;

  const [phoneCountry, setPhoneCountry] = useState<string>("IN");

  const formik = useFormik<RegisterFormValues>({
    initialValues: {
      customerType: "DOCTOR",
      name: "",
      companyName: "",
      email: "",
      mobile: "",
      address: "",
      addressLine2: "",
      city: "",
      state: "",
      country: "India",
      zipcode: "",
      website: "",
      taxId: "",
      taxIdType: "GSTIN",
      password: "",
      confirmPassword: "",
      preferredPrescription: "MBT",
      preferredPrescriptionOther: "",
      preferredSlot: "022",
      currentPractice: "ORTHODONTIST",
      currentPracticeOther: "",
      usingModernProducts: "NO",
      termsAccepted: false,
      subscribeNewsletter: false,
    },
    validationSchema: registerSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try { 
        const { firstName, lastName } = splitName(values.name);
        const result = await initiateRegister({
          firstName,
          lastName,
          email: values.email,
          password: values.password,
          phone: values.mobile,
          customerType: values.customerType as CustomerType,
          companyName: values.companyName || undefined,
          website: values.website || undefined,
          addressLine1: values.address || undefined,
          addressLine2: values.addressLine2 || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          postalCode: values.zipcode || undefined,
          country: values.country,
          preferredPrescription: (values.preferredPrescription as
            | "MBT"
            | "ROTH"
            | "OTHER") || undefined,
          preferredPrescriptionOther: values.preferredPrescriptionOther || undefined,
          preferredSlot: (values.preferredSlot as "022" | "018") || undefined,
          currentPractice: values.customerType === "STUDENT" ? "STUDENT" : (values.currentPractice as
            | "STUDENT"
            | "ORTHODONTIST"
            | "OTHER") || undefined,
          currentPracticeOther: values.currentPracticeOther || undefined,
          usingModernProducts: values.usingModernProducts === "YES",
          taxId: values.taxId || undefined,
          taxIdType: values.taxIdType || undefined,
        });

        if (result?.requiresOtp) {
          setOtpSession({
            verificationId: result.verificationId,
            maskedPhone: result.maskedPhone,
            cooldownSeconds: result.cooldownSeconds,
            debugOtp: result.debugOtp,
          });
        }
      } catch (error) {
        helpers.setStatus(
          getCustomerErrorMessage(error, "Registration failed. Please check your information."),
        );
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  const handleVerifyOtpSuccess = async (otp: string) => {
    if (!otpSession) return;
    await verifyRegisterOtp(otpSession.verificationId, otp, returnTo);
    if (formik.values.subscribeNewsletter) {
      localStorage.setItem("newsletter_subscribed", "true");
      localStorage.removeItem("show_newsletter_signup_modal_once");
      try {
        await apiClient.post("/newsletter/subscribe", { email: formik.values.email });
      } catch (subscribeErr) {
        console.error("Newsletter registration subscribe error:", subscribeErr);
      }
    } else {
      localStorage.setItem("show_newsletter_signup_modal_once", "true");
    }
    setOtpSession(null);
  };

  useEffect(() => {
    const found = activeCountries.find((c) => c.name === formik.values.country);
    if (found?.code) {
      setPhoneCountry(found.code.toUpperCase());
    }
  }, [formik.values.country, activeCountries]);

  // Auto-populate location from Pincode / Postal Code (Item 6)
  useEffect(() => {
    const pin = formik.values.zipcode?.trim();
    if (!pin) return;

    const timer = setTimeout(async () => {
      // 1. If Indian 6-digit Pincode
      if (/^\d{6}$/.test(pin)) {
        try {
          const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
          const data = await res.json();
          if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice?.[0]) {
            const po = data[0].PostOffice[0];
            const city = po.District || po.Block || po.Circle;
            const state = po.State;
            const country = po.Country || "India";

            if (city) {
              formik.setFieldValue("city", city);
            }
            if (state) {
              formik.setFieldValue("state", state);
            }
            if (country) {
              const matchedCountry = activeCountries.find(
                (c) => c.name.toLowerCase() === country.toLowerCase() || c.code === "IN"
              );
              if (matchedCountry) {
                formik.setFieldValue("country", matchedCountry.name);
              }
            }
          }
        } catch (e) {
          // ignore lookup errors
        }
      } else if (
        /^\d{5}(-\d{4})?$/.test(pin) &&
        (formik.values.country === "United States" || formik.values.country === "US")
      ) {
        // 2. US Zipcode lookup
        try {
          const cleanZip = pin.split("-")[0];
          const res = await fetch(`https://api.zippopotam.us/us/${cleanZip}`);
          if (res.ok) {
            const data = await res.json();
            if (data.places && data.places[0]) {
              const place = data.places[0];
              if (place["place name"]) {
                formik.setFieldValue("city", place["place name"]);
              }
              if (place["state"]) {
                formik.setFieldValue("state", place["state"]);
              }
            }
          }
        } catch (e) {
          // ignore lookup errors
        }
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [formik.values.zipcode, activeCountries, formik.values.country]);

  // Auto-populate state/pincode from City if Pincode is not yet filled (Item 6)
  useEffect(() => {
    const city = formik.values.city?.trim();
    if (!city || city.length < 3 || formik.values.zipcode?.trim()) return;

    const timer = setTimeout(async () => {
      if (formik.values.country === "India" || !formik.values.country) {
        try {
          const res = await fetch(`https://api.postalpincode.in/postoffice/${encodeURIComponent(city)}`);
          const data = await res.json();
          if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice?.[0]) {
            const po = data[0].PostOffice[0];
            if (po.State && !formik.values.state) {
              formik.setFieldValue("state", po.State);
            }
            if (po.Pincode && !formik.values.zipcode) {
              formik.setFieldValue("zipcode", po.Pincode);
            }
          }
        } catch (e) {
          // ignore lookup errors
        }
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [formik.values.city, formik.values.country, formik.values.zipcode, formik.values.state]);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.3fr)]">
      <section className="sticky top-0 hidden h-screen w-full self-start overflow-hidden lg:block">
        <div
          className="absolute inset-0 h-full w-full bg-cover bg-center"
          style={{ backgroundImage: "url('/auth/login2.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/35 to-black/75" />
        <div className="absolute bottom-16 left-8 right-8 max-w-[500px] text-white">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-black/35 px-4 py-1.5 text-[12px] font-medium backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            Fast account setup
          </div>
          <p className="text-[17px] xl:text-[18px] italic leading-relaxed text-white/95">
            &quot;Create your customer profile once, then order, quote, and
            manage purchases from one place.&quot;
          </p>
          <p className="mt-4 text-[13px] font-semibold text-white">
            Modern Orthodontics
          </p>
          <p className="mt-0.5 text-[12px] text-white/65">B2B customer portal</p>
        </div>
      </section>

      <section className="relative flex min-h-screen min-h-[100dvh] w-full items-start justify-center bg-white px-4 pt-6 pb-12 sm:px-8 sm:py-10 md:px-10 lg:px-12">
        <div className="w-full max-w-[620px]">
          <div className="mb-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <h1 className="text-[24px] sm:text-[28px] lg:text-[30px] font-semibold leading-tight text-[#111]">
                Create customer account
              </h1>
              <p className="mt-1 text-[12.5px] sm:text-[13px] text-[#8A8A8A] leading-normal">
                Register as a doctor, dealer, or student to access the Modern
                Orthodontics portal.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex h-8 self-start shrink-0 items-center gap-1.5 rounded-md border border-[#E0E0E0] bg-white px-3 text-[12px] text-[#555] shadow-2xs transition-colors hover:border-[#BBBBBB] hover:text-[#1A1A1A]"
            >
              <ArrowLeft size={13} />
              Back
            </button>
          </div>

          <form
            onSubmit={formik.handleSubmit}
            noValidate
            className="space-y-3"
          >
            {formik.status && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                {formik.status}
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 sm:gap-6 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-2.5 text-[13px]">
              <span className="font-semibold text-[#1A1A1A] text-[12.5px] sm:text-[13px]">Register as</span>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                <RadioOption
                  name="customerType"
                  value="DOCTOR"
                  label="Doctor"
                  checked={formik.values.customerType === "DOCTOR"}
                  onChange={(e) => {
                    formik.handleChange(e);
                    if (formik.values.currentPractice === "STUDENT") {
                      formik.setFieldValue("currentPractice", "ORTHODONTIST");
                    }
                  }}
                />
                <RadioOption
                  name="customerType"
                  value="DEALER"
                  label="Dealer"
                  checked={formik.values.customerType === "DEALER"}
                  onChange={formik.handleChange}
                />
                <RadioOption
                  name="customerType"
                  value="STUDENT"
                  label="Student"
                  checked={formik.values.customerType === "STUDENT"}
                  onChange={(e) => {
                    formik.handleChange(e);
                    formik.setFieldValue("currentPractice", "STUDENT");
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <IconInput
                label={formik.values.customerType === "DEALER" ? "Contact Person Name" : "Full Name"}
                required
                icon={<User size={14} />}
                name="name"
                placeholder="e.g. John Doe"
                value={formik.values.name}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.name}
                touched={formik.touched.name}
              />
              <IconInput
                label={
                  formik.values.customerType === "DEALER"
                    ? "Business Name"
                    : formik.values.customerType === "STUDENT"
                    ? "College / Institution"
                    : "Clinic / Hospital Name"
                }
                required={formik.values.customerType === "DEALER"}
                optional={formik.values.customerType !== "DEALER"}
                icon={<Building2 size={14} />}
                name="companyName"
                placeholder={
                  formik.values.customerType === "DEALER"
                    ? "Enter business name"
                    : formik.values.customerType === "STUDENT"
                    ? "Enter institution name"
                    : "Enter clinic / hospital name"
                }
                value={formik.values.companyName}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.companyName}
                touched={formik.touched.companyName}
              />
              <IconInput
                label="Email Address"
                required
                icon={<AtSign size={14} />}
                name="email"
                type="email"
                placeholder="e.g. doctor@example.com"
                value={formik.values.email}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.email}
                touched={formik.touched.email}
              />
              <div>
                <FieldLabel label="Mobile Number" required />
                <PhoneInputField
                  value={formik.values.mobile}
                  onChange={(value) =>
                    formik.setFieldValue("mobile", value ?? "")
                  }
                  onBlur={() => formik.setFieldTouched("mobile", true)}
                  error={formik.errors.mobile}
                  touched={formik.touched.mobile}
                  defaultCountry={phoneCountry as any}
                  placeholder="Enter mobile number"
                  key={phoneCountry}
                />
              </div>
              <IconInput
                label="Address Line 1"
                optional
                icon={<MapPin size={14} />}
                name="address"
                placeholder="Street address, P.O. box"
                value={formik.values.address}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.address}
                touched={formik.touched.address}
              />
              <IconInput
                label="Address Line 2"
                optional
                icon={<MapPin size={14} />}
                name="addressLine2"
                placeholder="Apartment, suite, unit, floor"
                value={formik.values.addressLine2}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.addressLine2}
                touched={formik.touched.addressLine2}
              />
              <IconInput
                label="City"
                optional
                icon={<MapPin size={14} />}
                name="city"
                placeholder="City name"
                value={formik.values.city}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.city}
                touched={formik.touched.city}
              />
              <IconInput
                label="State / Province"
                optional
                icon={<MapPin size={14} />}
                name="state"
                placeholder="State name"
                value={formik.values.state}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.state}
                touched={formik.touched.state}
              />
              <div>
                <FieldLabel label="Country" required />
                <div className="flex h-10 sm:h-9 overflow-hidden rounded-md border border-[#E0E0E0] bg-[#EEF4FF] transition-colors focus-within:border-[#E31E24]">
                  <span className="flex w-10 shrink-0 items-center justify-center border-r border-[#E0E0E0] bg-white/65 text-[#6B6B6B]">
                    <MapPin size={14} />
                  </span>
                  <select
                    name="country"
                    value={formik.values.country}
                    onChange={(e) => {
                      formik.handleChange(e);
                      const selectedName = e.target.value;
                      const found = activeCountries.find((c) => c.name === selectedName);
                      if (found?.code) {
                        setPhoneCountry(found.code.toUpperCase() as any);
                      }
                    }}
                    onBlur={formik.handleBlur}
                    className="min-w-0 flex-1 bg-transparent px-3 text-[16px] sm:text-[12.5px] text-[#1A1A1A] outline-none cursor-pointer"
                  >
                    {activeCountries.map((c) => (
                      <option key={c.code || c.name} value={c.name}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <IconInput
                label="Pincode / Postal Code"
                optional
                icon={<MapPin size={14} />}
                name="zipcode"
                placeholder="e.g. 110001 or 90210"
                value={formik.values.zipcode}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.zipcode}
                touched={formik.touched.zipcode}
              />
              <IconInput
                label="Website URL"
                optional
                icon={<AtSign size={14} />}
                name="website"
                placeholder="https://example.com"
                value={formik.values.website}
                onChange={formik.handleChange}
                onBlur={formik.handleBlur}
                error={formik.errors.website}
                touched={formik.touched.website}
              />
              <div>
                <FieldLabel
                  label={formik.values.taxIdType === "GSTIN" ? "GSTIN / Tax ID" : "Tax ID / VAT"}
                  required={formik.values.customerType === "DEALER"}
                  optional={formik.values.customerType !== "DEALER"}
                />
                <div
                  className={`flex h-10 sm:h-9 overflow-hidden rounded-md border bg-[#EEF4FF] transition-colors ${
                    Boolean(formik.touched.taxId && formik.errors.taxId)
                      ? "border-[#E31E24]"
                      : "border-[#E0E0E0] focus-within:border-[#E31E24]"
                  }`}
                >
                  <select
                    name="taxIdType"
                    value={formik.values.taxIdType || "GSTIN"}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className="bg-transparent border-r border-[#E0E0E0] px-2 text-[13px] sm:text-[12px] text-[#6B6B6B] outline-none cursor-pointer shrink-0"
                  >
                    <option value="GSTIN">GSTIN (IN)</option>
                    <option value="VAT">VAT ID (EU)</option>
                    <option value="EIN">EIN (US)</option>
                    <option value="TAX_ID">Tax ID</option>
                  </select>
                  <input
                    type="text"
                    name="taxId"
                    placeholder={
                      formik.values.taxIdType === "GSTIN"
                        ? "e.g. 27AAAAA1111A1Z5"
                        : "Tax ID / VAT number"
                    }
                    value={formik.values.taxId || ""}
                    onChange={(e) => {
                      const val =
                        formik.values.taxIdType === "GSTIN"
                          ? e.target.value.toUpperCase()
                          : e.target.value;
                      formik.setFieldValue("taxId", val);
                    }}
                    onBlur={formik.handleBlur}
                    className="min-w-0 flex-1 bg-transparent px-3 text-[16px] sm:text-[12.5px] text-[#1A1A1A] outline-none placeholder:text-[#8A8A8A]"
                  />
                </div>
                {Boolean(formik.touched.taxId && formik.errors.taxId) && (
                  <p className="mt-0.5 text-[11px] text-[#E31E24]">{formik.errors.taxId}</p>
                )}
              </div>
              <div className="relative">
                <IconInput
                  label="Password"
                  required
                  icon={<KeyRound size={14} />}
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 8 characters"
                  value={formik.values.password}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.password}
                  touched={formik.touched.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-[29px] sm:top-[27px] text-[#8A8A8A] hover:text-[#1A1A1A]"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div className="relative">
                <IconInput
                  label="Confirm Password"
                  required
                  icon={<KeyRound size={14} />}
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter password"
                  value={formik.values.confirmPassword}
                  onChange={formik.handleChange}
                  onBlur={formik.handleBlur}
                  error={formik.errors.confirmPassword}
                  touched={formik.touched.confirmPassword}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  className="absolute right-3 top-[29px] sm:top-[27px] text-[#8A8A8A] hover:text-[#1A1A1A]"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={14} />
                  ) : (
                    <Eye size={14} />
                  )}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 items-start pt-1">
              {/* Preferred Prescription */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#1A1A1A]">
                  <span>Preferred prescription</span>
                  <span className="text-[11px] font-normal text-[#718096]">(Optional)</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <RadioOption
                    name="preferredPrescription"
                    value="MBT"
                    label="MBT"
                    checked={formik.values.preferredPrescription === "MBT"}
                    onChange={formik.handleChange}
                  />
                  <RadioOption
                    name="preferredPrescription"
                    value="ROTH"
                    label="ROTH"
                    checked={formik.values.preferredPrescription === "ROTH"}
                    onChange={formik.handleChange}
                  />
                  <RadioOption
                    name="preferredPrescription"
                    value="OTHER"
                    label="Other"
                    checked={formik.values.preferredPrescription === "OTHER"}
                    onChange={formik.handleChange}
                  />
                </div>

                {formik.values.preferredPrescription === "OTHER" && (
                  <input
                    name="preferredPrescriptionOther"
                    placeholder="Specify other prescription"
                    value={formik.values.preferredPrescriptionOther}
                    onChange={formik.handleChange}
                    className="mt-2.5 h-10 sm:h-9 w-full rounded-md border border-[#E0E0E0] bg-white px-3 text-[16px] sm:text-[12.5px] outline-none transition-colors placeholder:text-[#9A9A9A] focus:border-[#E31E24]"
                    autoFocus
                  />
                )}
              </div>

              {/* Preferred Slot */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#1A1A1A]">
                  <span>Preferred slot</span>
                  <span className="text-[11px] font-normal text-[#718096]">(Optional)</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <RadioOption
                    name="preferredSlot"
                    value="022"
                    label="Slot: 022"
                    checked={formik.values.preferredSlot === "022"}
                    onChange={formik.handleChange}
                  />
                  <RadioOption
                    name="preferredSlot"
                    value="018"
                    label="Slot: 018"
                    checked={formik.values.preferredSlot === "018"}
                    onChange={formik.handleChange}
                  />
                </div>
              </div>

              {/* Current Practice / Business */}
              {formik.values.customerType !== "STUDENT" && (
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#1A1A1A]">
                    <span>{formik.values.customerType === "DEALER" ? "Current practice / business" : "Current practice"}</span>
                    <span className="text-[11px] font-normal text-[#718096]">(Optional)</span>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <RadioOption
                      name="currentPractice"
                      value="ORTHODONTIST"
                      label={formik.values.customerType === "DEALER" ? "Dealer / Distributor" : "Orthodontist"}
                      checked={formik.values.currentPractice === "ORTHODONTIST"}
                      onChange={formik.handleChange}
                    />
                    <RadioOption
                      name="currentPractice"
                      value="OTHER"
                      label="Other"
                      checked={formik.values.currentPractice === "OTHER"}
                      onChange={formik.handleChange}
                    />
                  </div>

                  {formik.values.currentPractice === "OTHER" && (
                    <input
                      name="currentPracticeOther"
                      placeholder="Specify other practice / business"
                      value={formik.values.currentPracticeOther}
                      onChange={formik.handleChange}
                      className="mt-2.5 h-10 sm:h-9 w-full rounded-md border border-[#E0E0E0] bg-white px-3 text-[16px] sm:text-[12.5px] outline-none transition-colors placeholder:text-[#9A9A9A] focus:border-[#E31E24]"
                    />
                  )}
                </div>
              )}

              {/* Using Modern Products */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <div className="mb-2 flex items-center justify-between text-[12px] font-semibold text-[#1A1A1A]">
                  <span>Already using Modern products?</span>
                  <span className="text-[11px] font-normal text-[#718096]">(Optional)</span>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  <RadioOption
                    name="usingModernProducts"
                    value="YES"
                    label="Yes"
                    checked={formik.values.usingModernProducts === "YES"}
                    onChange={formik.handleChange}
                  />
                  <RadioOption
                    name="usingModernProducts"
                    value="NO"
                    label="No"
                    checked={formik.values.usingModernProducts === "NO"}
                    onChange={formik.handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <div>
                <label className="flex items-start gap-2.5 text-[12.5px] text-[#1A1A1A] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="subscribeNewsletter"
                    checked={formik.values.subscribeNewsletter}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[#E31E24] cursor-pointer"
                  />
                  <span className="leading-snug">
                    I agree to receive product updates, promotions, and news.{" "}
                    <span className="text-[11px] font-semibold text-[#E31E24]">
                      (Mandatory)
                    </span>
                  </span>
                </label>
                {formik.touched.subscribeNewsletter && formik.errors.subscribeNewsletter && (
                  <p className="ml-6.5 mt-0.5 text-[11.5px] text-[#E31E24]">
                    {formik.errors.subscribeNewsletter}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1">
                <div className="min-w-0 flex-1">
                  <label className="flex items-start gap-2.5 text-[12.5px] text-[#1A1A1A] cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="termsAccepted"
                      checked={formik.values.termsAccepted}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#E31E24] cursor-pointer"
                    />
                    <span className="leading-snug">
                      I have read and agree to the{" "}
                      <Link
                        href="/terms-and-conditions"
                        className="text-[#E31E24] hover:underline font-medium"
                      >
                        Terms and Conditions
                      </Link>
                      .{" "}
                      <span className="text-[11px] font-semibold text-[#E31E24]">
                        (Mandatory)
                      </span>
                    </span>
                  </label>
                  {formik.touched.termsAccepted && formik.errors.termsAccepted && (
                    <p className="ml-6.5 mt-0.5 text-[11.5px] text-[#E31E24]">
                      {formik.errors.termsAccepted}
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={formik.isSubmitting}
                  className="inline-flex h-11 sm:h-10 w-full sm:w-auto sm:min-w-[200px] shrink-0 items-center justify-center gap-2 rounded-md bg-[#E31E24] px-6 text-[13.5px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60 shadow-xs"
                >
                  <KeyRound size={15} />
                  {formik.isSubmitting ? "REGISTERING..." : "REGISTER"}
                </button>
              </div>
            </div>

            <p className="pt-2 text-center text-[12.5px] text-[#8A8A8A]">
              Already have an account?{" "}
              <Link
                href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
                className="font-semibold text-[#E31E24] hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </section>

      {otpSession && (
        <OtpVerificationModal
          open={!!otpSession}
          onClose={() => setOtpSession(null)}
          maskedPhone={otpSession.maskedPhone}
          debugOtp={otpSession.debugOtp}
          initialCooldown={otpSession.cooldownSeconds || 60}
          title="Verify Your Mobile Number"
          subtitle="Please enter the 6-digit verification code sent to your mobile number to complete registration."
          onVerify={handleVerifyOtpSuccess}
          onResend={async () => {
            const res = await resendOtp(otpSession.verificationId);
            return res;
          }}
        />
      )}
    </main>
  );
}
