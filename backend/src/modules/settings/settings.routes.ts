import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./settings.controller";

const router = Router();

// Admin routes (protected)
router.get("/", protect, requirePermission("settings.manage"), C.get);
router.put("/", protect, requirePermission("settings.manage"), C.upsertMany);
router.post("/test-email", protect, requirePermission("settings.manage"), C.testEmail);
router.post("/test-sms", protect, requirePermission("settings.manage"), C.testSms);
router.post("/test-whatsapp", protect, requirePermission("settings.manage"), C.testWhatsapp);

// Public routes (no auth — mounted under /api/settings in app.ts)
router.get("/public/tracking", C.publicTracking);
router.get("/public/auth", C.publicAuth);
router.get("/public/sitemap-config", C.publicSitemap);
router.get("/public/robots", C.publicRobots);

export default router;
