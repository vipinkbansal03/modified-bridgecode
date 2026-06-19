import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./shipping.controller";

const router = Router();
router.use(protect);

router.get("/providers", C.listProviders);
router.post("/providers", C.upsertProvider);
router.get("/zones", C.listZones);
router.post("/zones", C.createZone);
router.put("/zones/:id", C.updateZone);
router.post("/calculate", C.calculate);

export default router;
