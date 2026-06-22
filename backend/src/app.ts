import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";
import "dotenv/config";

import { errorMiddleware } from "./middleware/error.middleware";
import { logger } from "./config/logger";

// Module routes
import webhookRoutes from "./modules/webhooks/webhooks.routes";
import publicRoutes from "./modules/public/public.routes";
import authRoutes from "./modules/auth/auth.routes";
import productRoutes from "./modules/products/products.routes";
import categoryRoutes from "./modules/categories/categories.routes";
import attributeRoutes from "./modules/attributes/attributes.routes";
import inventoryRoutes from "./modules/inventory/inventory.routes";
import pricingRoutes from "./modules/pricing/pricing.routes";
import currencyRoutes from "./modules/currencies/currencies.routes";
import countryRoutes from "./modules/countries/countries.routes";
import couponRoutes from "./modules/coupons/coupons.routes";
import quoteRoutes from "./modules/quotes/quotes.routes";
import orderRoutes from "./modules/orders/orders.routes";
import shippingRoutes from "./modules/shipping/shipping.routes";
import paymentRoutes from "./modules/payments/payments.routes";
import mediaRoutes from "./modules/media/media.routes";
import translationRoutes from "./modules/translations/translations.routes";
import aiRoutes from "./modules/ai/ai.routes";
import settingsRoutes from "./modules/settings/settings.routes";
import logRoutes from "./modules/logs/logs.routes";
import userRoutes from "./modules/users/users.routes";
import roleRoutes from "./modules/roles/roles.routes";
import cmsRoutes from "./modules/cms/cms.routes";

const app = express();

// ─── Security middleware ─────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
app.use(limiter);

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
app.use("/api/settings", settingsRoutes); // public tracking/robots/sitemap sub-routes

// ─── API Routes ──────────────────────────────────────────
const API = "/api/admin";

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/products`, productRoutes);
app.use(`${API}/categories`, categoryRoutes);
app.use(`${API}/attributes`, attributeRoutes);
app.use(`${API}/inventory`, inventoryRoutes);
app.use(`${API}/pricing`, pricingRoutes);
app.use(`${API}/currencies`, currencyRoutes);
app.use(`${API}/countries`, countryRoutes);
app.use(`${API}/coupons`, couponRoutes);
app.use(`${API}/quotes`, quoteRoutes);
app.use(`${API}/orders`, orderRoutes);
app.use(`${API}/shipping`, shippingRoutes);
app.use(`${API}/payments`, paymentRoutes);
app.use(`${API}/media`, mediaRoutes);
app.use(`${API}/translations`, translationRoutes);
app.use(`${API}/ai`, aiRoutes);
app.use(`${API}/settings`, settingsRoutes);
app.use(`${API}/logs`, logRoutes);
app.use(`${API}/users`, userRoutes);
app.use(`${API}/roles`, roleRoutes);
app.use(`${API}/cms`, cmsRoutes);

// ─── 404 ─────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found." });
});

// ─── Centralized error handler ───────────────────────────
app.use(errorMiddleware);

export default app;
