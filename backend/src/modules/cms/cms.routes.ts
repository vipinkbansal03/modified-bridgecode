import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./cms.controller";

const router = Router();
router.use(protect);

// ─── Pages ────────────────────────────────────────────────────────────────────
router.get("/pages", C.listPages);
router.post("/pages", C.createPage);
router.get("/pages/:id", C.getPage);
router.put("/pages/:id", C.updatePage);
router.delete("/pages/:id", C.deletePage);

// ─── Sections (nested under pages) ───────────────────────────────────────────
router.get("/pages/:pageId/sections", C.listSections);
router.post("/pages/:pageId/sections", C.createSection);
router.put("/pages/:pageId/sections/reorder", C.reorderSections);
router.put("/sections/:id", C.updateSection);
router.delete("/sections/:id", C.deleteSection);

// ─── Blocks (nested under sections) ──────────────────────────────────────────
router.get("/sections/:sectionId/blocks", C.listBlocks);
router.post("/sections/:sectionId/blocks", C.createBlock);
router.put("/sections/:sectionId/blocks/reorder", C.reorderBlocks);
router.put("/blocks/:id", C.updateBlock);
router.delete("/blocks/:id", C.deleteBlock);
router.put("/translations/:entityType/:entityId/:languageId", C.upsertCmsTranslation);

// ─── Footer ───────────────────────────────────────────────────────────────────
router.get("/footer", C.getFooter);
router.put("/footer", C.upsertFooter);

// ─── Menus ────────────────────────────────────────────────────────────────────
router.get("/menus", C.listMenus);
router.post("/menus", C.createMenu);
router.get("/menus/:id", C.getMenu);
router.put("/menus/:id", C.updateMenu);
router.delete("/menus/:id", C.deleteMenu);
router.post("/menus/:menuId/items", C.createMenuItem);
router.put("/menu-items/:id", C.updateMenuItem);
router.delete("/menu-items/:id", C.deleteMenuItem);

export default router;
