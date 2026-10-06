import { Request, Response } from 'express';
import { asyncHandler, ApiResponse, AppError } from '../../utils/apiResponse';
import { AuthRequest } from '../../middleware/auth.middleware';
import { CustomerAuthRequest } from '../../middleware/customerAuth.middleware';
import { notificationsService } from './notifications.service';
import { prisma } from '../../config/database';

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

export const deleteCustomerNotification = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer?.id) throw new AppError('Unauthorized', 401);
  const notification = await prisma.notification.findUnique({
    where: { id: req.params.id },
  });
  if (!notification) {
    return ApiResponse.success(res, 'Notification deleted');
  }
  if (notification.customerId !== req.customer.id && notification.targetType !== 'ALL_CUSTOMERS') {
    throw new AppError('Unauthorized', 403);
  }
  await notificationsService.deleteNotification(req.params.id);
  return ApiResponse.success(res, 'Notification deleted');
});

export const bulkDeleteCustomerNotifications = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer?.id) throw new AppError('Unauthorized', 401);
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('IDs array is required', 400);
  }
  const notifications = await prisma.notification.findMany({
    where: { id: { in: ids } },
  });
  for (const n of notifications) {
    if (n.customerId !== req.customer.id && n.targetType !== 'ALL_CUSTOMERS') {
      throw new AppError('Unauthorized', 403);
    }
  }
  await prisma.notification.deleteMany({
    where: { id: { in: ids } },
  });
  return ApiResponse.success(res, 'Notifications deleted');
});

// --- New Admin Configuration & Log Controllers ---

export const listNotificationConfigs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const configs = await prisma.notificationConfig.findMany({
    orderBy: { type: 'asc' },
  });
  return ApiResponse.success(res, 'Notification configs fetched', configs);
});

export const updateNotificationConfig = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { isEnabled, targetRoles, channels, rolePermissions, filters } = req.body;

  const config = await prisma.notificationConfig.update({
    where: { id },
    data: {
      isEnabled,
      targetRoles,
      channels: channels || {},
      rolePermissions: rolePermissions || {},
      filters: filters || {},
    },
  });
  return ApiResponse.success(res, 'Notification config updated', config);
});

export const getNotificationManagerSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  let settings = await prisma.notificationManagerSettings.findUnique({
    where: { key: 'GLOBAL' },
  });
  if (!settings) {
    settings = await prisma.notificationManagerSettings.create({
      data: {
        key: 'GLOBAL',
        masterEnabled: true,
        channelAvailability: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
      },
    });
  }

  const layout = await prisma.emailLayout.findFirst({
    where: { isDefault: true },
  });

  const responseData = {
    ...settings,
    emailLayouts: layout ? { headerHtml: layout.headerHtml, footerHtml: layout.footerHtml } : null,
  };

  return ApiResponse.success(res, 'Notification manager settings fetched', responseData);
});

export const updateNotificationManagerSettings = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { masterEnabled, channelAvailability, rolePermissions, emailLayouts } = req.body;

  const settings = await prisma.notificationManagerSettings.update({
    where: { key: 'GLOBAL' },
    data: {
      masterEnabled,
      channelAvailability: channelAvailability || {},
      rolePermissions: rolePermissions || {},
    },
  });

  if (emailLayouts) {
    const { headerHtml, footerHtml } = emailLayouts;
    await prisma.emailLayout.upsert({
      where: { name: 'DEFAULT' },
      update: { headerHtml, footerHtml },
      create: { name: 'DEFAULT', headerHtml, footerHtml, isDefault: true }
    });
  }

  return ApiResponse.success(res, 'Notification settings updated', settings);
});

export const listNotificationRoles = asyncHandler(async (req: AuthRequest, res: Response) => {
  const [adminRoles, customerRoles] = await Promise.all([
    prisma.role.findMany({ select: { name: true } }),
    prisma.customerRole.findMany({ select: { name: true } }),
  ]);
  const roles = [
    ...adminRoles.map(r => r.name),
    ...customerRoles.map(r => r.name),
  ];
  return ApiResponse.success(res, 'Roles fetched successfully', Array.from(new Set(roles)));
});

