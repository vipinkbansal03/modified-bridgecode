import { Router } from "express";
import * as C from "./blogs.controller";

const router = Router();

router.get("/", C.publicList);
router.get("/:slug", C.publicGetOne);

export default router;
