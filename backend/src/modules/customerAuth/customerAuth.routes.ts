import { Router } from "express";
import * as C from "./customerAuth.controller";

const router = Router();

router.post("/register", C.register);
router.post("/login", C.login);
router.post("/forgot-password", C.forgotPassword);
router.post("/reset-password", C.resetPassword);

export default router;
