import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./media.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("media.view", "media.manage"), C.list);
router.post("/", requirePermission("media.manage"), upload.array("files", 20), C.upload);
router.delete("/by-url", requirePermission("media.manage"), C.removeByUrl);
router.delete("/:id", requirePermission("media.manage"), C.remove);

router.get("/config", requirePermission("media.manage"), C.config);
router.get("/folders", requirePermission("media.manage"), C.folders);
router.post("/presign", requirePermission("media.manage"), C.presign);
router.post("/confirm", requirePermission("media.manage"), C.confirm);

export default router;
