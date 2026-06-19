import * as Yup from "yup";
import { PHONE_REGEX } from "@/utils/constants";

export const contactValidationSchema = Yup.object({
  name: Yup.string().trim().min(2, "Enter your full name").required("Name is required"),
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
  phone: Yup.string()
    .trim()
    .matches(PHONE_REGEX, "Enter a valid phone number")
    .required("Phone number is required"),
  company: Yup.string().trim().optional(),
  message: Yup.string().trim().min(10, "Message should be at least 10 characters").required("Message is required"),
});

export type ContactFormValues = Yup.InferType<typeof contactValidationSchema>;

export const contactInitialValues: ContactFormValues = {
  name: "",
  email: "",
  phone: "",
  company: "",
  message: "",
};
