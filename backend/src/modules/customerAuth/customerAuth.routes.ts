import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerAuth.controller";

const router = Router();

router.post("/register", C.register);
router.post("/login", C.login);
router.post("/forgot-password", C.forgotPassword);
router.post("/reset-password", C.resetPassword);

router.get("/me", protectCustomer, C.getMe);
router.put("/profile", protectCustomer, C.updateProfile);

export default router;
