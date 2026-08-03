import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./shipping.controller";

const router = Router();
router.use(protect);

// ─── Providers ──────────────────────────────────────────
router.get("/providers", requirePermission("shipping.view", "shipping.manage"), C.listProviders);
router.get("/providers/:id", requirePermission("shipping.view", "shipping.manage"), C.getProvider);
router.post("/providers", requirePermission("shipping.manage"), C.upsertProvider);
router.post("/providers/:id/toggle", requirePermission("shipping.manage"), C.toggleProvider);
router.post("/providers/:id/test-connection", requirePermission("shipping.manage"), C.testConnection);
router.post("/providers/:id/default-rate", requirePermission("shipping.view", "shipping.manage"), C.getDefaultRate);

// ─── Zones ──────────────────────────────────────────────
router.get("/zones", requirePermission("shipping.view", "shipping.manage"), C.listZones);
router.post("/zones", requirePermission("shipping.manage"), C.createZone);
router.put("/zones/:id", requirePermission("shipping.manage"), C.updateZone);
router.delete("/zones/:id", requirePermission("shipping.manage"), C.deleteZone);

// ─── Calculation (admin) ────────────────────────────────
router.post("/calculate", requirePermission("shipping.view", "shipping.manage"), C.calculate);
router.post("/calculate-packages", requirePermission("shipping.view", "shipping.manage"), C.calculatePackages);

// ─── Shipments ──────────────────────────────────────────
router.get("/shipments", requirePermission("shipping.view", "shipping.manage"), C.listShipments);
router.get("/shipments/:id", requirePermission("shipping.view", "shipping.manage"), C.getShipment);
router.post("/shipments", requirePermission("shipping.manage"), C.createShipment);
router.put("/shipments/:id", requirePermission("shipping.manage"), C.updateShipment);
router.post("/shipments/:id/status", requirePermission("shipping.manage"), C.updateShipmentStatus);
router.post("/shipments/:id/events", requirePermission("shipping.manage"), C.addShipmentEvent);
router.post("/shipments/:id/track", requirePermission("shipping.view", "shipping.manage"), C.trackShipment);
router.post("/shipments/:id/cancel", requirePermission("shipping.manage"), C.cancelShipment);
router.delete("/shipments/:id", requirePermission("shipping.manage"), C.deleteShipment);

// ─── Order shipments lookup ─────────────────────────────
router.get("/order/:orderId", requirePermission("shipping.view", "shipping.manage"), C.getShipmentsForOrder);

export default router;
