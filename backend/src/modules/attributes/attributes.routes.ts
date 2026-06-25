import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./attributes.controller";

const router = Router();
router.use(protect);

router.get("/", C.list);
router.post("/", C.create);
router.put("/reorder", C.reorder);

router.get("/:id", C.getOne);
router.put("/:id", C.update);
router.delete("/:id", C.remove);

router.get("/:id/values", C.listValues);
router.put("/:id/values/reorder", C.reorderValues);
router.post("/:id/values", C.addValue);
router.put("/:id/values/:valueId", C.updateValue);
router.delete("/:id/values/:valueId", C.removeValue);

export default router;
