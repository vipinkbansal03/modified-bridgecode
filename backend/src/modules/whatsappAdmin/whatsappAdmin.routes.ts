import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as whatsappAdminController from "./whatsappAdmin.controller";

const router = Router();

router.use(protect);
router.use(requirePermission("manage_settings"));

router.get("/templates", whatsappAdminController.listTemplates);
router.post("/templates", whatsappAdminController.createTemplate);
router.get("/templates/status", whatsappAdminController.getTemplateStatus);
router.get("/templates/insights", whatsappAdminController.getTemplateInsights);
router.get("/templates/insights-by-name", whatsappAdminController.getTemplateInsights);
router.post("/templates/insights/optin", whatsappAdminController.enableTemplateInsights);
router.get("/templates/:id", whatsappAdminController.getTemplate);
router.patch("/templates/:id", whatsappAdminController.updateTemplate);
router.delete("/templates/:id", whatsappAdminController.deleteTemplate);
router.post("/templates/:id/refresh", whatsappAdminController.refreshTemplateStatus);
router.post("/templates/:id/send-test", whatsappAdminController.sendTestTemplate);
router.post("/consent", whatsappAdminController.updateOptInOut);

export default router;
