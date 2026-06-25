"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CustomerAuthShell } from "@/components/auth/CustomerAuthShell";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { getCustomerErrorMessage } from "@/services/customerApi";

const registerSchema = Yup.object({
  firstName: Yup.string().trim().required("First name is required"),
  lastName: Yup.string().trim().required("Last name is required"),
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
  phone: Yup.string().trim(),
});

export default function RegisterPage() {
  const { register } = useCustomerAuth();
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.startsWith("/")) setReturnTo(next);
  }, []);

  const formik = useFormik({
    initialValues: { firstName: "", lastName: "", email: "", password: "", phone: "" },
    validationSchema: registerSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try {
        await register({
          firstName: values.firstName.trim(),
          lastName: values.lastName.trim(),
          email: values.email,
          password: values.password,
          phone: values.phone.trim() || undefined,
        }, returnTo);
      } catch (error) {
        helpers.setStatus(getCustomerErrorMessage(error, "Could not create account."));
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <CustomerAuthShell title="Create account" subtitle="Registration signs you in immediately so you can continue without another step.">
      <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
        {formik.status && <p className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-brand">{formik.status}</p>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Input id="firstName" name="firstName" label="First name" value={formik.values.firstName} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.firstName} touched={formik.touched.firstName} />
          <Input id="lastName" name="lastName" label="Last name" value={formik.values.lastName} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.lastName} touched={formik.touched.lastName} />
        </div>
        <Input id="email" name="email" type="email" label="Email" placeholder="you@clinic.com" value={formik.values.email} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.email} touched={formik.touched.email} />
        <Input id="phone" name="phone" label="Phone (optional)" placeholder="+91 98765 43210" value={formik.values.phone} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.phone} touched={formik.touched.phone} />
        <Input id="password" name="password" type="password" label="Password" placeholder="At least 8 characters" value={formik.values.password} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.password} touched={formik.touched.password} />
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Creating account..." : "Create account"}
        </Button>
        <p className="text-center text-[13px] text-steel">
          Already have an account? <Link href={`/login?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-ink hover:text-brand">Sign in</Link>
        </p>
      </form>
    </CustomerAuthShell>
  );
}
