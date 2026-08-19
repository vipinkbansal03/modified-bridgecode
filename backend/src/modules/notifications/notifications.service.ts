import { PrismaClient, NotificationType, NotificationTarget } from "@prisma/client";
import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { logger } from "../../config/logger";
import { notificationQueue } from "./notification.queue";
import { notificationManagerService } from "./notificationManager.service";

const prisma = new PrismaClient();

export class NotificationsService {
  // --- Global Seeding & Init ---
  async initNotificationSystem() {
    await notificationManagerService.seedNotificationSystem();
  }

  // --- Existing push notification helpers ---
  async sendPushNotification(token: string, title: string, body: string, data?: any) {
    if (!getApps().length) {
      logger.warn("Firebase Admin is not initialized. Skipping push notification.");
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
        type: data.type || "INFO",
        targetType: data.targetType || "SPECIFIC_CUSTOMER",
        link: data.link,
        userId: data.userId,
        customerId: data.customerId,
      },
    });

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
    } else if (data.targetType === "ALL_ADMINS") {
      const tokens = await prisma.deviceToken.findMany({ where: { userId: { not: null } } });
      for (const t of tokens) {
        await this.sendPushNotification(t.token, data.title, data.message, { link: data.link });
      }
    }

    return notification;
  }

  async registerDeviceToken(data: { token: string; deviceType?: string; userId?: string; customerId?: string }) {
    if (!data.userId && !data.customerId) {
      throw new Error("Either userId or customerId is required to register a token");
    }

    return await prisma.deviceToken.upsert({
      where: { token: data.token },
      update: {
        userId: data.userId || null,
        customerId: data.customerId || null,
        deviceType: data.deviceType || "web",
      },
      create: {
        token: data.token,
        userId: data.userId || null,
        customerId: data.customerId || null,
        deviceType: data.deviceType || "web",
      },
    });
  }

  async getNotificationsForUser(userId: string) {
    return prisma.notification.findMany({
      where: {
        OR: [
          { userId },
          { targetType: "ALL_ADMINS" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getNotificationsForCustomer(customerId: string) {
    return prisma.notification.findMany({
      where: {
        OR: [
          { customerId },
          { targetType: "ALL_CUSTOMERS" },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  }

  async getAdminAllNotifications() {
    return prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: { select: { name: true, email: true } },
        customer: { select: { firstName: true, lastName: true, email: true } },
      },
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

  // --- New Multi-Channel Routing Logic ---

  async isChannelEnabledByManager(channel: string): Promise<boolean> {
    const settings = await prisma.notificationManagerSettings.findUnique({
      where: { key: "GLOBAL" },
    });
    if (!settings) return true;
    if (!settings.masterEnabled) return false;
    const availability = settings.channelAvailability as Record<string, boolean>;
    const mappedKey = channel === "in_app" ? "inApp" : channel;
    return availability?.[mappedKey] !== false;
  }

  async sendNotification(type: string, to: string, message: string, options: any = {}) {
    try {
      const allowed = await this.isChannelEnabledByManager(type);
      if (!allowed) {
        logger.info(`Notification skipped by global manager settings: channel=${type}, to=${to}`);
        return { skipped: true, reason: "manager_disabled_or_channel_blocked" };
      }

      // Create log
      const log = await prisma.notificationLog.create({
        data: {
          type,
          channel: type,
          to,
          subject: options.subject || "",
          message,
          status: "QUEUED",
          metadata: options.metadata || {},
        },
      });

      // Queue job
      const job = await notificationQueue.add(
        type,
        {
          type,
          to,
          message,
          options: {
            ...options,
            notificationLogId: log.id,
          },
        },
        {
          delay: options.delayMs || 0,
        }
      );

      // Update log with job ID
      await prisma.notificationLog.update({
        where: { id: log.id },
        data: { jobId: String(job.id) },
      });

      logger.info(`Notification queued successfully: type=${type}, to=${to}, jobId=${job.id}`);
      return { job, logId: log.id };
    } catch (err: any) {
      logger.error(`Failed to queue notification type=${type}, to=${to}`, err);
      throw err;
    }
  }

  async dispatchNotification(eventType: string, payload: Record<string, any>, options: any = {}) {
    try {
      logger.info(`Dispatching event: ${eventType}`);

      // Load config for this event
      const config = await prisma.notificationConfig.findUnique({
        where: { type: eventType },
      });

      if (config && !config.isEnabled) {
        logger.info(`Event ${eventType} is disabled in config.`);
        return { skipped: true, reason: "config_disabled" };
      }

      // Settings
      const settings = await prisma.notificationManagerSettings.findUnique({
        where: { key: "GLOBAL" },
      });

      if (settings && !settings.masterEnabled) {
        logger.info("Notification master switch is globally disabled.");
        return { skipped: true, reason: "master_disabled" };
      }

      const toEmails: string[] = [];
      const toPhones: string[] = [];
      const userIds: string[] = [];
      const customerIds: string[] = [];

      // Resolve targets by roles
      const targetRoles = config?.targetRoles || [];
      if (targetRoles.length > 0) {
        // Resolve users with these roles
        const users = await prisma.user.findMany({
          where: {
            role: {
              name: { in: targetRoles },
            },
            status: "ACTIVE",
          },
          select: { id: true, email: true },
        });
        for (const u of users) {
          userIds.push(u.id);
          toEmails.push(u.email);
        }

        // Resolve B2B customers with these roles
        const customers = await prisma.customer.findMany({
          where: {
            customerRole: {
              name: { in: targetRoles },
            },
            status: "ACTIVE",
          },
          select: { id: true, email: true, phone: true },
        });
        for (const c of customers) {
          customerIds.push(c.id);
          if (c.email) toEmails.push(c.email);
          if (c.phone) toPhones.push(c.phone);
        }
      }

      // Explicit direct payload targets
      if (payload.userId) {
        userIds.push(payload.userId);
        const user = await prisma.user.findUnique({ where: { id: payload.userId } });
        if (user) toEmails.push(user.email);
      }
      if (payload.customerId) {
        customerIds.push(payload.customerId);
        const customer = await prisma.customer.findUnique({ where: { id: payload.customerId } });
        if (customer) {
          if (customer.email) toEmails.push(customer.email);
          if (customer.phone) toPhones.push(customer.phone);
        }
      }
      if (payload.email) toEmails.push(payload.email);
      if (payload.phone) toPhones.push(payload.phone);

      const finalEmails = Array.from(new Set(toEmails));
      const finalPhones = Array.from(new Set(toPhones));
      const finalUserIds = Array.from(new Set(userIds));
      const finalCustomerIds = Array.from(new Set(customerIds));

      // Resolve channels to send
      const channelsConfig = (config?.channels || { sms: true, whatsapp: true, email: true, push: true, inApp: true }) as Record<string, boolean>;
      const globalAvailability = (settings?.channelAvailability || { sms: true, whatsapp: true, email: true, push: true, inApp: true }) as Record<string, boolean>;

      const activeChannels: string[] = [];
      const possibleChannels = ["sms", "whatsapp", "email", "push", "in_app"];
      for (const ch of possibleChannels) {
        const mappedKey = ch === "in_app" ? "inApp" : ch;
        if (channelsConfig[mappedKey] !== false && globalAvailability[mappedKey] !== false) {
          activeChannels.push(ch);
        }
      }

      for (const channel of activeChannels) {
        const template = await prisma.notificationTemplate.findFirst({
          where: { type: eventType, channel },
        });

        if (!template) {
          logger.warn(`No template found for type=${eventType}, channel=${channel}. Skipping channel.`);
          continue;
        }

        const subject = notificationManagerService.renderTemplate(template.subject || "", payload);
        const message = notificationManagerService.renderTemplate(template.message || "", payload);

        if (channel === "email") {
          for (const email of finalEmails) {
            await this.sendNotification("email", email, message, {
              subject,
              metadata: { eventType, email },
            });
          }
        } else if (channel === "whatsapp") {
          for (const phone of finalPhones) {
            await this.sendNotification("whatsapp", phone, message, {
              whatsappTemplate: template.whatsappTemplate,
              metadata: { eventType, phone },
            });
          }
        } else if (channel === "sms") {
          for (const phone of finalPhones) {
            await this.sendNotification("sms", phone, message, {
              metadata: { eventType, phone },
            });
          }
        } else if (channel === "push" || channel === "in_app") {
          for (const uId of finalUserIds) {
            await this.sendNotification(channel, uId, message, {
              subject,
              userId: uId,
              metadata: { eventType, userId: uId },
            });
          }
          for (const cId of finalCustomerIds) {
            await this.sendNotification(channel, cId, message, {
              subject,
              customerId: cId,
              metadata: { eventType, customerId: cId },
            });
          }
        }
      }

      return { success: true };
    } catch (err: any) {
      logger.error(`Error dispatching notification for event ${eventType}:`, err);
      throw err;
    }
  }
}

export const notificationsService = new NotificationsService();
