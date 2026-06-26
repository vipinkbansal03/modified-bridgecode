import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { LoginInput } from "./auth.validation";

const CUSTOMER_ROLES = ["Customer", "Dealer", "Doctor / Retailer"];

export async function loginService(input: LoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    include: { role: true },
  });

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Your account is inactive. Contact an administrator.", 401);
  }

  if (CUSTOMER_ROLES.includes(user.role.name)) {
    throw new AppError("This account cannot access the admin portal.", 403);
  }

  const jwtExpiresIn = (process.env.JWT_EXPIRES_IN || "7d") as SignOptions["expiresIn"];

  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
    expiresIn: jwtExpiresIn,
  });

  // Update last login
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: user.role.permissions,
    },
  };
}

export async function getMeService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
      role: {
        select: {
          name: true,
          permissions: true,
        },
      },
    },
  });
  if (!user) throw new AppError("User not found.", 404);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role.name,
    permissions: user.role.permissions as string[],
    status: user.status,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}
