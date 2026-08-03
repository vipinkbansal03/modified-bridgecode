import { Request, Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import * as service from "./newsletter.service";
import { prisma } from "../../config/database";
import { sendNewsletterWelcomeEmail } from "../../utils/email";

export const publicSubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required.", 400);
  }

  const { subscriber, alreadyActive } = await service.subscribe(email, "FOOTER");

  if (!alreadyActive) {
    // Send transactional welcome email
    await sendNewsletterWelcomeEmail(subscriber.email);
  }

  return ApiResponse.success(res, "Successfully subscribed to the newsletter.", { ...subscriber, alreadyActive });
});

export const publicUnsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    throw new AppError("Email is required.", 400);
  }

  const { subscriber, alreadyUnsubscribed } = await service.unsubscribe(email);
  return ApiResponse.success(res, "Successfully unsubscribed from the newsletter.", { ...subscriber, alreadyUnsubscribed });
});

export const adminListSubscribers = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listSubscribers(req.query);
  return ApiResponse.paginated(
    res,
    "Newsletter subscribers fetched successfully.",
    result.data,
    result.pagination
  );
});

export const adminCreateSubscriber = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body;
  const subscriber = await service.createManual(email);
  return ApiResponse.success(res, "Subscriber registered manually.", subscriber);
});

export const adminUpdateStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  const subscriber = await service.updateStatus(id as string, status as string);
  return ApiResponse.success(res, "Subscriber status updated successfully.", subscriber);
});
