import * as Yup from "yup";

export interface RegisterFormValues {
  accountType: "" | "DEALER" | "DOCTOR_RETAILER";
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  companyName: string;
  website: string;
  preferredPrescription: "" | "MBT" | "ROTH" | "OTHER";
  address: {
    countryCode: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

export const registerInitialValues: RegisterFormValues = {
  accountType: "",
  name: "",
  email: "",
  phone: "",
  password: "",
  confirmPassword: "",
  companyName: "",
  website: "",
  preferredPrescription: "",
  address: {
    countryCode: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
  },
};

export const registerValidationSchema = Yup.object({
  accountType: Yup.string()
    .oneOf(["DEALER", "DOCTOR_RETAILER"], "Select an account type")
    .required("Account type is required"),
  name: Yup.string()
    .trim()
    .required("Name is required")
    .test(
      "name-min-length",
      "Name must be at least 2 characters",
      (value) => !value || value.length >= 2,
    )
    .max(100, "Name is too long"),
  email: Yup.string()
    .trim()
    .required("Email is required")
    .email("Enter a valid email address"),
  phone: Yup.string()
    .trim()
    .required("Phone number is required")
    .test(
      "phone-min-length",
      "Enter a valid phone number",
      (value) => !value || value.length >= 7,
    )
    .max(20, "Phone number is too long"),
  password: Yup.string()
    .required("Password is required")
    .test(
      "password-min-length",
      "Password must be at least 8 characters",
      (value) => !value || value.length >= 8,
    )
    .max(72, "Password is too long"),
  confirmPassword: Yup.string()
    .required("Confirm your password")
    .oneOf([Yup.ref("password")], "Passwords must match"),
  companyName: Yup.string().trim().max(150, "Company name is too long"),
  website: Yup.string()
    .trim()
    .test("website", "Enter a valid website URL", (value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    }),
  preferredPrescription: Yup.string().oneOf(
    ["", "MBT", "ROTH", "OTHER"],
    "Select a valid prescription",
  ),
  address: Yup.object({
    countryCode: Yup.string().required("Country is required"),
    addressLine1: Yup.string()
      .trim()
      .required("Address is required")
      .test(
        "address-min-length",
        "Enter a valid address",
        (value) => !value || value.length >= 3,
      )
      .max(200, "Address is too long"),
    addressLine2: Yup.string().trim().max(200, "Address is too long"),
    city: Yup.string()
      .trim()
      .required("City is required")
      .test(
        "city-min-length",
        "Enter a valid city",
        (value) => !value || value.length >= 2,
      )
      .max(100, "City is too long"),
    state: Yup.string()
      .trim()
      .required("State is required")
      .test(
        "state-min-length",
        "Enter a valid state",
        (value) => !value || value.length >= 2,
      )
      .max(100, "State is too long"),
    postalCode: Yup.string()
      .trim()
      .required("Postal code is required")
      .test(
        "postal-code-min-length",
        "Enter a valid postal code",
        (value) => !value || value.length >= 3,
      )
      .max(20, "Postal code is too long"),
  }),
});

export const REGISTER_STEP_ONE_FIELDS = [
  "accountType",
  "name",
  "email",
  "phone",
  "password",
  "confirmPassword",
] as const;
