import { Router } from "express"; import { protect, requirePermission } from "../../middleware/auth.middleware"; import * as C from "./quotes.controller";
const router = Router(); router.use(protect);
router.post("/", requirePermission("quotes.manage"), C.create);
router.get("/", requirePermission("quotes.view", "quotes.manage"), C.list); router.get("/:id", requirePermission("quotes.view", "quotes.manage"), C.getOne); router.put("/:id/status", requirePermission("quotes.manage"), C.updateStatus); router.put("/:id/review", requirePermission("quotes.manage"), C.updateReview); router.post("/:id/notes", requirePermission("quotes.manage"), C.addNote); router.post("/:id/convert-to-order", requirePermission("quotes.manage"), C.convertToOrder);
export default router;
