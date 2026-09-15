import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerAuth.controller";

const router = Router();

router.post("/register", C.register);
router.post("/register/initiate", C.initiateRegister);
router.post("/register/verify-otp", C.verifyRegisterOtp);
router.post("/login", C.login);
router.post("/login/send-otp", C.sendLoginOtp);
router.post("/login/verify-otp", C.verifyLoginOtp);
router.post("/otp/resend", C.resendOtp);
router.post("/forgot-password", C.forgotPassword);
router.post("/reset-password", C.resetPassword);

router.get("/me", protectCustomer, C.getMe);
router.put("/profile", protectCustomer, C.updateProfile);

export default router;
