import { PrismaClient, NotificationType, NotificationTarget } from '@prisma/client';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { logger } from '../../config/logger';

const prisma = new PrismaClient();

// Note: initializeApp() should be called in server.ts once credentials are provided.

export class NotificationsService {
  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!getApps().length) {
      logger.warn('Firebase Admin is not initialized. Skipping push notification.');
      return;
    }
    try {
      await getMessaging().send({
        token,
        notification: { title, body },
        data: data || {},
      });
      logger.info(`Push notification sent successfully to ${token}`);
    } catch (error) {
      logger.error(`Error sending push notification to ${token}: ${error}`);
    }
  }

  async createNotification(data: {
    title: string;
    message: string;
    type?: NotificationType;
    link?: string;
    targetType?: NotificationTarget;
    userId?: string;
    customerId?: string;
  }) {
    const notification = await prisma.notification.create({
      data: {
        title: data.title,
        message: data.message,
        type: data.type || 'INFO',
        targetType: data.targetType || 'SPECIFIC_CUSTOMER',
        link: data.link,
        userId: data.userId,
        customerId: data.customerId,
      },
    });

    // Send push notification if a specific user/customer is targeted
    if (data.userId) {
      const tokens = await prisma.deviceToken.findMany({ where: { userId: data.userId } });
      for (const t of tokens) {
        await this.sendPushNotification(t.token, data.title, data.message, { link: data.link });
      }
    } else if (data.customerId) {
      const tokens = await prisma.deviceToken.findMany({ where: { customerId: data.customerId } });
      for (const t of tokens) {
        await this.sendPushNotification(t.token, data.title, data.message, { link: data.link });
      }
    } else if (data.targetType === 'ALL_ADMINS') {
      const tokens = await prisma.deviceToken.findMany({ where: { userId: { not: null } } });
      for (const t of tokens) {
        await this.sendPushNotification(t.token, data.title, data.message, { link: data.link });
      }
    }

    return notification;
  }

  async registerDeviceToken(data: { token: string; deviceType?: string; userId?: string; customerId?: string }) {
    if (!data.userId && !data.customerId) {
      throw new Error('Either userId or customerId is required to register a token');
    }

    return await prisma.deviceToken.upsert({
      where: { token: data.token },
      update: {
        userId: data.userId,
        customerId: data.customerId,
        deviceType: data.deviceType || 'web',
      },
      create: {
        token: data.token,
        userId: data.userId,
        customerId: data.customerId,
        deviceType: data.deviceType || 'web',
      },
    });
  }

  async getNotificationsForUser(userId: string) {
    return prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { targetType: 'ALL_ADMINS' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getNotificationsForCustomer(customerId: string) {
    return prisma.notification.findMany({
      where: {
        OR: [
          { customerId },
          { targetType: 'ALL_CUSTOMERS' },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getAdminAllNotifications() {
    return prisma.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        customer: { select: { firstName: true, lastName: true, email: true } }
      }
    });
  }

  async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
  }

  async deleteNotification(id: string) {
    return prisma.notification.delete({
      where: { id },
    });
  }
}

export const notificationsService = new NotificationsService();
