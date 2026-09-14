import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { sendCustomerPasswordResetEmail } from "../../utils/email";
import { validateGstinWithApi } from "../tax/gstClient";
import {
  SYSTEM_CUSTOMER_ROLE_KEYS,
  ensureCustomerRoleByKey,
  mapLegacyCustomerTypeToRoleKey,
} from "../customerRoles/customerRoles.service";
import { createAndSendOtp, verifyOtpCode, resendOtp } from "./otp.service";
import type {
  CustomerLoginInput,
  CustomerRegisterInput,
  VerifyLoginOtpInput,
  VerifyRegisterOtpInput,
  ResendOtpInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  UpdateCustomerProfileInput,
} from "./customerAuth.validation";

function getJwtExpiresIn() {
  return (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];
}

function signCustomerToken(customerId: string) {
  return jwt.sign({ id: customerId, scope: "customer" }, process.env.JWT_SECRET!, {
    expiresIn: getJwtExpiresIn(),
  });
}

function toCustomerSession(customer: {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  companyName: string | null;
  website: string | null;
  preferredPrescription: string | null;
  preferredPrescriptionOther: string | null;
  preferredSlot: string | null;
  currentPractice: string | null;
  currentPracticeOther: string | null;
  usingModernProducts: boolean;
  status: string;
  customerType: string;
  approvalStatus: string;
  customerRoleId: string | null;
  customerRole: { id: string; key: string; name: string } | null;
  tierId: string | null;
  defaultCountryId: string | null;
  taxId?: string | null;
  taxIdType?: string | null;
  taxIdStatus?: string | null;
}) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    companyName: customer.companyName,
    website: customer.website,
    preferredPrescription: customer.preferredPrescription,
    preferredPrescriptionOther: customer.preferredPrescriptionOther,
    preferredSlot: customer.preferredSlot,
    currentPractice: customer.currentPractice,
    currentPracticeOther: customer.currentPracticeOther,
    usingModernProducts: customer.usingModernProducts,
    status: customer.status,
    customerType: customer.customerType,
    approvalStatus: customer.approvalStatus,
    customerRoleId: customer.customerRoleId,
    customerRole: customer.customerRole,
    tierId: customer.tierId,
    defaultCountryId: customer.defaultCountryId,
    taxId: customer.taxId,
    taxIdType: (customer as any).taxIdType || null,
    taxIdStatus: customer.taxIdStatus,
  };
}

function cleanOptional(value?: string) {
  return value?.trim() || null;
}

async function resolveCountry(countryInput: string) {
  const country = countryInput.trim();
  const countryCode = country.toUpperCase();

  return prisma.country.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { code: countryCode },
        { name: { equals: country, mode: "insensitive" } },
      ],
    },
  });
}

