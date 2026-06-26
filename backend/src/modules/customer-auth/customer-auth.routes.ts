import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, register } from "./customer-auth.controller";
import { protectCustomer } from "./customer-auth.middleware";

const router = Router();

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many registration attempts. Please wait and try again.",
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many login attempts. Please wait and try again.",
  },
});

router.post("/register", registerLimiter, register);
router.post("/login", loginLimiter, login);
router.post("/logout", protectCustomer, logout);
router.get("/me", protectCustomer, me);

export default router;
