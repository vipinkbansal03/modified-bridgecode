import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./quotes.service";
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Quote created.", await S.createAdminQuote(req.body)));
export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listQuotes(req.query as never); return ApiResponse.paginated(res, "Quotes.", r.data, { page: r.page, limit: r.limit, total: r.total }); });
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Quote.", await S.getQuote(String(req.params.id))));
export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Status updated.", await S.updateStatus(String(req.params.id), req.body.status)));
export const updateReview = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Quote updated.", await S.updateQuoteReview(String(req.params.id), req.body)));
export const addNote = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Note added.", await S.addNote(String(req.params.id), req.user!.id, req.body.note)));
export const convertToOrder = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Converted to order.", await S.convertToOrder(String(req.params.id))));
