import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./quotes.controller";
const router = Router(); router.use(protect);
router.get("/", C.list); router.get("/:id", C.getOne); router.put("/:id/status", C.updateStatus); router.post("/:id/notes", C.addNote); router.post("/:id/convert-to-order", C.convertToOrder);
export default router;
