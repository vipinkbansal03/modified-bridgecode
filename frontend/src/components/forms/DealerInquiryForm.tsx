"use client";

import { useFormik } from "formik";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useDealerInquiry } from "@/hooks/api/useDealerInquiry";
import { BUSINESS_TYPE_OPTIONS, dealerInitialValues, dealerValidationSchema } from "@/validations/dealer.validation";

export function DealerInquiryForm() {
  const { mutate, isPending, isSuccess, isError, reset } = useDealerInquiry();

  const formik = useFormik({
    initialValues: dealerInitialValues,
    validationSchema: dealerValidationSchema,
    onSubmit: (values, helpers) => {
      mutate(values, { onSuccess: () => helpers.resetForm() });
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="companyName"
          name="companyName"
          label="Company Name"
          placeholder="Clinic / dealership name"
          value={formik.values.companyName}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.companyName}
          touched={formik.touched.companyName}
        />
        <Input
          id="contactPerson"
          name="contactPerson"
          label="Contact Person"
          placeholder="Your full name"
          value={formik.values.contactPerson}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.contactPerson}
          touched={formik.touched.contactPerson}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@dealership.com"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.email}
          touched={formik.touched.email}
        />
        <Input
          id="phone"
          name="phone"
          label="Phone"
          placeholder="+91 98765 43210"
          value={formik.values.phone}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.phone}
          touched={formik.touched.phone}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="gstNumber"
          name="gstNumber"
          label="GST Number (optional)"
          placeholder="22AAAAA0000A1Z5"
          value={formik.values.gstNumber}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.gstNumber}
          touched={formik.touched.gstNumber}
        />
        <Select
          id="businessType"
          name="businessType"
          label="Business Type"
          options={BUSINESS_TYPE_OPTIONS}
          value={formik.values.businessType}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.businessType}
          touched={formik.touched.businessType}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="city"
          name="city"
          label="City"
          placeholder="Your city"
          value={formik.values.city}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.city}
          touched={formik.touched.city}
        />
        <Input
          id="state"
          name="state"
          label="State"
          placeholder="Your state"
          value={formik.values.state}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.state}
          touched={formik.touched.state}
        />
      </div>

      <Textarea
        id="message"
        name="message"
        label="Message"
        placeholder="Tell us about your business and expected order volume"
        value={formik.values.message}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.errors.message}
        touched={formik.touched.message}
      />

      <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full sm:w-auto sm:self-start">
        {isPending ? "Submitting…" : "Submit dealer inquiry"}
      </Button>

      {isSuccess && (
        <p className="flex items-center gap-2 text-sm text-ink">
          <CheckCircle2 size={16} className="text-brand" /> Thanks — our dealer team will reach out shortly.
        </p>
      )}
      {isError && (
        <p className="flex items-center gap-2 text-sm text-brand">
          <AlertCircle size={16} /> Something went wrong. Please try again, or email orders@modortho.com directly.
          <button type="button" onClick={() => reset()} className="underline">
            Dismiss
          </button>
        </p>
      )}
    </form>
  );
}
