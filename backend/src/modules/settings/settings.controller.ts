import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./settings.service";

import { sendTestEmailDirectly } from "../../utils/email";

// Admin
export const get = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Settings.", await S.getSettings(req.query.group as string | undefined))
);

export const upsertMany = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Settings saved.", await S.upsertMany(req.body.settings))
);

export const testEmail = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { toEmail, provider } = req.body;
  if (!toEmail) {
    return ApiResponse.error(res, "Recipient email address is required.", [], 400);
  }
  const result = await sendTestEmailDirectly(toEmail, provider);
  if (!result.success) {
    return ApiResponse.error(res, result.message, [], 400);
  }
  return ApiResponse.success(res, result.message, result);
});

export const testSms = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone) {
    return ApiResponse.error(res, "Recipient phone number is required.", [], 400);
  }
  const testOtp = otp || "123456";
  const { sendMsg91Otp, resolveMsg91Config } = await import("../notifications/msg91Provider");
  const config = await resolveMsg91Config();
  if (!config.authKey) {
    return ApiResponse.error(
      res,
      "MSG91 AuthKey is not configured. Please save your MSG91 AuthKey in Email or SMS settings.",
      [],
      400
    );
  }
  try {
    const result = await sendMsg91Otp(phone, testOtp);
    return ApiResponse.success(res, `Test OTP (${testOtp}) dispatched successfully to ${phone} via MSG91!`, result);
  } catch (err: any) {
    return ApiResponse.error(res, `MSG91 SMS failed: ${err.message}`, [], 400);
  }
});

export const testWhatsapp = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { phone, message } = req.body;
  if (!phone) {
    return ApiResponse.error(res, "Recipient phone number is required.", [], 400);
  }
  const testMessage = message || "Hello from Modern Orthodontics! This is a test WhatsApp notification.";
  const { sendMsg91WhatsAppText, resolveMsg91Config } = await import("../notifications/msg91Provider");
  const config = await resolveMsg91Config();
  if (!config.authKey) {
    return ApiResponse.error(
      res,
      "MSG91 AuthKey is not configured. Please save your MSG91 AuthKey in Email or WhatsApp settings.",
      [],
      400
    );
  }
  if (!config.whatsappNumber) {
    return ApiResponse.error(
      res,
      "MSG91 WhatsApp Integrated Number is not configured. Please enter your verified WhatsApp number.",
      [],
      400
    );
  }
  try {
    const result = await sendMsg91WhatsAppText(phone, testMessage);
    return ApiResponse.success(res, `Test WhatsApp message sent successfully to ${phone} via MSG91!`, result);
  } catch (err: any) {
    return ApiResponse.error(res, `MSG91 WhatsApp failed: ${err.message}`, [], 400);
  }
});

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
