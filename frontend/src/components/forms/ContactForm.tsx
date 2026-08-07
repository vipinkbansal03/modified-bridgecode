"use client";

import { useFormik } from "formik";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useContactSubmit } from "@/hooks/api/useContactSubmit";
import { contactInitialValues, contactValidationSchema } from "@/validations/contact.validation";

export function ContactForm() {
  const { mutate, isPending, isSuccess, isError, reset } = useContactSubmit();

  const formik = useFormik({
    initialValues: contactInitialValues,
    validationSchema: contactValidationSchema,
    onSubmit: (values, helpers) => {
      mutate(values, {
        onSuccess: () => helpers.resetForm(),
      });
    },
  });

  return (
    <form onSubmit={formik.handleSubmit} className="flex flex-col gap-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          id="name"
          name="name"
          label="Name"
          placeholder="Your full name"
          value={formik.values.name}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.name}
          touched={formik.touched.name}
          className=""
        />
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="you@clinic.com"
          value={formik.values.email}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.email}
          touched={formik.touched.email}
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
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
        <Input
          id="company"
          name="company"
          label="Company (optional)"
          placeholder="Clinic / dealership name"
          value={formik.values.company}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
        />
      </div>
      <Textarea
        id="message"
        name="message"
        label="Message"
        placeholder="Tell us what you need"
        value={formik.values.message}
        onChange={formik.handleChange}
        onBlur={formik.handleBlur}
        error={formik.errors.message}
        touched={formik.touched.message}
      />

      <Button type="submit" variant="primary" size="lg" disabled={isPending} className="w-full sm:w-auto sm:self-start">
        {isPending ? "Sending…" : "Send message"}
      </Button>

      {isSuccess && (
        <p className="flex items-center gap-2 text-sm text-ink">
          <CheckCircle2 size={16} className="text-brand" /> Thanks — we&apos;ll get back to you shortly.
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
