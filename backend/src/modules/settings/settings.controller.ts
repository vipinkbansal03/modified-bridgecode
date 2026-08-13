import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./settings.service";

// Admin
export const get = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Settings.", await S.getSettings(req.query.group as string | undefined))
);

export const upsertMany = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Settings saved.", await S.upsertMany(req.body.settings))
);

// Public
export const publicTracking = asyncHandler(async (req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-cache, must-revalidate");
  const country = req.query.country as string | undefined;
  return ApiResponse.success(res, "Tracking settings.", await S.getPublicTrackingSettings(country));
});

export const publicAuth = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "no-store");
  return ApiResponse.success(res, "Auth page settings.", await S.getPublicAuthSettings());
});

export const publicSitemap = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Sitemap settings.", await S.getSitemapSettings())
);

export const publicRobots = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const { robotsTxt } = await S.getSitemapSettings();
  const content = robotsTxt ?? `User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: ${process.env.FRONTEND_URL ?? ""}/sitemap.xml`;
  res.setHeader("Content-Type", "text/plain");
  res.send(content);
});
