import { Request, Response } from "express";
import { asyncHandler, ApiResponse, ApiResponse as AR } from "../../utils/apiResponse";
import * as S from "./public.service";
import jwt from "jsonwebtoken";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await S.publicListProducts({ ...(req.query as Record<string, string>), countryCode: getRequestedCountry(req) } as never, getRequestedLanguage(req));
  return AR.paginated(res, "Products.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await S.publicGetProduct(String(req.params.slug), getRequestedLanguage(req), getRequestedCountry(req));
  return AR.success(res, "Product.", product);
});

export const previewProductPrices = asyncHandler(async (req: Request, res: Response) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const result = await S.previewPublicProductPrices(
    String(req.params.slug),
    items,
    getRequestedCountry(req),
    getOptionalCustomerId(req),
  );
  return AR.success(res, "Price preview.", result);
});

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  return AR.success(res, "Categories.", await S.publicListCategories(getRequestedLanguage(req), getRequestedCountry(req)));
});

export const getCategory = asyncHandler(async (req: Request, res: Response) => {
  return AR.success(res, "Category.", await S.publicGetCategory(String(req.params.slug), getRequestedLanguage(req), getRequestedCountry(req)));
});

export const getLanguages = asyncHandler(async (_req: Request, res: Response) => {
  return AR.success(res, "Languages.", await S.getPublicLanguages());
});

export const getStaticTranslations = asyncHandler(async (req: Request, res: Response) => {
  return AR.success(res, "Translations.", await S.getPublicStaticTranslations(getRequestedLanguage(req)));
});

export const submitQuote = asyncHandler(async (req: Request, res: Response) => {
  const quote = await S.submitPublicQuote(req.body);
  return AR.created(res, "Quote request submitted. We'll respond within 24 hours.", { quoteNumber: quote.quoteNumber });
});

export const submitContact = asyncHandler(async (req: Request, res: Response) => {
  const result = await S.submitContact(req.body);
  return AR.success(res, result.message);
});

export const search = asyncHandler(async (req: Request, res: Response) => {
  const q = (req.query.q as string) || "";
  return AR.success(res, "Search results.", await S.publicSearch(q, getRequestedLanguage(req), getRequestedCountry(req)));
});

export const getCurrencies = asyncHandler(async (_req: Request, res: Response) => {
  return AR.success(res, "Currencies.", await S.getPublicCurrencies());
});

export const getCountries = asyncHandler(async (_req: Request, res: Response) => {
  return AR.success(res, "Countries.", await S.getPublicCountries());
});

export const checkInventory = asyncHandler(async (req: Request, res: Response) => {
  const ids = (req.query.variantIds as string || "").split(",").filter(Boolean);
  const countryCode = typeof req.query.countryCode === "string" ? req.query.countryCode : undefined;
  return AR.success(res, "Inventory.", await S.checkInventory(ids, countryCode));
});

function getRequestedLanguage(req: Request) {
  const queryLang = typeof req.query.lang === "string" ? req.query.lang : "";
  const headerLang = req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ?? "";
  return (queryLang || headerLang).trim().toLowerCase() || undefined;
}

function getRequestedCountry(req: Request) {
  const queryCountry = typeof req.query.countryCode === "string" ? req.query.countryCode : "";
  const headerCountry = typeof req.headers["x-country-code"] === "string" ? req.headers["x-country-code"] : "";
  return (queryCountry || headerCountry).trim().toUpperCase() || undefined;
}

function getOptionalCustomerId(req: Request) {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  if (!authHeader.startsWith("Bearer ")) return undefined;

  try {
    const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { id?: string; scope?: string };
    if (decoded.scope !== "customer" || !decoded.id) return undefined;
    return decoded.id;
  } catch {
    return undefined;
  }
}
