import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./currencies.controller";
const router = Router(); router.use(protect); router.get("/", C.list); router.post("/", C.create); router.put("/:id", C.update); router.post("/sync-rates", C.syncRates); export default router;
