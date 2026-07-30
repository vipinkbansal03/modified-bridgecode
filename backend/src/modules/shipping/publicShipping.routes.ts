import { Router } from "express";
import * as C from "./shipping.controller";

const router = Router();

router.post("/calculate", C.calculatePublic);
router.post("/available-providers", C.availableProviders);

export default router;
