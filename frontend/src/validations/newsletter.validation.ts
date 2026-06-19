import * as Yup from "yup";

export const newsletterValidationSchema = Yup.object({
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
});

export type NewsletterFormValues = Yup.InferType<typeof newsletterValidationSchema>;

export const newsletterInitialValues: NewsletterFormValues = { email: "" };