export const listNotificationTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const templates = await prisma.notificationTemplate.findMany({
    orderBy: [{ type: 'asc' }, { channel: 'asc' }],
  });
  return ApiResponse.success(res, 'Templates fetched', templates);
});

export const listApprovedWhatsAppTemplates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const templates = await prisma.whatsAppTemplate.findMany({
    where: { status: 'APPROVED' },
    orderBy: { name: 'asc' },
  });
  return ApiResponse.success(res, 'Approved WhatsApp templates fetched', templates);
});

export const updateNotificationTemplate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { type, channel } = req.params;
  const { subject, message, variables, whatsappTemplate, role = 'GLOBAL' } = req.body;

  const template = await prisma.notificationTemplate.upsert({
    where: {
      type_channel_role: {
        type: type.toUpperCase(),
        channel: channel.toLowerCase(),
        role: role.toUpperCase(),
      },
    },
    update: {
      subject: subject || '',
      message: message || '',
      variables: Array.isArray(variables) ? variables : (variables ? variables.split(',').map((v: string) => v.trim()) : []),
      whatsappTemplate: whatsappTemplate || null,
    },
    create: {
      type: type.toUpperCase(),
      channel: channel.toLowerCase(),
      role: role.toUpperCase(),
      subject: subject || '',
      message: message || '',
      variables: Array.isArray(variables) ? variables : (variables ? variables.split(',').map((v: string) => v.trim()) : []),
      whatsappTemplate: whatsappTemplate || null,
    },
  });

  return ApiResponse.success(res, 'Template updated successfully', template);
});

export const listNotifications = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { search = '', status = '', channel = '', page = '1', limit = '20' } = req.query;
  const p = Math.max(1, parseInt(page as string, 10));
  const l = Math.max(1, parseInt(limit as string, 10));

  const where: any = {};
  if (channel && channel !== 'all') {
    where.channel = channel;
  }
  if (status && status !== 'all') {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { to: { contains: search as string, mode: 'insensitive' } },
      { subject: { contains: search as string, mode: 'insensitive' } },
      { message: { contains: search as string, mode: 'insensitive' } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.notificationLog.count({ where }),
    prisma.notificationLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (p - 1) * l,
      take: l,
    }),
  ]);

  return ApiResponse.success(res, 'Notifications fetched successfully', {
    total,
    page: p,
    limit: l,
    totalPages: Math.ceil(total / l),
    items,
  });
});

export const deleteLog = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const log = await prisma.notificationLog.findUnique({ where: { id } });
  if (log) {
    await prisma.notification.deleteMany({
      where: {
        title: log.subject || undefined,
        message: log.message,
        OR: [
          { userId: log.to },
          { customerId: log.to },
          { targetType: "ALL_ADMINS" }
        ]
      }
    });
    await prisma.notificationLog.delete({ where: { id } });
  }
  return ApiResponse.success(res, 'Log deleted successfully');
});

export const bulkDeleteLogs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new AppError('IDs array is required', 400);
  }
  
  const uniqueIds = Array.from(new Set(ids.filter(Boolean) as string[]));
  const logs = await prisma.notificationLog.findMany({
    where: { id: { in: uniqueIds } }
  });
  
  // 1. Delete associated notifications in batch chunks using OR conditions
  const LOG_CHUNK = 100;
  for (let i = 0; i < logs.length; i += LOG_CHUNK) {
    const chunk = logs.slice(i, i + LOG_CHUNK);
    const deleteConditions = chunk.map((log) => ({
      ...(log.subject ? { title: log.subject } : {}),
      message: log.message,
      OR: [
        { userId: log.to },
        { customerId: log.to },
        { targetType: "ALL_ADMINS" as const }
      ]
    }));

    if (deleteConditions.length > 0) {
      await prisma.notification.deleteMany({
        where: {
          OR: deleteConditions
        }
      });
    }
  }

  // 2. Delete notification logs in safe batch chunks
  const DELETE_CHUNK = 500;
  for (let i = 0; i < uniqueIds.length; i += DELETE_CHUNK) {
    const chunk = uniqueIds.slice(i, i + DELETE_CHUNK);
    await prisma.notificationLog.deleteMany({
      where: { id: { in: chunk } },
    });
  }

  return ApiResponse.success(res, 'Logs deleted successfully');
});
