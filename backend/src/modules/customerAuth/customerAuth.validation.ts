import { z } from "zod";

export const customerRegisterSchema = z.object({
  email: z.string().email("Invalid email address").transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z.string().trim().min(1, "Mobile number is required"),
  customerType: z.enum(["RETAIL", "DEALER", "DOCTOR", "WHOLESALE"]).optional(),
  customerRoleKey: z.enum(["GUEST", "DEALER", "DOCTOR_RETAILER"]).optional(),
  companyName: z.string().trim().optional(),
  website: z.string().trim().optional(),
  addressLine1: z.string().trim().min(1, "Address is required"),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().min(1, "City is required"),
  state: z.string().trim().min(1, "State is required"),
  postalCode: z.string().trim().min(1, "Zipcode is required"),
  country: z.string().trim().min(1, "Country is required"),
  preferredPrescription: z.enum(["MBT", "ROTH", "OTHER"]).optional(),
  preferredPrescriptionOther: z.string().trim().optional(),
  preferredSlot: z.enum(["022", "018"]).optional(),
  currentPractice: z.enum(["STUDENT", "ORTHODONTIST", "OTHER"]).optional(),
  currentPracticeOther: z.string().trim().optional(),
  usingModernProducts: z.boolean().optional(),
  taxId: z.string().trim().optional(),
  taxIdType: z.string().trim().optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().email("Invalid email address").transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address").transform((value) => value.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const updateCustomerProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").optional(),
  lastName: z.string().trim().min(1, "Last name is required").optional(),
  phone: z.string().trim().min(1, "Mobile number is required").optional(),
  companyName: z.string().trim().optional(),
  website: z.string().trim().optional(),
  preferredPrescription: z.enum(["MBT", "ROTH", "OTHER"]).nullable().optional(),
  preferredPrescriptionOther: z.string().trim().optional(),
  preferredSlot: z.enum(["022", "018"]).nullable().optional(),
  currentPractice: z.enum(["STUDENT", "ORTHODONTIST", "OTHER"]).nullable().optional(),
  currentPracticeOther: z.string().trim().optional(),
  usingModernProducts: z.boolean().optional(),
  taxId: z.string().trim().nullable().optional(),
  taxIdType: z.string().trim().nullable().optional(),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
