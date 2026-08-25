import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./orderReturns.controller";

export const customerRouter = Router();
customerRouter.use(protectCustomer);
customerRouter.post("/", upload.array("attachments", 10), C.createReturn);
customerRouter.get("/", C.listCustomerReturns);
customerRouter.post("/:id/cancel", C.cancelReturn);

export const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get("/", requirePermission("orders.view", "orders.manage"), C.listAllReturns);
adminRouter.get("/:id", requirePermission("orders.view", "orders.manage"), C.getReturnDetails);
adminRouter.put("/:id/status", requirePermission("orders.manage"), C.updateReturnStatus);
