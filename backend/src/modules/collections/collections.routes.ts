import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as CollectionsController from "./collections.controller";

const router = Router();

router.use(protect);
router.get("/", CollectionsController.list);
router.post("/", CollectionsController.create);
router.get("/:id", CollectionsController.getOne);
router.put("/:id", CollectionsController.update);
router.delete("/:id", CollectionsController.remove);
router.get("/:id/countries", CollectionsController.listCountries);
router.put("/:id/countries", CollectionsController.updateCountries);

export default router;
