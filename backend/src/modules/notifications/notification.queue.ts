import { Queue, Worker, Job } from "bullmq";
import { redis } from "../../config/redis";
import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { getApps } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { notificationManagerService } from "./notificationManager.service";
import nodemailer from "nodemailer";
import { getSettingValue } from "../settings/settings.service";

const QUEUE_NAME = "notification";

export const notificationQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2000,
    },
    removeOnComplete: 100,
    removeOnFail: 200,
  },
});

// SMTP Transporter Helper
const getSmtpTransporter = async () => {
  const emailEnabled = await getSettingValue("email.enabled");
  if (emailEnabled === "false") {
    logger.info("SMTP email notifications are explicitly disabled in settings.");
    return null;
  }

  const dbHost = await getSettingValue("email.smtp_host");
  const dbPort = await getSettingValue("email.smtp_port");
  const dbUser = await getSettingValue("email.smtp_user");
  const dbPass = await getSettingValue("email.smtp_password");

  const host = dbHost || process.env.SMTP_HOST || "localhost";
  const port = Number(dbPort || process.env.SMTP_PORT) || 587;
  const user = dbUser || process.env.SMTP_USER || "";
  const pass = dbPass || process.env.SMTP_PASS || "";

  if (!user || !pass) {
    logger.warn("SMTP credentials not fully configured, emails will be printed to console log.");
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
};

export const notificationWorker = new Worker(
  QUEUE_NAME,
  async (job: Job) => {
    const { type, to, message, options = {} } = job.data;
    const logId = options.notificationLogId || "";

    logger.info(`Processing notification job ${job.id} for channel ${type}`);

    if (logId) {
      await prisma.notificationLog.update({
        where: { id: logId },
        data: { status: "PROCESSING", jobId: String(job.id) },
      });
    }

    try {
      let providerName = "mock";
      let providerReferenceId = "";

      if (type === "email") {
        const subject = options.subject || "Notification";
        const html = await notificationManagerService.compileEmail(message);
        const emailProvider = ((await getSettingValue("email.provider")) || process.env.EMAIL_PROVIDER || "msg91").trim().toLowerCase();

        const fromEmail = (await getSettingValue("email.from_email")) || process.env.MSG91_FROM_EMAIL || process.env.EMAIL_FROM || "orders@modortho.com";
        const fromName = (await getSettingValue("email.from_name")) || process.env.MSG91_FROM_NAME || process.env.FROM_NAME || "Modern Orthodontics";

        if (emailProvider === "nodemailer" || emailProvider === "smtp") {
          const smtp = await getSmtpTransporter();
          if (smtp) {
            const mailOptions = {
              from: `"${fromName}" <${fromEmail}>`,
              to,
              subject,
              html,
            };
            const info = await smtp.sendMail(mailOptions);
            providerName = "nodemailer";
            providerReferenceId = info.messageId;
          } else {
            logger.info(`[SMTP MOCK] Sending email to ${to} | Subject: ${subject} | Body: ${message}`);
          }
        } else if (emailProvider === "resend") {
          const { sendEmailSafely } = await import("../../utils/email");
          await sendEmailSafely({
            from: fromEmail,
            fromName,
            to: Array.isArray(to) ? to : [to],
            subject,
            text: message,
            html,
          });
          providerName = "resend";
          providerReferenceId = `resend_${Date.now()}`;
        } else {
          // Default: msg91
          const msg91AuthKey = (await getSettingValue("email.msg91_auth_key")) || process.env.MSG91_AUTH_KEY || "";
          const msg91Domain = (await getSettingValue("email.msg91_domain")) || process.env.MSG91_DOMAIN || undefined;

          if (msg91AuthKey) {
            const payload: Record<string, any> = {
              recipients: [{ to: [{ email: to }] }],
              from: { name: fromName, email: fromEmail },
              subject,
              body: html || message,
            };
            if (msg91Domain) {
              payload.domain = msg91Domain;
            }

            const response = await fetch("https://control.msg91.com/api/v5/email/send", {
              method: "POST",
              headers: {
                "authkey": msg91AuthKey,
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify(payload),
            });

            const resData = (await response.json().catch(() => null)) as any;
            if (!response.ok || (resData && resData.status === "error")) {
              throw new Error(`MSG91 email failed: ${resData?.message || response.statusText}`);
            }
            providerName = "msg91";
            providerReferenceId = resData?.message || `msg91_${Date.now()}`;
          } else {
            logger.info(`[MSG91 MOCK] Sending email to ${to} | Subject: ${subject} | Body: ${message}`);
          }
        }
      } else if (type === "whatsapp") {
        const waTemplate = options.whatsappTemplate;
        const variables = options.variables || [];
        const payloadData = options.payload || {};

        if (waTemplate && waTemplate.name) {
          const { sendTataTemplateMessage } = await import("./tataProvider");
          const result = await sendTataTemplateMessage(
            to,
            waTemplate.name,
            waTemplate.language || "en",
            variables,
            payloadData
          );
          providerName = result.provider;
          providerReferenceId = (result.response as any)?.messages?.[0]?.id || `wa_${Date.now()}`;
        } else {
          providerName = "whatsapp-mock";
          providerReferenceId = `wa_${Date.now()}`;
          logger.info(`[WHATSAPP MOCK] No template configured. Mapped message: ${message}`);
        }
      } else if (type === "sms") {
        // Mock SMS provider send
        providerName = "sms-mock";
        providerReferenceId = `sms_${Date.now()}`;
        logger.info(`[SMS MOCK] Sending SMS to ${to} | Message: ${message}`);
      } else if (type === "push" || type === "in_app") {
        providerName = "fcm-sse";
        // Call in-app db notification
        const userId = options.userId || null;
        const customerId = options.customerId || null;

        await prisma.notification.create({
          data: {
            title: options.subject || "New Notification",
            message: message,
            type: "INFO",
            targetType: userId ? "SPECIFIC_USER" : customerId ? "SPECIFIC_CUSTOMER" : "ALL_ADMINS",
            userId,
            customerId,
          },
        });

        // Try sending FCM push notification if firebase initialized
        if (getApps().length) {
          const tokens = await prisma.deviceToken.findMany({
            where: {
              OR: [
                ...(userId ? [{ userId }] : []),
                ...(customerId ? [{ customerId }] : []),
              ],
            },
          });
          const messaging = getMessaging();
          for (const t of tokens) {
            try {
              await messaging.send({
                token: t.token,
                notification: { title: options.subject || "New Notification", body: message },
                data: { link: options.link || "" },
              });
            } catch (err) {
              logger.error(`Failed to send FCM push to token ${t.token}:`, err);
            }
          }
        }
      }

      if (logId) {
        await prisma.notificationLog.update({
          where: { id: logId },
          data: {
            status: "SENT",
            provider: providerName,
            providerReferenceId,
            sentAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      logger.error(`Error processing job ${job.id}:`, err);
      if (logId) {
        await prisma.notificationLog.update({
          where: { id: logId },
          data: { status: "FAILED", errorMessage: err.message || String(err) },
        });
      }
      throw err;
    }
  },
  {
    connection: redis,
    concurrency: Number(process.env.NOTIFICATION_QUEUE_CONCURRENCY || 5),
  }
);
