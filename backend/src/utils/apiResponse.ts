import { Request, Response, NextFunction } from "express";

// ─── API Response ────────────────────────────────────────

export class ApiResponse {
  static success<T>(res: Response, message: string, data?: T, statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data: data ?? null });
  }

  static created<T>(res: Response, message: string, data?: T) {
    return ApiResponse.success(res, message, data, 201);
  }

  static paginated<T>(
    res: Response,
    message: string,
    data: T[],
    pagination: { page: number; limit: number; total: number }
  ) {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: Math.ceil(pagination.total / pagination.limit),
      },
    });
  }

  static error(res: Response, message: string, errors?: unknown[], statusCode = 400) {
    return res.status(statusCode).json({ success: false, message, errors: errors ?? [] });
  }
}

// ─── App Error ───────────────────────────────────────────

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── Async Handler ───────────────────────────────────────

export const asyncHandler =
  <Req extends Request = Request>(fn: (req: Req, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req as Req, res, next)).catch(next);
  };

// ─── Pagination ──────────────────────────────────────────

export function getPagination(query: { page?: string; limit?: string; ignoreMaxLimit?: string }) {
  const rawPage = parseInt(query.page || "1", 10);
  const page = Math.max(1, Number.isFinite(rawPage) ? rawPage : 1);
  const maxLimit = query.ignoreMaxLimit === "true" ? 999999 : 100;
  const rawLimit = parseInt(query.limit || "20", 10);
  const limit = Math.min(maxLimit, Math.max(1, Number.isFinite(rawLimit) ? rawLimit : 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ─── Slugify ─────────────────────────────────────────────

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─── Format Currency ─────────────────────────────────────

export function formatCurrency(amount: number, currencyCode = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(amount);
}

/**
 * Converts price from base currency to target currency.
 * targetAmount = amountInBase * (targetCurrency.exchangeRate / baseCurrency.exchangeRate)
 */
export function convertPrice(amountInBase: number, targetExchangeRateRatio: number): number {
  return parseFloat((amountInBase * targetExchangeRateRatio).toFixed(2));
}

// ─── Generate variant key ────────────────────────────────

export function generateVariantKey(attributeValueIds: string[]): string {
  return [...attributeValueIds].sort().join("-");
}