export async function register(input: CustomerRegisterInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.customer.findFirst({ where: { email: normalizedEmail, deletedAt: null } });
  if (existing) throw new AppError("A customer account with this email already exists.", 409);

  const country = await resolveCountry(input.country);
  if (!country) throw new AppError("The selected country is not available.", 400);

  let taxIdStatus: "PENDING" | "VALID" | "INVALID" | undefined = undefined;
  if (input.taxId) {
    const nextTaxId = input.taxId.trim();
    if (nextTaxId) {
      const nextType = input.taxIdType || "GSTIN";
      if (nextType === "GSTIN") {
        const gstResult = await validateGstinWithApi(nextTaxId);
        if (!gstResult.valid) {
          throw new AppError(gstResult.message || "Invalid GSTIN format or verification failed.", 400);
        }
        taxIdStatus = "VALID";
      } else {
        taxIdStatus = "PENDING";
      }
    }
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const customerType = input.customerType ?? "RETAIL";
  const requestedRoleKey =
    input.customerRoleKey ??
    (customerType === "DEALER"
      ? SYSTEM_CUSTOMER_ROLE_KEYS.dealer
      : customerType === "WHOLESALE"
        ? SYSTEM_CUSTOMER_ROLE_KEYS.dealer
        : customerType === "DOCTOR"
          ? SYSTEM_CUSTOMER_ROLE_KEYS.doctorRetailer
          : mapLegacyCustomerTypeToRoleKey(customerType));
  const customerRole = await ensureCustomerRoleByKey(requestedRoleKey);
  const customer = await prisma.$transaction(async (tx) => {
    const createdCustomer = await tx.customer.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        companyName: cleanOptional(input.companyName),
        website: cleanOptional(input.website),
        preferredPrescription: input.preferredPrescription ?? null,
        preferredPrescriptionOther: cleanOptional(input.preferredPrescriptionOther),
        preferredSlot: input.preferredSlot ?? null,
        currentPractice: input.currentPractice ?? null,
        currentPracticeOther: cleanOptional(input.currentPracticeOther),
        usingModernProducts: input.usingModernProducts ?? false,
        status: "ACTIVE",
        customerType,
        customerRoleId: customerRole.id,
        approvalStatus: customerType === "WHOLESALE" ? "PENDING_APPROVAL" : "ACTIVE",
        defaultCountryId: country.id,
        taxId: input.taxId ? input.taxId.trim() : null,
        taxIdType: input.taxIdType ? input.taxIdType.trim() : (input.taxId ? "GSTIN" : null),
        taxIdStatus: taxIdStatus || "PENDING",
      },
      include: {
        customerRole: { select: { id: true, key: true, name: true } },
      },
    });

    await tx.customerAddress.create({
      data: {
        customerId: createdCustomer.id,
        label: "Default",
        fullName: `${input.firstName} ${input.lastName}`.trim(),
        phone: input.phone,
        addressLine1: input.addressLine1,
        addressLine2: cleanOptional(input.addressLine2),
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        countryId: country.id,
        isDefault: true,
      },
    });

    await tx.quote.updateMany({
      where: {
        customerId: null,
        customerEmail: { equals: normalizedEmail, mode: "insensitive" },
      },
      data: {
        customerId: createdCustomer.id,
      },
    });

    return createdCustomer;
  });

  const token = signCustomerToken(customer.id);

  // Notify Admins
  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "New Customer Registration",
      message: `${customer.firstName} ${customer.lastName} (${customer.email}) has registered.`,
      type: "INFO",
      targetType: "ALL_ADMINS",
      link: `/admin/customers/${customer.id}`,
    }).catch(console.error);
  });

  prisma.activityLog
    .create({
      data: {
        action: "CUSTOMER_REGISTERED",
        entityType: "User",
        entityId: customer.id,
        metadata: { email: customer.email, firstName: customer.firstName, lastName: customer.lastName },
      },
    })
    .catch(() => {});

  return { token, customer: toCustomerSession(customer) };
}

export async function initiateRegister(input: CustomerRegisterInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const existing = await prisma.customer.findFirst({ where: { email: normalizedEmail, deletedAt: null } });
  if (existing) throw new AppError("A customer account with this email already exists.", 409);

  const country = await resolveCountry(input.country);
  if (!country) throw new AppError("The selected country is not available.", 400);

  if (input.taxId) {
    const nextTaxId = input.taxId.trim();
    if (nextTaxId) {
      const nextType = input.taxIdType || "GSTIN";
      if (nextType === "GSTIN") {
        const gstResult = await validateGstinWithApi(nextTaxId);
        if (!gstResult.valid) {
          throw new AppError(gstResult.message || "Invalid GSTIN format or verification failed.", 400);
        }
      }
    }
  }

  const result = await createAndSendOtp(input.phone, "REGISTER", input);
  return {
    requiresOtp: true,
    ...result,
  };
}

export async function verifyRegisterOtp(input: VerifyRegisterOtpInput) {
  const session = await verifyOtpCode(input.verificationId, input.otp, "REGISTER");
  if (!session.payload) {
    throw new AppError("Registration payload missing from verification session.", 400);
  }
  return register(session.payload as CustomerRegisterInput);
}

export async function initiateLogin(input: CustomerLoginInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const customer = await prisma.customer.findFirst({
    where: { email: normalizedEmail, deletedAt: null },
    include: {
      customerRole: { select: { id: true, key: true, name: true } },
    },
  });
  if (!customer || !(await bcrypt.compare(input.password, customer.passwordHash))) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (customer.status !== "ACTIVE") {
    throw new AppError("Your customer account is inactive.", 401);
  }

  if (!customer.phone) {
    const token = signCustomerToken(customer.id);
    return {
      requiresOtp: false,
      token,
      customer: toCustomerSession(customer),
    };
  }

  const result = await createAndSendOtp(customer.phone, "LOGIN", { customerId: customer.id });
  return {
    requiresOtp: true,
    ...result,
  };
}

