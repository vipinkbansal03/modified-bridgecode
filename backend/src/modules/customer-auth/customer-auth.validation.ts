import { z } from "zod";

export const registerSchema = z.object({
  accountType: z.enum(["DEALER", "DOCTOR_RETAILER"], {
    error: (issue) =>
      issue.input === undefined
        ? "Account type is required"
        : "Select a valid account type",
  }),
  name: z
    .string({ error: "Name is required" })
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or fewer"),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address")
    .max(254, "Email address is too long"),
  password: z
    .string({ error: "Password is required" })
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be 72 characters or fewer"),
  phone: z
    .string({ error: "Phone number is required" })
    .trim()
    .min(7, "Enter a valid phone number")
    .max(20, "Phone number is too long"),
  companyName: z.string().trim().max(150, "Company name is too long").optional(),
  website: z
    .string()
    .trim()
    .url("Enter a valid website URL")
    .optional()
    .or(z.literal("")),
  preferredPrescription: z.enum(["MBT", "ROTH", "OTHER"]).optional(),
  address: z.object({
    countryCode: z
      .string({ error: "Country is required" })
      .trim()
      .length(2, "Country code must contain 2 letters")
      .toUpperCase(),
    addressLine1: z
      .string({ error: "Address is required" })
      .trim()
      .min(3, "Enter a valid address")
      .max(200, "Address is too long"),
    addressLine2: z.string().trim().max(200, "Address is too long").optional(),
    city: z
      .string({ error: "City is required" })
      .trim()
      .min(2, "Enter a valid city")
      .max(100, "City is too long"),
    state: z
      .string({ error: "State is required" })
      .trim()
      .min(2, "Enter a valid state")
      .max(100, "State is too long"),
    postalCode: z
      .string({ error: "Postal code is required" })
      .trim()
      .min(3, "Enter a valid postal code")
      .max(20, "Postal code is too long"),
  }),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const customerLoginSchema = z.object({
  email: z
    .string({ error: "Email is required" })
    .trim()
    .toLowerCase()
    .email("Invalid email address"),
  password: z
    .string({ error: "Password is required" })
    .min(1, "Password is required"),
  rememberMe: z.boolean().optional(),
});

export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
