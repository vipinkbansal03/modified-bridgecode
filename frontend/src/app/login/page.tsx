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

const loginSchema = Yup.object({
  email: Yup.string().email("Invalid email address").required("Email is required"),
  password: Yup.string().required("Password is required"),
});

export default function LoginPage() {
  const { login } = useCustomerAuth();
  const [returnTo, setReturnTo] = useState("/");

  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("returnTo");
    if (next?.startsWith("/")) setReturnTo(next);
  }, []);

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
    <CustomerAuthShell title="Sign in" subtitle="Access your account, saved details, and future order tools.">
      <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
        {formik.status && <p className="rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-sm text-brand">{formik.status}</p>}
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
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Your password"
          value={formik.values.password}
          onChange={formik.handleChange}
          onBlur={formik.handleBlur}
          error={formik.errors.password}
          touched={formik.touched.password}
        />
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <Link href="/forgot-password" className="text-steel hover:text-brand">Forgot password?</Link>
          <Link href={`/register?returnTo=${encodeURIComponent(returnTo)}`} className="font-medium text-ink hover:text-brand">Create account</Link>
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Signing in..." : "Sign in"}
        </Button>
      </form>
    </CustomerAuthShell>
  );
}
