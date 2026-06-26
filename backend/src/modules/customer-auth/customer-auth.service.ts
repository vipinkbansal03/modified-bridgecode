import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { CustomerLoginInput, RegisterInput } from "./customer-auth.validation";

const ROLE_BY_ACCOUNT_TYPE = {
  DEALER: "Dealer",
  DOCTOR_RETAILER: "Doctor / Retailer",
} as const;

const CUSTOMER_ROLE_NAMES = Object.values(ROLE_BY_ACCOUNT_TYPE);

const customerSelect = {
  id: true,
  name: true,
  email: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  role: {
    select: {
      name: true,
    },
  },
  customerProfile: {
    select: {
      phone: true,
      companyName: true,
      website: true,
      preferredPrescription: true,
    },
  },
  customerAddresses: {
    select: {
      id: true,
      country: {
        select: {
          name: true,
          code: true,
        },
      },
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      postalCode: true,
      isDefault: true,
    },
  },
};

export async function registerCustomer(input: RegisterInput) {
  const existingUser = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });

  if (existingUser) {
    throw new AppError("An account with this email already exists.", 409);
  }

  const country = await prisma.country.findUnique({
    where: { code: input.address.countryCode },
    select: { id: true, status: true },
  });

  if (!country || country.status !== "ACTIVE") {
    throw new AppError("The selected country is not available.", 400);
  }

  const roleName = ROLE_BY_ACCOUNT_TYPE[input.accountType];
  const customerRole = await prisma.role.upsert({
    where: { name: roleName },
    update: {},
    create: {
      name: roleName,
      permissions: [],
    },
  });

  const password = await bcrypt.hash(input.password, 12);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name: input.name,
        email: input.email,
        password,
        roleId: customerRole.id,
        customerProfile: {
          create: {
            phone: input.phone,
            companyName: input.companyName || null,
            website: input.website || null,
            preferredPrescription: input.preferredPrescription,
          },
        },
        customerAddresses: {
          create: {
            countryId: country.id,
            recipientName: input.name,
            phone: input.phone,
            addressLine1: input.address.addressLine1,
            addressLine2: input.address.addressLine2 || null,
            city: input.address.city,
            state: input.address.state,
            postalCode: input.address.postalCode,
            isDefault: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        createdAt: true,
        role: {
          select: {
            name: true,
          },
        },
        customerProfile: {
          select: {
            phone: true,
            companyName: true,
            website: true,
            preferredPrescription: true,
          },
        },
        customerAddresses: {
          select: {
            id: true,
            country: {
              select: {
                name: true,
                code: true,
              },
            },
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
            isDefault: true,
          },
        },
      },
    });

    return user;
  });
}

export async function loginCustomer(input: CustomerLoginInput) {
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    include: {
      role: true,
      customerProfile: true,
      customerAddresses: {
        include: {
          country: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
    },
  });

  if (!user || !(await bcrypt.compare(input.password, user.password))) {
    throw new AppError("Invalid email or password.", 401);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Your account is inactive. Contact an administrator.", 401);
  }

  if (!CUSTOMER_ROLE_NAMES.includes(user.role.name as typeof CUSTOMER_ROLE_NAMES[number])) {
    throw new AppError("This account cannot access the customer portal.", 403);
  }

  const expiresIn = (input.rememberMe ? "30d" : "7d") as SignOptions["expiresIn"];
  const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET!, {
    expiresIn,
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
    select: customerSelect,
  });

  return {
    token,
    maxAge: input.rememberMe
      ? 30 * 24 * 60 * 60 * 1000
      : 7 * 24 * 60 * 60 * 1000,
    user: updatedUser,
  };
}

export async function getCustomerMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, deletedAt: null },
    select: customerSelect,
  });

  if (!user) {
    throw new AppError("User not found.", 404);
  }

  if (user.status !== "ACTIVE") {
    throw new AppError("Your account is inactive.", 401);
  }

  if (!CUSTOMER_ROLE_NAMES.includes(user.role.name as typeof CUSTOMER_ROLE_NAMES[number])) {
    throw new AppError("This account cannot access the customer portal.", 403);
  }

  return user;
}
