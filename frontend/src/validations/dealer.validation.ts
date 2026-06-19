import * as Yup from "yup";
import { GST_REGEX, PHONE_REGEX } from "@/utils/constants";

export const dealerValidationSchema = Yup.object({
  companyName: Yup.string().trim().min(2, "Enter your company name").required("Company name is required"),
  contactPerson: Yup.string().trim().min(2, "Enter a contact person").required("Contact person is required"),
  email: Yup.string().trim().email("Enter a valid email address").required("Email is required"),
  phone: Yup.string()
    .trim()
    .matches(PHONE_REGEX, "Enter a valid phone number")
    .required("Phone number is required"),
  gstNumber: Yup.string()
    .trim()
    .optional()
    .test("gst-format", "Enter a valid GST number", (value) => !value || GST_REGEX.test(value)),
  businessType: Yup.string().trim().required("Select a business type"),
  city: Yup.string().trim().required("City is required"),
  state: Yup.string().trim().required("State is required"),
  message: Yup.string().trim().min(10, "Message should be at least 10 characters").required("Message is required"),
});

export type DealerFormValues = Yup.InferType<typeof dealerValidationSchema>;

export const dealerInitialValues: DealerFormValues = {
  companyName: "",
  contactPerson: "",
  email: "",
  phone: "",
  gstNumber: "",
  businessType: "",
  city: "",
  state: "",
  message: "",
};

export const BUSINESS_TYPE_OPTIONS = [
  { value: "", label: "Select business type" },
  { value: "clinic", label: "Orthodontic Clinic" },
  { value: "distributor", label: "Distributor" },
  { value: "dental-depot", label: "Dental Depot / Retailer" },
  { value: "oem", label: "OEM / Private Label" },
  { value: "other", label: "Other" },
];
