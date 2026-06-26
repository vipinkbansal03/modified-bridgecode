import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { CUSTOMER_AUTH_COOKIE } from "./customer-auth.constants";

const CUSTOMER_ROLES = ["Dealer", "Doctor / Retailer"];

export interface CustomerAuthRequest extends Request {
  customer?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export const protectCustomer = async (
  req: CustomerAuthRequest,
  _res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.cookies?.[CUSTOMER_AUTH_COOKIE];

    if (!token) {
      throw new AppError("Not authenticated. Please log in.", 401);
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, deletedAt: null },
      include: { role: true },
    });

    if (!user) {
      throw new AppError("User no longer exists.", 401);
    }

    if (user.status !== "ACTIVE") {
      throw new AppError("Your account is inactive.", 401);
    }

    if (!CUSTOMER_ROLES.includes(user.role.name)) {
      throw new AppError("This account cannot access the customer portal.", 403);
    }

    req.customer = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};
