import { Response } from 'express';
import { asyncHandler, ApiResponse, AppError } from '../../utils/apiResponse';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CustomerAuthRequest } from '../../middleware/customerAuth.middleware';
import { notificationsService } from './notifications.service';

export const registerAdminToken = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  const { token, deviceType } = req.body;
  if (!token) throw new AppError('Token is required', 400);

  const device = await notificationsService.registerDeviceToken({
    token,
    deviceType,
    userId: req.user.id,
  });
  return ApiResponse.success(res, 'Token registered', device);
});

export const registerCustomerToken = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer?.id) throw new AppError('Unauthorized', 401);
  const { token, deviceType } = req.body;
  if (!token) throw new AppError('Token is required', 400);

  const device = await notificationsService.registerDeviceToken({
    token,
    deviceType,
    customerId: req.customer.id,
  });
  return ApiResponse.success(res, 'Token registered', device);
});

export const getMyAdminNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.user?.id) throw new AppError('Unauthorized', 401);
  const notifications = await notificationsService.getNotificationsForUser(req.user.id);
  return ApiResponse.success(res, 'Notifications fetched', notifications);
});

export const getMyCustomerNotifications = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer?.id) throw new AppError('Unauthorized', 401);
  const notifications = await notificationsService.getNotificationsForCustomer(req.customer.id);
  return ApiResponse.success(res, 'Notifications fetched', notifications);
});

export const getAllSystemNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const notifications = await notificationsService.getAdminAllNotifications();
  return ApiResponse.success(res, 'All notifications fetched', notifications);
});

export const markAsRead = asyncHandler(async (req: AuthRequest | CustomerAuthRequest, res: Response) => {
  const notification = await notificationsService.markAsRead(req.params.id);
  return ApiResponse.success(res, 'Notification marked as read', notification);
});

export const sendManualNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, message, targetType, userId, customerId, link } = req.body;
  if (!title || !message) throw new AppError('Title and message are required', 400);

  const notification = await notificationsService.createNotification({
    title,
    message,
    targetType,
    userId,
    customerId,
    link,
  });
  return ApiResponse.success(res, 'Notification sent', notification);
});

export const deleteNotification = asyncHandler(async (req: AuthRequest, res: Response) => {
  await notificationsService.deleteNotification(req.params.id);
  return ApiResponse.success(res, 'Notification deleted');
});
