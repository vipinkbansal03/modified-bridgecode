import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./countries.controller";
const router = Router(); router.use(protect); router.get("/", C.list); router.post("/", C.create); router.put("/:id", C.update); export default router;
