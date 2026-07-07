import { Router } from "express";
import multer from "multer";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./currencies.controller";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.use(protect);
router.get("/", requirePermission("currencies.view", "currencies.manage"), C.list);
router.get("/simple", requirePermission("currencies.view", "currencies.manage"), C.simpleList);
router.get("/dashboard", requirePermission("currencies.view", "currencies.manage"), C.dashboard);
router.get("/export", requirePermission("currencies.view", "currencies.manage"), C.exportSpreadsheet);
router.post("/import/preview", requirePermission("currencies.manage"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("currencies.manage"), upload.single("file"), C.importSpreadsheet);
router.post("/bulk", requirePermission("currencies.manage"), C.bulk);
router.post("/sync-rates", requirePermission("currencies.manage"), C.syncRates);
router.post("/", requirePermission("currencies.manage"), C.create);
router.put("/:id", requirePermission("currencies.manage"), C.update);
router.delete("/:id", requirePermission("currencies.manage"), C.remove);

export default router;
