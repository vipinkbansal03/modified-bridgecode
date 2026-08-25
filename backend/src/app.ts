import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

import { errorMiddleware } from "./middleware/error.middleware";
import { logger } from "./config/logger";

// Module routes
import webhookRoutes from "./modules/webhooks/webhooks.routes";
import publicRoutes from "./modules/public/public.routes";
import authRoutes from "./modules/auth/auth.routes";
import customerAuthRoutes from "./modules/customerAuth/customerAuth.routes";
import customerAddressRoutes from "./modules/customerAddresses/customerAddresses.routes";
import customerOrderRoutes from "./modules/customerOrders/customerOrders.routes";
import customerQuoteRoutes from "./modules/customerQuotes/customerQuotes.routes";
import customerWishlistRoutes from "./modules/wishlist/wishlist.routes";
import customerRoutes from "./modules/customers/customers.routes";
import customerRoleRoutes from "./modules/customerRoles/customerRoles.routes";
import tierRoutes from "./modules/tiers/tiers.routes";
import productRoutes from "./modules/products/products.routes";
import categoryRoutes from "./modules/categories/categories.routes";
import collectionRoutes from "./modules/collections/collections.routes";
import attributeRoutes from "./modules/attributes/attributes.routes";
import productFilterRoutes from "./modules/productFilters/productFilters.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import warehouseRoutes from "./modules/warehouse/warehouse.routes";
import pricingRoutes from "./modules/pricing/pricing.routes";
import taxRoutes from "./modules/tax/tax.routes";
import discountRoutes from "./modules/discounts/discounts.routes";
import currencyRoutes from "./modules/currencies/currencies.routes";
import countryRoutes from "./modules/countries/countries.routes";
import couponRoutes from "./modules/coupons/coupons.routes";
import publicCouponRoutes from "./modules/coupons/publicCoupons.routes";
import quoteRoutes from "./modules/quotes/quotes.routes";
import contactSubmissionRoutes from "./modules/contactSubmissions/contactSubmissions.routes";
import { publicRouter as newsletterPublicRoutes, adminRouter as newsletterAdminRoutes } from "./modules/newsletter/newsletter.routes";
import orderRoutes from "./modules/orders/orders.routes";
import notificationsRoutes from "./modules/notifications/notifications.routes";
import whatsappRoutes from "./modules/whatsappAdmin/whatsappAdmin.routes";
import shippingRoutes from "./modules/shipping/shipping.routes";
import publicShippingRoutes from "./modules/shipping/publicShipping.routes";
import shippingBoxRoutes from "./modules/shippingBoxes/shippingBoxes.routes";
import paymentRoutes from "./modules/payments/payments.routes";
import mediaRoutes from "./modules/media/media.routes";
import translationRoutes from "./modules/translations/translations.routes";
import aiRoutes from "./modules/ai/ai.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import logRoutes from "./modules/logs/logs.routes";
import userRoutes from "./modules/users/users.routes";
import roleRoutes from "./modules/roles/roles.routes";
import cmsRoutes from "./modules/cms/cms.routes";
import blogRoutes from "./modules/blogs/blogs.routes";
import publicBlogRoutes from "./modules/blogs/publicBlogs.routes";
import bannerRoutes from "./modules/banners/banners.routes";
import publicBannerRoutes from "./modules/banners/publicBanners.routes";

import reviewRoutes from "./modules/reviews/reviews.routes";
import paymentMethodsRoutes from "./modules/payment/paymentMethods.routes";
import { customerRouter as orderReturnCustomerRoutes, adminRouter as orderReturnAdminRoutes } from "./modules/orderReturns/orderReturns.routes";

const app = express();

// ─── Security middleware ─────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ],
  credentials: true,
}));

// ─── Payment webhooks (raw body — must be before express.json()) ────────────
app.use("/api/webhooks", webhookRoutes);

// ─── Rate limiting ───────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 200,
  message: { success: false, message: "Too many requests. Please slow down." },
});
// app.use(limiter);

// ─── Body parsing ────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Static uploads (local storage) ─────────────────────
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// ─── Request logger ──────────────────────────────────────
app.use((req, _res, next) => {
  logger.http(`${req.method} ${req.path}`);
  next();
});

// ─── Health check ────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ success: true, message: "Modern Orthodontics API is running.", env: process.env.NODE_ENV });
});

// ─── Public API Routes (no auth) ─────────────────────────
app.use("/api", publicRoutes);
app.use("/api", paymentMethodsRoutes);
app.use("/api/settings", settingsRoutes); // public tracking/robots/sitemap sub-routes

// ─── API Routes ──────────────────────────────────────────
const API = "/api/admin";

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/collections`, collectionRoutes);
app.use(`${API}/attributes`, attributeRoutes);
app.use(`${API}/product-filters`, productFilterRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/warehouses`, warehouseRoutes);
app.use(`${API}/pricing`, pricingRoutes);
app.use(`${API}/tax-rules`, taxRoutes);
app.use(`${API}/discounts`, discountRoutes);
app.use(`${API}/currencies`, currencyRoutes);
app.use(`${API}/countries`, countryRoutes);
app.use(`${API}/coupons`, couponRoutes);
app.use(`${API}/quotes`, quoteRoutes);
app.use(`${API}/contact-submissions`, contactSubmissionRoutes);
app.use(`${API}/newsletter`, newsletterAdminRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/order-returns`, orderReturnAdminRoutes);
app.use(`${API}/customers`, customerRoutes);
app.use(`${API}/customer-roles`, customerRoleRoutes);
app.use(`${API}/tiers`, tierRoutes);
app.use(`${API}/shipping`, shippingRoutes);
app.use(`${API}/shipping/boxes`, shippingBoxRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/media`, mediaRoutes);
app.use(`${API}/translations`, translationRoutes);
app.use(`${API}/ai`, aiRoutes);
app.use(`${API}/settings`, settingsRoutes);
app.use(`${API}/logs`, logRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/roles`, roleRoutes);
app.use(`${API}/cms`, cmsRoutes);
app.use(`${API}/blogs`, blogRoutes);
app.use(`${API}/banners`, bannerRoutes);
app.use(`${API}/reviews`, reviewRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use(`${API}/whatsapp`, whatsappRoutes);
app.use("/api/customer/auth", customerAuthRoutes);
app.use("/api/newsletter", newsletterPublicRoutes);
app.use("/api/customer/addresses", customerAddressRoutes);
app.use("/api/customer/orders", customerOrderRoutes);
app.use("/api/customer/quotes", customerQuoteRoutes);
app.use("/api/customer/wishlist", customerWishlistRoutes);
app.use("/api/wishlist", customerWishlistRoutes);
app.use("/api/customer/tax-rules", taxRoutes);
app.use("/api/shipping", publicShippingRoutes);
app.use("/api/coupons", publicCouponRoutes);
app.use("/api/blogs", publicBlogRoutes);
app.use("/api/banners", publicBannerRoutes);
app.use("/api/customer/order-returns", orderReturnCustomerRoutes);

// ─── 404 ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Centralized error handler ───────────────────────────
app.use(errorMiddleware);

export default app;
