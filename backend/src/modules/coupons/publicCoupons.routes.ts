import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./coupons.controller";

const router = Router();

router.post("/validate", protectCustomer, C.validateCheckout);

export default router;
