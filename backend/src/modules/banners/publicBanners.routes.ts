import { Router } from "express";
import * as C from "./banners.controller";

const router = Router();

router.get("/", C.publicList);

export default router;
