import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/apiResponse";
import { logger } from "../config/logger";

export function errorMiddleware(err: Error, req: Request, res: Response, _next: NextFunction) {
  let statusCode = 500;
  let message = "Internal server error";
  let errors: unknown[] = [];

  // Operational/known errors
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  }

  // Prisma: unique constraint violation
  if ((err as { code?: string }).code === "P2002") {
    statusCode = 409;
    const target = (err as { meta?: { target?: string[] } }).meta?.target ?? [];
    if (target.includes("attributeId") && target.includes("slug")) {
      message = "This value already exists for the selected attribute.";
    } else {
      const field = target[0] ?? "field";
      message = `A record with this ${field} already exists.`;
    }
  }

  // Prisma: record not found
  if ((err as { code?: string }).code === "P2025") {
    statusCode = 404;
    message = "Record not found.";
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please log in again.";
  }
  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Your session has expired. Please log in again.";
  }

  // Log server errors
  if (statusCode >= 500) {
    logger.error(`[${req.method}] ${req.path} — ${err.message}`, { stack: err.stack });
  }

  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
}
