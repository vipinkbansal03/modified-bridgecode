import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import { upload } from "../../middleware/upload.middleware"; import * as C from "./media.controller";
const router = Router(); router.use(protect);
router.get("/", C.list); router.post("/", upload.array("files", 20), C.upload); router.delete("/:id", C.remove);
export default router;
