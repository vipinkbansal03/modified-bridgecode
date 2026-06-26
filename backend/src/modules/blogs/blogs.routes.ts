import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./blogs.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("cms.view", "cms.manage"), C.list);
router.post("/", requirePermission("cms.manage"), C.create);
router.post("/bulk", requirePermission("cms.manage"), C.bulk);
router.get("/categories", requirePermission("cms.view", "cms.manage"), C.listCategories);
router.post("/categories", requirePermission("cms.manage"), C.createCategory);
router.put("/categories/:id", requirePermission("cms.manage"), C.updateCategory);
router.delete("/categories/:id", requirePermission("cms.manage"), C.deleteCategory);
router.get("/authors", requirePermission("cms.view", "cms.manage"), C.listAuthors);
router.post("/authors", requirePermission("cms.manage"), C.createAuthor);
router.put("/authors/:id", requirePermission("cms.manage"), C.updateAuthor);
router.delete("/authors/:id", requirePermission("cms.manage"), C.deleteAuthor);
router.get("/:id", requirePermission("cms.view", "cms.manage"), C.getOne);
router.put("/:id", requirePermission("cms.manage"), C.update);
router.delete("/:id", requirePermission("cms.manage"), C.remove);

export default router;
