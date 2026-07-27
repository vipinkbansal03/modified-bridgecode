import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./wishlist.controller";

const router = Router();
router.use(protectCustomer);

router.get("/", C.list);
router.post("/", C.add);
router.delete("/:productId", C.remove);
router.post("/toggle", C.toggle);
router.get("/count", C.count);

export default router;
