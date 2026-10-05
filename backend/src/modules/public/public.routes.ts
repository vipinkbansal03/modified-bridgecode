import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as C from "./public.controller";
import * as CMS from "../cms/cms.controller";
import * as PF from "../productFilters/productFilters.controller";

const router = Router();

// Tighter rate limit for public write endpoints
const formLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: "Too many submissions. Please wait and try again." },
});

// ─── CMS public endpoints ─────────────────────────────────
router.get("/cms/pages", CMS.publicPagesList);
router.get("/cms/pages/key/:pageKey", CMS.publicPageByKey);
router.get("/cms/pages/:slug", CMS.publicPageBySlug);
router.get("/cms/menus/:location", CMS.publicMenu);
router.get("/cms/footer", CMS.publicFooter);

// ─── Product Filters ──────────────────────────────────────
router.get("/product-filters", PF.publicConfig);

// ─── Read endpoints ───────────────────────────────────────
router.get("/products", C.listProducts);
router.get("/products/facets", C.listProductFacets);
router.get("/products/:slug", C.getProduct);
router.get("/products/:slug/reviews", C.getProductReviews);
router.post("/products/:slug/reviews", formLimiter, C.submitProductReview);
router.post("/products/:slug/price-preview", C.previewProductPrices);
router.post("/products/:slug/warehouses", C.getProductWarehouses);
router.get("/categories", C.listCategories);
router.get("/categories/:slug", C.getCategory);
router.get("/languages", C.getLanguages);
router.get("/translations/static", C.getStaticTranslations);
router.get("/search", C.search);
router.get("/currencies", C.getCurrencies);
router.get("/countries", C.getCountries);
router.get("/inventory", C.checkInventory);
router.post("/inventory", C.checkInventory);
router.get("/catalog-updates", C.getCatalogUpdates);

// ─── Write endpoints (form submissions) ──────────────────
router.post("/quotes", formLimiter, C.submitQuote);
router.post("/contact", formLimiter, C.submitContact);
router.post("/dealer-inquiry", formLimiter, C.submitContact); // alias

export default router;
