"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CustomerAuthShell } from "@/components/auth/CustomerAuthShell";
import { customerApi, getCustomerErrorMessage } from "@/services/customerApi";

const resetSchema = Yup.object({
  token: Yup.string().required("Reset token is required"),
  newPassword: Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
});

function ResetPasswordForm() {
  const params = useSearchParams();
  const tokenFromUrl = params.get("token") ?? "";

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { token: tokenFromUrl, newPassword: "" },
    validationSchema: resetSchema,
    onSubmit: async (values, helpers) => {
      helpers.setStatus("");
      try {
        await customerApi.post("/auth/reset-password", values);
        helpers.setStatus("Password reset successfully. You can sign in with your new password.");
        helpers.resetForm({ values: { token: values.token, newPassword: "" }, status: "Password reset successfully. You can sign in with your new password." });
      } catch (error) {
        helpers.setStatus(getCustomerErrorMessage(error, "Could not reset password."));
      } finally {
        helpers.setSubmitting(false);
      }
    },
  });

  return (
    <CustomerAuthShell title="Choose a new password" subtitle="Use the reset token from your email and set a new password.">
      <form onSubmit={formik.handleSubmit} className="space-y-5" noValidate>
        {formik.status && <p className="rounded-md border border-line bg-grey px-3 py-2 text-sm text-ink">{formik.status}</p>}
        <Input id="token" name="token" label="Reset token" value={formik.values.token} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.token} touched={formik.touched.token} />
        <Input id="newPassword" name="newPassword" type="password" label="New password" placeholder="At least 8 characters" value={formik.values.newPassword} onChange={formik.handleChange} onBlur={formik.handleBlur} error={formik.errors.newPassword} touched={formik.touched.newPassword} />
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={formik.isSubmitting}>
          {formik.isSubmitting ? "Saving..." : "Reset password"}
        </Button>
        <p className="text-center text-[13px] text-steel">
          Ready to continue? <Link href="/login" className="font-medium text-ink hover:text-brand">Sign in</Link>
        </p>
      </form>
    </CustomerAuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
