import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as whatsappAdminService from "./whatsappAdmin.service";

export const listTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = req.query || {};
  const templates = await whatsappAdminService.listTemplates(query);
  return ApiResponse.success(res, "Templates fetched successfully", { templates });
});

export const createTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const actorId = req.user?.id || null;
  const { payload, builder } = req.body;
  if (!payload) throw new AppError("Payload is required", 400);

  const result = await whatsappAdminService.createTemplateRecord(payload, actorId, builder);
  return ApiResponse.success(res, "Template created successfully", { template: result });
});

export const getTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const template = await whatsappAdminService.getTemplateById(id);
  if (!template) throw new AppError("Template not found", 404);

  return ApiResponse.success(res, "Template fetched successfully", { template });
});

export const updateTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const actorId = req.user?.id || null;
  const { payload, builder } = req.body;
  if (!payload) throw new AppError("Payload is required", 400);

  const template = await whatsappAdminService.updateTemplateRecord(id, payload, actorId, builder);
  return ApiResponse.success(res, "Template updated successfully", { template });
});

export const deleteTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const actorId = req.user?.id || null;
  const template = await whatsappAdminService.deleteTemplateRecord(id, actorId);
  return ApiResponse.success(res, "Template deleted successfully", { template, deleted: true });
});

export const refreshTemplateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const template = await whatsappAdminService.refreshTemplateStatus(id);
  return ApiResponse.success(res, "Template status refreshed", { template });
});

export const sendTestTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { to } = req.body;
  if (!to) throw new AppError("Recipient 'to' phone number is required", 400);

  const result = await whatsappAdminService.sendTestTemplate(id, to);
  return ApiResponse.success(res, "Test template message sent successfully", result);
});

export const getTemplateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { name, language } = req.query;
  if (!name || !language) throw new AppError("Name and language are required", 400);

  const result = await whatsappAdminService.getTemplateStatusDirect({
    name: String(name),
    language: String(language),
  });
  return ApiResponse.success(res, "Template status fetched successfully", { result });
});

export const getTemplateInsights = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = req.query || {};
  const result = await whatsappAdminService.getTemplateInsights(query);
  return ApiResponse.success(res, "Template insights fetched successfully", { result });
});

export const enableTemplateInsights = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await whatsappAdminService.enableTemplateInsights();
  return ApiResponse.success(res, "Template insights enabled", { result });
});

export const updateOptInOut = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await whatsappAdminService.updateOptInOut(req.body);
  return ApiResponse.success(res, "Opt-in/Opt-out status updated", { result });
});
