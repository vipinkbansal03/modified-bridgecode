import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { sendCustomerPasswordResetEmail } from "../../utils/email";
import type {
  CustomerLoginInput,
  CustomerRegisterInput,
  ForgotPasswordInput,
  ResetPasswordInput,
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
  status: string;
  tierId: string | null;
  defaultCountryId: string | null;
}) {
  return {
    id: customer.id,
    email: customer.email,
    firstName: customer.firstName,
    lastName: customer.lastName,
    phone: customer.phone,
    status: customer.status,
    tierId: customer.tierId,
    defaultCountryId: customer.defaultCountryId,
  };
}

export async function register(input: CustomerRegisterInput) {
  const existing = await prisma.customer.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError("A customer account with this email already exists.", 409);

  const passwordHash = await bcrypt.hash(input.password, 12);
  const customer = await prisma.customer.create({
    data: {
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone || null,
      status: "ACTIVE",
    },
  });

  const token = signCustomerToken(customer.id);
  return { token, customer: toCustomerSession(customer) };
}

export async function login(input: CustomerLoginInput) {
  const customer = await prisma.customer.findUnique({ where: { email: input.email } });
  if (!customer || !(await bcrypt.compare(input.password, customer.passwordHash))) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (customer.status !== "ACTIVE") {
    throw new AppError("Your customer account is inactive.", 401);
  }

  const token = signCustomerToken(customer.id);
  return { token, customer: toCustomerSession(customer) };
}

export async function forgotPassword(input: ForgotPasswordInput) {
  const customer = await prisma.customer.findUnique({ where: { email: input.email } });
  if (customer && customer.status === "ACTIVE") {
    const resetToken = jwt.sign(
      { id: customer.id, scope: "customer_password_reset" },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" as SignOptions["expiresIn"] }
    );
    await sendCustomerPasswordResetEmail({ email: customer.email, firstName: customer.firstName, resetToken });
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
