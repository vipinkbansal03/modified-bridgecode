import { z } from "zod";

const PHONE_REGEX = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{2,4}[-\s\.]?[0-9]{3,6}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export const customerRegisterSchema = z.object({
  email: z.string().email("Invalid email address").transform((value) => value.toLowerCase().trim()),
  password: z.string().min(8, "Password must be at least 8 characters"),
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  phone: z
    .string()
    .trim()
    .min(7, "Mobile number must be at least 7 digits")
    .max(20, "Mobile number is too long")
    .regex(PHONE_REGEX, "Please enter a valid mobile number"),
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
  taxId: z
    .string()
    .trim()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return val.length >= 4 && val.length <= 25;
    }, "Tax ID / GSTIN must be between 4 and 25 characters"),
  taxIdType: z.string().trim().optional(),
});

export const customerLoginSchema = z.object({
  email: z.string().email("Invalid email address").transform((value) => value.toLowerCase().trim()),
  password: z.string().min(1, "Password is required"),
});

export const sendLoginOtpSchema = z.object({
  phone: z.string().trim().min(7, "Please enter a valid mobile number"),
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

export const verifyLoginOtpSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
  otp: z.string().trim().length(6, "OTP must be 6 digits"),
});

export const verifyRegisterOtpSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
  otp: z.string().trim().length(6, "OTP must be 6 digits"),
});

export const resendOtpSchema = z.object({
  verificationId: z.string().min(1, "Verification ID is required"),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;
export type SendLoginOtpInput = z.infer<typeof sendLoginOtpSchema>;
export type VerifyLoginOtpInput = z.infer<typeof verifyLoginOtpSchema>;
export type VerifyRegisterOtpInput = z.infer<typeof verifyRegisterOtpSchema>;
export type ResendOtpInput = z.infer<typeof resendOtpSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type UpdateCustomerProfileInput = z.infer<typeof updateCustomerProfileSchema>;
