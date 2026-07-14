import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as controller from "./contactSubmissions.controller";

const router = Router();

router.use(protect);

router.get(
  "/",
  requirePermission(
    "contactSubmissions.view",
    "contactSubmissions.manage"
  ),
  controller.listContactSubmissions
);
router.get(
  "/:id",
  requirePermission(
    "contactSubmissions.view",
    "contactSubmissions.manage"
  ),
  controller.getContactSubmission
);

export default router;