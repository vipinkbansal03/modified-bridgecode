import { Request, Response } from "express";
import { asyncHandler, ApiResponse, ApiResponse as AR } from "../../utils/apiResponse";
import * as S from "./public.service";

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  const result = await S.publicListProducts(req.query as never, getRequestedLanguage(req));
  return AR.paginated(res, "Products.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  const product = await S.publicGetProduct(String(req.params.slug), getRequestedLanguage(req));
  return AR.success(res, "Product.", product);
});

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  return AR.success(res, "Categories.", await S.publicListCategories(getRequestedLanguage(req)));
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
  return AR.success(res, "Search results.", await S.publicSearch(q, getRequestedLanguage(req)));
});

export const getCurrencies = asyncHandler(async (_req: Request, res: Response) => {
  return AR.success(res, "Currencies.", await S.getPublicCurrencies());
});

export const getCountries = asyncHandler(async (_req: Request, res: Response) => {
  return AR.success(res, "Countries.", await S.getPublicCountries());
});

export const checkInventory = asyncHandler(async (req: Request, res: Response) => {
  const ids = (req.query.variantIds as string || "").split(",").filter(Boolean);
  return AR.success(res, "Inventory.", await S.checkInventory(ids));
});

function getRequestedLanguage(req: Request) {
  const queryLang = typeof req.query.lang === "string" ? req.query.lang : "";
  const headerLang = req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ?? "";
  return (queryLang || headerLang).trim().toLowerCase() || undefined;
}
