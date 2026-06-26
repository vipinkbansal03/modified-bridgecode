import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerOrders.controller";

const router = Router();
router.use(protectCustomer);

router.get("/", C.list);
router.get("/:id/invoice", C.invoice);
router.post("/estimate", C.estimate);
router.post("/", C.create);

export default router;
