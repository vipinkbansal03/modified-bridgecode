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
  ApiResponse.success(res, "Page.", await S.getPage(req.params.id))
);

export const updatePage = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page updated.", await S.updatePage(req.params.id, req.body))
);

export const deletePage = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deletePage(req.params.id);
  return ApiResponse.success(res, "Page deleted.", null);
});

// ─── Sections ─────────────────────────────────────────────────────────────────

export const listSections = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Sections.", await S.listSections(req.params.pageId))
);

export const createSection = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Section created.", await S.createSection(req.params.pageId, req.body))
);

export const updateSection = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Section updated.", await S.updateSection(req.params.id, req.body))
);

export const deleteSection = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteSection(req.params.id);
  return ApiResponse.success(res, "Section deleted.", null);
});

export const reorderSections = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Sections reordered.", await S.reorderSections(req.params.pageId, req.body.orderedIds))
);

// ─── Blocks ───────────────────────────────────────────────────────────────────

export const listBlocks = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blocks.", await S.listBlocks(req.params.sectionId))
);

export const createBlock = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Block created.", await S.createBlock(req.params.sectionId, req.body))
);

export const updateBlock = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Block updated.", await S.updateBlock(req.params.id, req.body))
);

export const deleteBlock = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteBlock(req.params.id);
  return ApiResponse.success(res, "Block deleted.", null);
});

export const reorderBlocks = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blocks reordered.", await S.reorderBlocks(req.params.sectionId, req.body.orderedIds))
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
  ApiResponse.success(res, "Menu.", await S.getMenu(req.params.id))
);

export const updateMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu updated.", await S.updateMenu(req.params.id, req.body))
);

export const deleteMenu = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMenu(req.params.id);
  return ApiResponse.success(res, "Menu deleted.", null);
});

export const createMenuItem = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Menu item created.", await S.createMenuItem(req.params.menuId, req.body))
);

export const updateMenuItem = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu item updated.", await S.updateMenuItem(req.params.id, req.body))
);

export const deleteMenuItem = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMenuItem(req.params.id);
  return ApiResponse.success(res, "Menu item deleted.", null);
});

// ─── Public ───────────────────────────────────────────────────────────────────

export const publicPageByKey = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page.", await S.publicGetPageByKey(req.params.pageKey))
);

export const publicPageBySlug = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Page.", await S.publicGetPageBySlug(req.params.slug))
);

export const publicMenu = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Menu.", await S.publicGetMenuByLocation(req.params.location))
);

export const publicFooter = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Footer.", await S.publicGetFooter())
);
