import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./coupons.controller";
const router = Router(); router.use(protect); router.get("/", C.list); router.post("/", C.create); router.put("/:id", C.update); router.delete("/:id", C.remove); router.post("/validate", C.validate); export default router;
