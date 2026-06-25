import { Request, Response, NextFunction } from "express";
import type { ParamsFlatDictionary } from "express-serve-static-core";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { AppError } from "../utils/apiResponse";

export interface CustomerAuthRequest extends Request<ParamsFlatDictionary> {
  customer?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    tierId: string | null;
  };
}

export const protectCustomer = async (req: CustomerAuthRequest, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.customerToken) {
      token = req.cookies.customerToken;
    }

    if (!token) throw new AppError("Customer authentication required.", 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; scope?: string };
    if (decoded.scope !== "customer") throw new AppError("Customer authentication required.", 401);

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id, deletedAt: null },
    });

    if (!customer) throw new AppError("Customer account no longer exists.", 401);
    if (customer.status !== "ACTIVE") throw new AppError("Your customer account is inactive.", 401);

    req.customer = {
      id: customer.id,
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      tierId: customer.tierId,
    };

    next();
  } catch (err) {
    next(err);
  }
};
