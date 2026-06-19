import { Request, Response, NextFunction } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { AppError } from "../utils/apiResponse";

export interface AuthRequest extends Request<ParamsDictionary> {
  user?: {
    id: string;
    email: string;
    name: string;
    roleId: string;
    permissions: string[];
  };
}

export const protect = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  try {
    let token: string | undefined;

    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
      token = req.cookies.token;
    }

    if (!token) throw new AppError("Not authenticated. Please log in.", 401);

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id, deletedAt: null },
      include: { role: true },
    });

    if (!user) throw new AppError("User no longer exists.", 401);
    if (user.status !== "ACTIVE") throw new AppError("Your account is inactive.", 401);

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      permissions: (user.role.permissions as string[]) || [],
    };

    next();
  } catch (err) {
    next(err);
  }
};

export const requirePermission = (...permissions: string[]) => {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new AppError("Not authenticated.", 401));

    const hasPermission = permissions.some(
      (p) => req.user!.permissions.includes(p) || req.user!.permissions.includes("*")
    );

    if (!hasPermission) {
      return next(new AppError("You do not have permission to perform this action.", 403));
    }
    next();
  };
};
