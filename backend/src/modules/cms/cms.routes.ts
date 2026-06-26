import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./cms.controller";

const router = Router();
router.use(protect);

// ─── Pages ────────────────────────────────────────────────────────────────────
router.get("/pages", requirePermission("cms.view", "cms.manage"), C.listPages);
router.post("/pages", requirePermission("cms.manage"), C.createPage);
router.get("/pages/:id", requirePermission("cms.view", "cms.manage"), C.getPage);
router.put("/pages/:id", requirePermission("cms.manage"), C.updatePage);
router.delete("/pages/:id", requirePermission("cms.manage"), C.deletePage);

// ─── Sections (nested under pages) ───────────────────────────────────────────
router.get("/pages/:pageId/sections", requirePermission("cms.view", "cms.manage"), C.listSections);
router.post("/pages/:pageId/sections", requirePermission("cms.manage"), C.createSection);
router.put("/pages/:pageId/sections/reorder", requirePermission("cms.manage"), C.reorderSections);
router.put("/sections/:id", requirePermission("cms.manage"), C.updateSection);
router.delete("/sections/:id", requirePermission("cms.manage"), C.deleteSection);

// ─── Blocks (nested under sections) ──────────────────────────────────────────
router.get("/sections/:sectionId/blocks", requirePermission("cms.view", "cms.manage"), C.listBlocks);
router.post("/sections/:sectionId/blocks", requirePermission("cms.manage"), C.createBlock);
router.put("/sections/:sectionId/blocks/reorder", requirePermission("cms.manage"), C.reorderBlocks);
router.put("/blocks/:id", requirePermission("cms.manage"), C.updateBlock);
router.delete("/blocks/:id", requirePermission("cms.manage"), C.deleteBlock);
router.put("/translations/:entityType/:entityId/:languageId", requirePermission("cms.manage"), C.upsertCmsTranslation);

// ─── Footer ───────────────────────────────────────────────────────────────────
router.get("/footer", requirePermission("cms.view", "cms.manage"), C.getFooter);
router.put("/footer", requirePermission("cms.manage"), C.upsertFooter);

// ─── Menus ────────────────────────────────────────────────────────────────────
router.get("/menus", requirePermission("cms.view", "cms.manage"), C.listMenus);
router.post("/menus", requirePermission("cms.manage"), C.createMenu);
router.get("/menus/:id", requirePermission("cms.view", "cms.manage"), C.getMenu);
router.put("/menus/:id", requirePermission("cms.manage"), C.updateMenu);
router.delete("/menus/:id", requirePermission("cms.manage"), C.deleteMenu);
router.post("/menus/:menuId/items", requirePermission("cms.manage"), C.createMenuItem);
router.put("/menu-items/:id", requirePermission("cms.manage"), C.updateMenuItem);
router.delete("/menu-items/:id", requirePermission("cms.manage"), C.deleteMenuItem);

export default router;
