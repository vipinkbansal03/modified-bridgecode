import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

export interface WhatsAppTemplateMetadata {
  id: string;
  name: string;
  language: string;
}

export const DEFAULT_CONFIGS: Record<string, {
  name: string;
  isEnabled: boolean;
  channels: { sms: boolean; whatsapp: boolean; email: boolean; push: boolean; inApp: boolean };
  filters: { branchIds: string[] };
}> = {
  USER_ONBOARDED: {
    name: "USER_ONBOARDED",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: false, inApp: true },
    filters: { branchIds: [] },
  },
  CUSTOMER_APPROVAL: {
    name: "CUSTOMER_APPROVAL",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  FORGOT_PASSWORD: {
    name: "FORGOT_PASSWORD",
    isEnabled: true,
    channels: { sms: true, whatsapp: false, email: true, push: false, inApp: false },
    filters: { branchIds: [] },
  },
  ORDER_PLACED: {
    name: "ORDER_PLACED",
    isEnabled: true,
    channels: { sms: false, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  ORDER_SHIPPED: {
    name: "ORDER_SHIPPED",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  ORDER_DELIVERED: {
    name: "ORDER_DELIVERED",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  ORDER_CANCELLED: {
    name: "ORDER_CANCELLED",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  PAYMENT_SUCCESS: {
    name: "PAYMENT_SUCCESS",
    isEnabled: true,
    channels: { sms: false, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  INQUIRY_RECEIVED: {
    name: "INQUIRY_RECEIVED",
    isEnabled: true,
    channels: { sms: false, whatsapp: false, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  QUOTE_PROPOSAL_SENT: {
    name: "QUOTE_PROPOSAL_SENT",
    isEnabled: true,
    channels: { sms: true, whatsapp: true, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
  NEWSLETTER_WELCOME: {
    name: "NEWSLETTER_WELCOME",
    isEnabled: true,
    channels: { sms: false, whatsapp: false, email: true, push: false, inApp: false },
    filters: { branchIds: [] },
  },
  LOW_STOCK: {
    name: "LOW_STOCK",
    isEnabled: true,
    channels: { sms: false, whatsapp: false, email: true, push: true, inApp: true },
    filters: { branchIds: [] },
  },
};

export const DEFAULT_TEMPLATES: Record<string, Record<string, {
  subject: string;
  message: string;
  variables: string[];
}>> = {
  USER_ONBOARDED: {
    sms: {
      subject: "",
      message: "Hello {{customer_name}}, your account has been successfully created. Welcome to Modern Orthodontics!",
      variables: ["customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nWelcome to Modern Orthodontics!\nYour B2B customer account is now active.\nEmail: {{email}}\nPhone: {{phone}}\n\nThank you,\nModern Orthodontics Team",
      variables: ["customer_name", "email", "phone"],
    },
    email: {
      subject: "Welcome to Modern Orthodontics",
      message: "Hello {{customer_name}},\n\nYour account has been successfully created by the admin.\n\nHere are your registered details:\n- Email: {{email}}\n- Phone: {{phone}}\n\nYou can now log in and manage your dental/orthodontic orders.\n\nThank you,\nModern Orthodontics Team",
      variables: ["customer_name", "email", "phone"],
    },
    push: {
      subject: "Account Created",
      message: "Welcome {{customer_name}}! Your B2B account is successfully setup.",
      variables: ["customer_name"],
    },
    in_app: {
      subject: "Welcome Onboard",
      message: "Welcome {{customer_name}}! Your B2B account is successfully setup.",
      variables: ["customer_name"],
    },
  },
  CUSTOMER_APPROVAL: {
    sms: {
      subject: "",
      message: "Dear {{customer_name}}, your Modern Orthodontics B2B account has been verified and approved.",
      variables: ["customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "Dear {{customer_name}},\n\nYour B2B account has been approved!\n\nRegards,\nModern Orthodontics",
      variables: ["customer_name"],
    },
    email: {
      subject: "Your Modern Orthodontics B2B Account is Approved!",
      message: "Dear {{customer_name}},\n\nYour B2B account application for Modern Orthodontics has been approved. You now have full access to catalog pricing and ordering.\n\nWelcome aboard,\nModern Orthodontics Team",
      variables: ["customer_name", "email", "company_name"],
    },
    push: {
      subject: "Account Approved",
      message: "Your B2B account has been approved.",
      variables: ["customer_name"],
    },
    in_app: {
      subject: "Account Approved",
      message: "Your B2B account is approved.",
      variables: ["customer_name"],
    },
  },
  FORGOT_PASSWORD: {
    sms: {
      subject: "",
      message: "Your Modern Orthodontics verification code is {{otp_code}}. Valid for 10 minutes. Do not share this OTP.",
      variables: ["otp_code", "customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}}, your security code is *{{otp_code}}*.",
      variables: ["otp_code", "customer_name"],
    },
    email: {
      subject: "Reset your Modern Orthodontics password",
      message: "Dear {{customer_name}},\n\nWe received a request to reset your password. Use the link to choose a new password: {{reset_link}}\n\nModern Orthodontics Security Team",
      variables: ["customer_name", "email", "reset_link", "company_name"],
    },
    push: {
      subject: "Password Reset Code",
      message: "Your security code is {{otp_code}}",
      variables: ["otp_code"],
    },
    in_app: {
      subject: "Password Reset Requested",
      message: "Password reset request initiated.",
      variables: ["customer_name"],
    },
  },
  ORDER_PLACED: {
    sms: {
      subject: "",
      message: "Hello {{customer_name}}, your order #{{order_number}} of total {{currency}} {{order_total}} has been placed successfully.",
      variables: ["customer_name", "order_number", "currency", "order_total"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nYour order *#{{order_number}}* has been placed successfully!\nTotal: {{currency}} {{order_total}}\n\nWe are processing it and will update you once shipped.\n\nRegards,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "currency", "order_total"],
    },
    email: {
      subject: "Order Placed #{{order_number}}",
      message: "Hello {{customer_name}},\n\nThank you for your order! We have received order #{{order_number}}.\n\nOrder Summary:\n- Total Amount: {{currency}} {{order_total}}\n- Status: Pending Confirmation\n\nWe will notify you when it ships.\n\nRegards,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "currency", "order_total"],
    },
    push: {
      subject: "Order Placed Successfully",
      message: "Order #{{order_number}} has been successfully placed.",
      variables: ["order_number"],
    },
    in_app: {
      subject: "Order Placed",
      message: "Order #{{order_number}} has been successfully placed.",
      variables: ["order_number"],
    },
  },
  ORDER_SHIPPED: {
    sms: {
      subject: "",
      message: "Hi {{customer_name}}, your order #{{order_number}} has been shipped via {{carrier_name}}. Tracking: {{tracking_number}}",
      variables: ["customer_name", "order_number", "carrier_name", "tracking_number"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nGood news! Your order *#{{order_number}}* has been shipped.\nCarrier: {{carrier_name}}\nTracking Link: {{tracking_url}}\nTracking #: {{tracking_number}}\n\nRegards,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "carrier_name", "tracking_number", "tracking_url"],
    },
    email: {
      subject: "Your order #{{order_number}} has shipped!",
      message: "Hello {{customer_name}},\n\nYour order #{{order_number}} has been shipped.\n\nShipping Details:\n- Carrier: {{carrier_name}}\n- Tracking Number: {{tracking_number}}\n- Tracking Link: {{tracking_url}}\n\nIt should arrive soon.\n\nRegards,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "carrier_name", "tracking_number", "tracking_url"],
    },
    push: {
      subject: "Order Shipped",
      message: "Order #{{order_number}} is on the way via {{carrier_name}}.",
      variables: ["order_number", "carrier_name"],
    },
    in_app: {
      subject: "Order Shipped",
      message: "Order #{{order_number}} is on the way via {{carrier_name}}.",
      variables: ["order_number", "carrier_name"],
    },
  },
  ORDER_DELIVERED: {
    sms: {
      subject: "",
      message: "Hello {{customer_name}}, order #{{order_number}} has been delivered via {{carrier_name}}. Thank you for choosing Modern Orthodontics.",
      variables: ["customer_name", "order_number", "carrier_name"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nYour order *#{{order_number}}* has been delivered!\n\nThank you,\nModern Orthodontics",
      variables: ["customer_name", "order_number"],
    },
    email: {
      subject: "Delivered: Your order #{{order_number}} has arrived!",
      message: "Dear {{customer_name}},\n\nOur courier records confirm that your order #{{order_number}} has been successfully delivered.\n\nWarm regards,\nModern Orthodontics Logistics",
      variables: ["customer_name", "order_number", "carrier_name", "tracking_number", "company_name"],
    },
    push: {
      subject: "Order Delivered",
      message: "Order #{{order_number}} was delivered.",
      variables: ["order_number"],
    },
    in_app: {
      subject: "Order Delivered",
      message: "Order #{{order_number}} was delivered.",
      variables: ["order_number"],
    },
  },
  ORDER_CANCELLED: {
    sms: {
      subject: "",
      message: "Dear {{customer_name}}, order #{{order_number}} has been cancelled. Any eligible refund has been initiated.",
      variables: ["customer_name", "order_number"],
    },
    whatsapp: {
      subject: "",
      message: "Dear {{customer_name}},\n\nOrder *#{{order_number}}* has been cancelled.\n\nModern Orthodontics Team",
      variables: ["customer_name", "order_number"],
    },
    email: {
      subject: "Order #{{order_number}} Cancellation Update",
      message: "Dear {{customer_name}},\n\nThis email confirms that your order #{{order_number}} has been cancelled.\n\nSincerely,\nModern Orthodontics Support Team",
      variables: ["customer_name", "order_number", "order_total", "currency", "company_name"],
    },
    push: {
      subject: "Order Cancelled",
      message: "Order #{{order_number}} was cancelled.",
      variables: ["order_number"],
    },
    in_app: {
      subject: "Order Cancelled",
      message: "Order #{{order_number}} was cancelled.",
      variables: ["order_number"],
    },
  },
  PAYMENT_SUCCESS: {
    sms: {
      subject: "",
      message: "Hi {{customer_name}}, payment for order #{{order_number}} was successful. Amount: {{currency}} {{order_total}}.",
      variables: ["customer_name", "order_number", "currency", "order_total"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nWe have successfully received payment for order *#{{order_number}}*.\nAmount Paid: {{currency}} {{order_total}}\nPayment Status: {{payment_status}}\n\nThank you,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "currency", "order_total", "payment_status"],
    },
    email: {
      subject: "Payment Success for Order #{{order_number}}",
      message: "Hello {{customer_name}},\n\nThis email confirms that your payment for order #{{order_number}} was processed successfully.\n\nPayment Details:\n- Amount: {{currency}} {{order_total}}\n- Status: {{payment_status}}\n\nThank you for choosing us.\n\nRegards,\nModern Orthodontics Team",
      variables: ["customer_name", "order_number", "currency", "order_total", "payment_status"],
    },
    push: {
      subject: "Payment Received",
      message: "Payment for order #{{order_number}} was processed successfully.",
      variables: ["order_number"],
    },
    in_app: {
      subject: "Payment Received",
      message: "Payment for order #{{order_number}} was processed successfully.",
      variables: ["order_number"],
    },
  },
  INQUIRY_RECEIVED: {
    sms: {
      subject: "",
      message: "Hello {{customer_name}}, we received your inquiry. A specialist will get back to you shortly.",
      variables: ["customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nThank you for reaching out to Modern Orthodontics. We received your quotation inquiry.",
      variables: ["customer_name"],
    },
    email: {
      subject: "We received your inquiry - Modern Orthodontics",
      message: "Hello {{customer_name}},\n\nThank you for contacting Modern Orthodontics. We have received your inquiry / quotation request.\n\nBest regards,\nModern Orthodontics Sales Team",
      variables: ["customer_name", "email", "phone", "company_name"],
    },
    push: {
      subject: "Inquiry Received",
      message: "We have received your product inquiry.",
      variables: ["customer_name"],
    },
    in_app: {
      subject: "Inquiry Received",
      message: "We have received your product inquiry.",
      variables: ["customer_name"],
    },
  },
  QUOTE_PROPOSAL_SENT: {
    sms: {
      subject: "",
      message: "Hello {{customer_name}}, your custom quotation #{{quote_number}} for {{currency}} {{quote_total}} is ready. Review & approve in your account.",
      variables: ["customer_name", "quote_number", "currency", "quote_total"],
    },
    whatsapp: {
      subject: "",
      message: "Hello {{customer_name}},\n\nYour quotation *#{{quote_number}}* is ready!\nEstimated Total: {{currency}} {{quote_total}}\n\nRegards,\nModern Orthodontics Sales Team",
      variables: ["customer_name", "quote_number", "currency", "quote_total"],
    },
    email: {
      subject: "Your Quote Proposal #{{quote_number}} is Ready - Modern Orthodontics",
      message: "Dear {{customer_name}},\n\nOur sales team has prepared a formal price proposal for your clinic (Quote #{{quote_number}}).\n\nBest regards,\nModern Orthodontics Sales Team",
      variables: ["customer_name", "quote_number", "quote_total", "currency", "company_name"],
    },
    push: {
      subject: "Quote Proposal Ready",
      message: "Quotation #{{quote_number}} is ready for your review.",
      variables: ["quote_number"],
    },
    in_app: {
      subject: "Quote Proposal Ready",
      message: "Quotation #{{quote_number}} is ready for your review.",
      variables: ["quote_number"],
    },
  },
  NEWSLETTER_WELCOME: {
    sms: {
      subject: "",
      message: "Welcome to Modern Orthodontics updates and product releases.",
      variables: ["customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "Welcome to Modern Orthodontics newsletter!",
      variables: ["customer_name"],
    },
    email: {
      subject: "Welcome to Modern Orthodontics Insights",
      message: "Hello {{customer_name}},\n\nThank you for subscribing to the Modern Orthodontics newsletter.\n\nBest regards,\nModern Orthodontics Team",
      variables: ["customer_name", "email", "company_name"],
    },
    push: {
      subject: "Subscribed to Newsletter",
      message: "Welcome to Modern Orthodontics newsletter.",
      variables: ["customer_name"],
    },
    in_app: {
      subject: "Subscribed to Newsletter",
      message: "Welcome to Modern Orthodontics newsletter.",
      variables: ["customer_name"],
    },
  },
  LOW_STOCK: {
    sms: {
      subject: "",
      message: "Low stock alert: One or more SKU counts have fallen below the minimum safety threshold.",
      variables: ["customer_name"],
    },
    whatsapp: {
      subject: "",
      message: "⚠️ *Low Stock Alert*: One or more items are below threshold.",
      variables: ["customer_name"],
    },
    email: {
      subject: "Low Inventory Warning - Modern Orthodontics",
      message: "Attention Inventory Team,\n\nOne or more SKU inventory counts have fallen below the safety threshold.\n\nModern Orthodontics ERP",
      variables: ["customer_name", "company_name"],
    },
    push: {
      subject: "Low Stock Alert",
      message: "Inventory threshold reached.",
      variables: ["customer_name"],
    },
    in_app: {
      subject: "Low Stock Alert",
      message: "Inventory threshold reached.",
      variables: ["customer_name"],
    },
  },
};

const DEFAULT_HEADER = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e6e6e6; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
  <div style="background-color: #1a1a1a; padding: 24px; text-align: center; border-bottom: 2px solid #b5151b;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 500; letter-spacing: 0.5px;">Modern Orthodontics</h1>
  </div>
  <div style="padding: 32px 24px; background-color: #ffffff; color: #333333; line-height: 1.6; font-size: 14px;">`;

const DEFAULT_FOOTER = `  </div>
  <div style="background-color: #f9f9f9; padding: 20px 24px; border-top: 1px solid #e6e6e6; text-align: center; font-size: 12px; color: #6b6b6b;">
    <p style="margin: 0 0 8px 0;">Modern Orthodontics B2B Platform</p>
    <p style="margin: 0;">Need help? Contact support at <a href="mailto:support@modortho.com" style="color: #b5151b; text-decoration: none;">support@modortho.com</a></p>
  </div>
</div>`;

export class NotificationManagerService {
  async seedNotificationSystem() {
    try {
      logger.info("Checking & seeding notification settings...");

      // Seed global settings
      await prisma.notificationManagerSettings.upsert({
        where: { key: "GLOBAL" },
        update: {},
        create: {
          key: "GLOBAL",
          masterEnabled: true,
          channelAvailability: {
            sms: true,
            whatsapp: true,
            email: true,
            push: true,
            inApp: true,
          },
          rolePermissions: {},
        },
      });

      // Seed default email layout
      await prisma.emailLayout.upsert({
        where: { name: "DEFAULT" },
        update: {},
        create: {
          name: "DEFAULT",
          headerHtml: DEFAULT_HEADER,
          footerHtml: DEFAULT_FOOTER,
          isDefault: true,
        },
      });

      // Query current active roles in the system
      const adminRoles = await prisma.role.findMany({ select: { name: true } });
      const customerRoles = await prisma.customerRole.findMany({ select: { name: true } });
      const dbRoles = Array.from(new Set([
        ...adminRoles.map(r => r.name),
        ...customerRoles.map(r => r.name),
      ]));

      // Seed config rules
      for (const [key, config] of Object.entries(DEFAULT_CONFIGS)) {
        const activeTargetRoles = dbRoles.length > 0 ? dbRoles : ["Super Admin", "Admin", "Staff"];
        const rolePermissionsObj: Record<string, boolean> = {};
        for (const role of activeTargetRoles) {
          rolePermissionsObj[role] = true;
        }

        await prisma.notificationConfig.upsert({
          where: { type: key },
          update: {
            targetRoles: activeTargetRoles,
            rolePermissions: rolePermissionsObj,
          },
          create: {
            type: key,
            name: config.name,
            isEnabled: config.isEnabled,
            targetRoles: activeTargetRoles,
            channels: config.channels,
            rolePermissions: rolePermissionsObj,
            filters: config.filters,
          },
        });
      }

      // Seed templates
      for (const [type, channels] of Object.entries(DEFAULT_TEMPLATES)) {
        for (const [channel, details] of Object.entries(channels)) {
          const uniqueKey = {
            type_channel_role: {
              type,
              channel,
              role: "GLOBAL",
            },
          };
          const existing = await prisma.notificationTemplate.findUnique({
            where: uniqueKey,
          });
          if (!existing) {
            await prisma.notificationTemplate.create({
              data: {
                type,
                channel,
                role: "GLOBAL",
                subject: details.subject,
                message: details.message,
                variables: details.variables,
              },
            });
          }
        }
      }

      logger.info("Notification settings, layouts, and templates seeded successfully.");
    } catch (error) {
      logger.error("Error seeding notification system:", error);
    }
  }

  renderTemplate(content: string, variables: Record<string, any> = {}): string {
    return String(content || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
      const value = variables[key];
      return value === undefined || value === null ? "" : String(value);
    });
  }

  async compileEmail(message: string): Promise<string> {
    const layout = await prisma.emailLayout.findFirst({
      where: { isDefault: true },
    });
    const header = layout?.headerHtml || DEFAULT_HEADER;
    const footer = layout?.footerHtml || DEFAULT_FOOTER;
    return `${header}${message.replace(/\n/g, "<br />")}${footer}`;
  }
}

export const notificationManagerService = new NotificationManagerService();