export async function verifyLoginOtp(input: VerifyLoginOtpInput) {
  const session = await verifyOtpCode(input.verificationId, input.otp, "LOGIN");
  const customerId = session.payload?.customerId;
  if (!customerId) {
    throw new AppError("Customer session invalid.", 400);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    include: {
      customerRole: { select: { id: true, key: true, name: true } },
    },
  });

  if (!customer || customer.status !== "ACTIVE") {
    throw new AppError("Your customer account is inactive or no longer exists.", 401);
  }

  const token = signCustomerToken(customer.id);
  return { token, customer: toCustomerSession(customer) };
}

export async function resendAuthOtp(input: ResendOtpInput) {
  return resendOtp(input.verificationId);
}

export async function login(input: CustomerLoginInput) {
  return initiateLogin(input);
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const customer = await prisma.customer.findFirst({
    where: {
      email: { equals: normalizedEmail, mode: "insensitive" },
      deletedAt: null,
    },
    include: {
      defaultCountry: { select: { code: true } },
    },
  });
  if (customer && customer.status === "ACTIVE") {
    const resetToken = jwt.sign(
      { id: customer.id, scope: "customer_password_reset" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" as SignOptions["expiresIn"] }
    );
    await sendCustomerPasswordResetEmail({
      email: customer.email,
      firstName: customer.firstName,
      resetToken,
      countryCode: customer.defaultCountry?.code,
    });
  }

  return { message: "If an account exists for this email, password reset instructions have been sent." };
}

export async function resetPassword(input: ResetPasswordInput) {
  let decoded: { id: string; scope?: string };
  try {
    decoded = jwt.verify(input.token, process.env.JWT_SECRET!) as { id: string; scope?: string };
  } catch {
    throw new AppError("Invalid or expired reset token.", 400);
  }

  if (decoded.scope !== "customer_password_reset") throw new AppError("Invalid or expired reset token.", 400);
  const customer = await prisma.customer.findUnique({ where: { id: decoded.id, deletedAt: null } });
  if (!customer) throw new AppError("Invalid or expired reset token.", 400);

  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await prisma.customer.update({
    where: { id: customer.id },
    data: { passwordHash, refreshToken: null },
  });

  return { message: "Password reset successfully." };
}

export async function getMe(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    include: {
      customerRole: { select: { id: true, key: true, name: true } },
    },
  });
  if (!customer) throw new AppError("Customer profile not found.", 404);
  return toCustomerSession(customer);
}

export async function updateProfile(customerId: string, input: UpdateCustomerProfileInput) {
  const existing = await prisma.customer.findUnique({ where: { id: customerId, deletedAt: null } });
  if (!existing) throw new AppError("Customer profile not found.", 404);

  let taxIdStatus: "PENDING" | "VALID" | "INVALID" | undefined = undefined;
  if (input.taxId !== undefined) {
    const nextTaxId = input.taxId ? input.taxId.trim() : "";
    if (!nextTaxId) {
      taxIdStatus = "PENDING";
    } else {
      const nextType = input.taxIdType || existing.taxIdType || "GSTIN";
      if (nextType === "GSTIN") {
        const gstResult = await validateGstinWithApi(nextTaxId);
        taxIdStatus = gstResult.valid ? "VALID" : "INVALID";
      } else {
        taxIdStatus = "PENDING";
      }
    }
  }

  const updatedCustomer = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.firstName !== undefined && { firstName: input.firstName }),
      ...(input.lastName !== undefined && { lastName: input.lastName }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.companyName !== undefined && { companyName: cleanOptional(input.companyName) }),
      ...(input.website !== undefined && { website: cleanOptional(input.website) }),
      ...(input.preferredPrescription !== undefined && { preferredPrescription: input.preferredPrescription }),
      ...(input.preferredPrescriptionOther !== undefined && { preferredPrescriptionOther: cleanOptional(input.preferredPrescriptionOther) }),
      ...(input.preferredSlot !== undefined && { preferredSlot: input.preferredSlot }),
      ...(input.currentPractice !== undefined && { currentPractice: input.currentPractice }),
      ...(input.currentPracticeOther !== undefined && { currentPracticeOther: cleanOptional(input.currentPracticeOther) }),
      ...(input.usingModernProducts !== undefined && { usingModernProducts: input.usingModernProducts }),
      ...(input.taxId !== undefined && { taxId: input.taxId ? input.taxId.trim() : null }),
      ...(input.taxIdType !== undefined && { taxIdType: input.taxIdType ? input.taxIdType.trim() : null }),
      ...(taxIdStatus !== undefined && { taxIdStatus }),
    },
    include: {
      customerRole: { select: { id: true, key: true, name: true } },
    },
  });

  return toCustomerSession(updatedCustomer as any);
}
