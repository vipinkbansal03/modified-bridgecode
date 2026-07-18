import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerQuotes.controller";

const router = Router();

router.use(protectCustomer);

router.get("/", C.list);
router.get("/:id", C.getOne);

export default router;