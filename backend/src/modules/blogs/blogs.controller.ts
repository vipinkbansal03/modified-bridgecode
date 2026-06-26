import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as BlogsService from "./blogs.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await BlogsService.listBlogs(req.query as never);
  return ApiResponse.paginated(res, "Blogs fetched.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog fetched.", await BlogsService.getBlog(String(req.params.id)))
);

export const create = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Blog created.", await BlogsService.createBlog(req.body))
);

export const update = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog updated.", await BlogsService.updateBlog(String(req.params.id), req.body))
);

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await BlogsService.deleteBlog(String(req.params.id));
  return ApiResponse.success(res, "Blog deleted.");
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Bulk blog action complete.", await BlogsService.bulkUpdateBlogs(req.body))
);

export const listCategories = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog categories fetched.", await BlogsService.listBlogCategories())
);
export const createCategory = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Blog category created.", await BlogsService.createBlogCategory(req.body))
);
export const updateCategory = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog category updated.", await BlogsService.updateBlogCategory(String(req.params.id), req.body))
);
export const deleteCategory = asyncHandler(async (req: AuthRequest, res: Response) => {
  await BlogsService.deleteBlogCategory(String(req.params.id));
  return ApiResponse.success(res, "Blog category deleted.");
});

export const listAuthors = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog authors fetched.", await BlogsService.listBlogAuthors())
);
export const createAuthor = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Blog author created.", await BlogsService.createBlogAuthor(req.body))
);
export const updateAuthor = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Blog author updated.", await BlogsService.updateBlogAuthor(String(req.params.id), req.body))
);
export const deleteAuthor = asyncHandler(async (req: AuthRequest, res: Response) => {
  await BlogsService.deleteBlogAuthor(String(req.params.id));
  return ApiResponse.success(res, "Blog author deleted.");
});

export const publicList = asyncHandler(async (req, res: Response) => {
  const result = await BlogsService.listPublicBlogs(req.query as never);
  return ApiResponse.paginated(res, "Blogs fetched.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const publicGetOne = asyncHandler(async (req, res: Response) =>
  ApiResponse.success(res, "Blog fetched.", await BlogsService.getPublicBlog(String(req.params.slug)))
);
