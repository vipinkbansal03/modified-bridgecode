import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerAddresses.controller";

const router = Router();
router.use(protectCustomer);

router.get("/", C.list);
router.post("/", C.create);
router.put("/:id", C.update);
router.delete("/:id", C.remove);
router.put("/:id/default", C.setDefault);

export default router;
