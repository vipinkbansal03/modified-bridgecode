import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerAddresses.controller";

const router = Router();
router.use(protectCustomer);

router.get("/", C.list);

export default router;
