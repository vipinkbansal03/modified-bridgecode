import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./cms.service";

// ─── Pages ────────────────────────────────────────────────────────────────────

export const listPages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listPages(req.query as never);
  return ApiResponse.paginated(res, "Pages.", r.data, { page: r.page, limit: r.limit, total: r.total });
});

export const createPage = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Page created.", await S.createPage(req.body))
);

export const getPage = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page.", await S.getPage(String(req.params.id)))
);

export const updatePage = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page updated.", await S.updatePage(String(req.params.id), req.body))
);

export const deletePage = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deletePage(String(req.params.id));
  return ApiResponse.success(res, "Page deleted.", null);
});

// ─── Sections ─────────────────────────────────────────────────────────────────

export const listSections = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Sections.", await S.listSections(String(req.params.pageId)))
);

export const createSection = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Section created.", await S.createSection(String(req.params.pageId), req.body))
);

export const updateSection = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Section updated.", await S.updateSection(String(req.params.id), req.body))
);

export const deleteSection = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteSection(String(req.params.id));
  return ApiResponse.success(res, "Section deleted.", null);
});

export const reorderSections = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Sections reordered.", await S.reorderSections(String(req.params.pageId), req.body.orderedIds))
);

// ─── Blocks ───────────────────────────────────────────────────────────────────

export const listBlocks = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blocks.", await S.listBlocks(String(req.params.sectionId)))
);

export const createBlock = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Block created.", await S.createBlock(String(req.params.sectionId), req.body))
);

export const updateBlock = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Block updated.", await S.updateBlock(String(req.params.id), req.body))
);

export const deleteBlock = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteBlock(String(req.params.id));
  return ApiResponse.success(res, "Block deleted.", null);
});

export const reorderBlocks = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blocks reordered.", await S.reorderBlocks(String(req.params.sectionId), req.body.orderedIds))
);

export const upsertCmsTranslation = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Translation saved.", await S.upsertCmsTranslation(req.params.entityType as never, String(req.params.entityId), String(req.params.languageId), req.body))
);

// ─── Footer ───────────────────────────────────────────────────────────────────

export const getFooter = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Footer.", await S.getFooter())
);

export const upsertFooter = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Footer updated.", await S.upsertFooter(req.body))
);

// ─── Menus ────────────────────────────────────────────────────────────────────

export const listMenus = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menus.", await S.listMenus())
);

export const createMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Menu created.", await S.createMenu(req.body))
);

export const getMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu.", await S.getMenu(String(req.params.id)))
);

export const updateMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu updated.", await S.updateMenu(String(req.params.id), req.body))
);

export const deleteMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMenu(String(req.params.id));
  return ApiResponse.success(res, "Menu deleted.", null);
});

export const createMenuItem = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Menu item created.", await S.createMenuItem(String(req.params.menuId), req.body))
);

export const updateMenuItem = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu item updated.", await S.updateMenuItem(String(req.params.id), req.body))
);

export const deleteMenuItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMenuItem(String(req.params.id));
  return ApiResponse.success(res, "Menu item deleted.", null);
});

// ─── Public ───────────────────────────────────────────────────────────────────

export const publicPagesList = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Public pages.", await S.listPublicPages())
);

export const publicPageByKey = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page.", await S.publicGetPageByKey(String(req.params.pageKey), getRequestedLanguage(req)))
);

export const publicPageBySlug = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page.", await S.publicGetPageBySlug(String(req.params.slug), getRequestedLanguage(req)))
);

export const publicMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu.", await S.publicGetMenuByLocation(String(req.params.location), getRequestedLanguage(req)))
);

export const publicFooter = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Footer.", await S.publicGetFooter(getRequestedLanguage(req)))
);

function getRequestedLanguage(req: AuthRequest) {
  const queryLang = typeof req.query.lang === "string" ? req.query.lang : "";
  const headerLang = req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ?? "";
  return (queryLang || headerLang).trim().toLowerCase() || undefined;
}
