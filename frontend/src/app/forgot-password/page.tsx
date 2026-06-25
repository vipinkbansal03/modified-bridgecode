"use client";

import Link from "next/link";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CustomerAuthShell } from "@/components/auth/CustomerAuthShell";
import { customerApi, getCustomerErrorMessage } from "@/services/customerApi";

const forgotSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Email is required"),
});

const successMessage = "If an account exists for this email, password reset instructions have been sent.";

export default function ForgotPasswordPage() {
  const formik = useFormik({
    initialValues: { email: "" },
    validationSchema: forgotSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try {
        await customerApi.post("/auth/forgot-password", { email: values.email });
        helpers.setStatus(successMessage);
        helpers.resetForm({ values: { email: "" }, status: successMessage });
      } catch (error) {
        helpers.setStatus(getCustomerErrorMessage(error, "Could not send reset instructions."));
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <CustomerAuthShell title="Reset password" subtitle="Enter your email and we will send reset instructions if an account exists.">
      <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
        {formik.status && <p className="rounded-md border border-line bg-grey px-3 py-2 text-sm text-ink">{formik.status}</p>}
        <Input id="email" name="email" type="email" label="Email" placeholder="you@clinic.com" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.email} touched={formik.touched.email} />
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Sending..." : "Send reset instructions"}
        </Button>
        <p className="text-center text-[13px] text-steel">
          Remembered it? <Link href="/login" className="font-medium text-ink hover:text-brand">Sign in</Link>
        </p>
      </form>
    </CustomerAuthShell>
  );
}
