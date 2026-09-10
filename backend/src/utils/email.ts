import nodemailer from "nodemailer";
import { Resend } from "resend";
import { logger } from "../config/logger";
import { getSettingValue } from "../modules/settings/settings.service";

let cachedResendClient: { key: string; client: Resend } | null = null;
function getResendClient(apiKey: string | null) {
  if (!apiKey) return null;
  if (cachedResendClient && cachedResendClient.key === apiKey) {
    return cachedResendClient.client;
  }
  const client = new Resend(apiKey);
  cachedResendClient = { key: apiKey, client };
  return client;
}

export interface QuoteEmailData {
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  items: { productTitle: string; sku?: string; quantity: number; unitPrice: number }[];
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  total?: number;
  notes?: string;
}

export interface ContactEmailData {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  subject?: string;
  message: string;
  type?: string;
}

function formatCurrency(value: number) {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export type EmailCategory = "auth" | "orders" | "quotes" | "support" | "newsletter" | "general";

interface SendEmailParams {
  category?: EmailCategory;
  countryCode?: string;
  from?: string;
  fromName?: string;
  to: string[];
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

/**
 * Helper to fetch latest email configuration from Database Settings or Environment
 */
export async function getEmailConfig() {
  const emailEnabled = await getSettingValue("email.enabled").catch(() => "");
  const isEnabled = emailEnabled === "" ? true : emailEnabled !== "false";

  const dbMsg91Key = await getSettingValue("email.msg91_auth_key").catch(() => "");
  const dbMsg91Domain = await getSettingValue("email.msg91_domain").catch(() => "");
  const dbMsg91Enabled = await getSettingValue("email.msg91_enabled").catch(() => "");
  const msg91AuthKey = dbMsg91Key || process.env.MSG91_AUTH_KEY || "";
  const msg91Enabled = dbMsg91Enabled !== "" ? dbMsg91Enabled !== "false" : Boolean(msg91AuthKey);

  const dbSmtpHost = await getSettingValue("email.smtp_host").catch(() => "");
  const dbSmtpPort = await getSettingValue("email.smtp_port").catch(() => "");
  const dbSmtpUser = await getSettingValue("email.smtp_user").catch(() => "");
  const dbSmtpPass = await getSettingValue("email.smtp_password").catch(() => "");
  const dbSmtpSecure = await getSettingValue("email.smtp_secure").catch(() => "");
  const dbSmtpEnabled = await getSettingValue("email.smtp_enabled").catch(() => "");
  const smtpUser = dbSmtpUser || process.env.SMTP_USER || "";
  const smtpPass = dbSmtpPass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
  const smtpHost = dbSmtpHost || process.env.SMTP_HOST || "localhost";
  const smtpEnabled = dbSmtpEnabled !== "" ? dbSmtpEnabled === "true" : (process.env.SMTP_ENABLED !== "false" && Boolean(smtpUser && smtpPass));

  const dbResendKey = await getSettingValue("email.resend_api_key").catch(() => "");
  const dbResendEnabled = await getSettingValue("email.resend_enabled").catch(() => "");
  const resendApiKey = dbResendKey || process.env.RESEND_API_KEY || "";
  const resendEnabled = dbResendEnabled !== "" ? dbResendEnabled === "true" : (process.env.RESEND_ENABLED !== "false" && Boolean(resendApiKey));

  const dbProvider = await getSettingValue("email.provider").catch(() => "");
  let provider = (dbProvider || process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
  if (!provider) {
    if (smtpUser && smtpPass) {
      provider = "smtp";
    } else if (msg91AuthKey) {
      provider = "msg91";
    } else if (resendApiKey) {
      provider = "resend";
    } else {
      provider = "smtp";
    }
  }

  const dbFromName = await getSettingValue("email.from_name").catch(() => "");
  const dbFromEmail = await getSettingValue("email.from_email").catch(() => "");
  const dbNotify = await getSettingValue("email.notify_email").catch(() => "");

  return {
    isEnabled,
    provider,
    msg91Enabled,
    smtpEnabled,
    resendEnabled,
    fromName: dbFromName || process.env.MSG91_FROM_NAME || process.env.EMAIL_FROM_NAME || process.env.FROM_NAME || "Modern Orthodontics",
    fromEmail: dbFromEmail || process.env.MSG91_FROM_EMAIL || process.env.EMAIL_FROM || "orders@modortho.com",
    notify: dbNotify || process.env.EMAIL_NOTIFY || "mayuragarwal2096@gmail.com",
    msg91AuthKey,
    msg91Domain: dbMsg91Domain || process.env.MSG91_DOMAIN || "",
    smtpHost,
    smtpPort: Number(dbSmtpPort || process.env.SMTP_PORT) || 587,
    smtpUser,
    smtpPass,
    smtpSecure: dbSmtpSecure === "true" || process.env.SMTP_SECURE === "true",
    resendApiKey,
  };
}

/**
 * Resolves the sender identity based on Country Routing -> Purpose/Event Routing -> Global Default
 */
async function resolveSenderIdentity(
  category?: EmailCategory,
  countryCode?: string,
  explicitFromEmail?: string,
  explicitFromName?: string
): Promise<{ fromEmail: string; fromName: string }> {
  const config = await getEmailConfig();
  let resolvedEmail = explicitFromEmail;
  let resolvedName = explicitFromName;

  // 1. Country-Specific Routing (highest priority if master switch & specific country are enabled)
  if (countryCode && !resolvedEmail) {
    const masterCountryRouting = await getSettingValue("email.country_routing_enabled").catch(() => "");
    const isMasterCountryRoutingActive = masterCountryRouting === "" || masterCountryRouting !== "false";
    if (isMasterCountryRoutingActive) {
      const code = countryCode.trim().toUpperCase();
      const countryEnabled = await getSettingValue(`email.country.${code}.enabled`).catch(() => "");
      if (countryEnabled === "true") {
        const countryEmail = await getSettingValue(`email.country.${code}.from_email`).catch(() => "");
        const countryName = await getSettingValue(`email.country.${code}.from_name`).catch(() => "");
        if (countryEmail) {
          resolvedEmail = countryEmail;
          resolvedName = resolvedName || countryName;
        }
      }
    }
  }

  // 2. Event / Purpose-Specific Routing (e.g. auth, orders, quotes, support, newsletter)
  if (category && category !== "general" && !resolvedEmail) {
    const eventEmail = await getSettingValue(`email.events.${category}.from_email`).catch(() => "");
    const eventName = await getSettingValue(`email.events.${category}.from_name`).catch(() => "");
    if (eventEmail) {
      resolvedEmail = eventEmail;
      resolvedName = resolvedName || eventName;
    }
  }

  // 3. Global Default Fallback
  return {
    fromEmail: resolvedEmail || config.fromEmail,
    fromName: resolvedName || config.fromName,
  };
}

/**
 * Send email using MSG91 Email API
 */
async function sendMsg91Email(
  authKey: string,
  domain: string | undefined,
  params: {
    fromEmail: string;
    fromName: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }
): Promise<boolean> {
  if (!authKey) {
    console.warn("[MSG91 Warning] MSG91 AuthKey is not configured. Email skipped.");
    logger.warn("[MSG91 Warning] MSG91 AuthKey is not configured. Email skipped.");
    return false;
  }

  const bodyContent = params.html || params.text.replace(/\n/g, "<br/>");

  const payload: Record<string, any> = {
    recipients: params.to.map((email) => ({
      to: [{ email: email.trim() }],
    })),
    from: {
      name: params.fromName,
      email: params.fromEmail,
    },
    subject: params.subject,
    body: bodyContent,
  };

  if (domain) {
    payload.domain = domain;
  }

  if (params.replyTo) {
    payload.reply_to = [{ email: params.replyTo.trim() }];
  }

  try {
    const response = await fetch("https://control.msg91.com/api/v5/email/send", {
      method: "POST",
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = (await response.json().catch(() => null)) as any;
    if (!response.ok || (data && data.status === "error")) {
      const errorMsg = data?.message || response.statusText;
      console.error(`[MSG91 Error] ${response.status}: ${errorMsg}`);
      logger.error(`[MSG91 Error] ${response.status}: ${errorMsg}`);
      return false;
    }

    console.log(`[MSG91 Email Sent] ${params.subject} -> ${params.to.join(", ")}`);
    logger.info(`[MSG91 Email Sent] ${params.subject} -> ${params.to.join(", ")}`);
    return true;
  } catch (err) {
    console.error("[MSG91 Exception]", err);
    logger.error("Failed to send email via MSG91:", err);
    return false;
  }
}

/**
 * Send email using Nodemailer (SMTP)
 */
async function sendNodemailerEmail(
  config: { host: string; port: number; user: string; pass: string; secure: boolean },
  params: {
    fromEmail: string;
    fromName: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }
): Promise<boolean> {
  if (!config.user || !config.pass) {
    console.warn("[Nodemailer Warning] SMTP credentials not configured. Email skipped.");
    logger.warn("[Nodemailer Warning] SMTP credentials not configured. Email skipped.");
    return false;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465 || config.secure,
      auth: { user: config.user, pass: config.pass },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from: `"${params.fromName}" <${params.fromEmail}>`,
      to: params.to.join(", "),
      subject: params.subject,
      text: params.text,
      html: params.html || params.text.replace(/\n/g, "<br/>"),
      replyTo: params.replyTo,
    });

    console.log(`[Nodemailer Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${info.messageId})`);
    logger.info(`[Nodemailer Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${info.messageId})`);
    return true;
  } catch (err) {
    console.error("[Nodemailer Exception]", err);
    logger.error("Failed to send email via Nodemailer:", err);
    return false;
  }
}

/**
 * Send email using Resend
 */
async function sendResendEmail(
  apiKey: string,
  notifyEmail: string,
  params: {
    fromEmail: string;
    fromName: string;
    to: string[];
    subject: string;
    text: string;
    html?: string;
    replyTo?: string;
  }
): Promise<boolean> {
  const resendClient = getResendClient(apiKey);
  if (!resendClient) {
    console.warn("[Resend Warning] RESEND_API_KEY is not configured. Email skipped.");
    logger.warn("[Resend Warning] RESEND_API_KEY is not configured. Email skipped.");
    return false;
  }

  try {
    const res = await resendClient.emails.send({
      from: `${params.fromName} <${params.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
      replyTo: params.replyTo,
    });

    if (res.error) {
      console.error(`[Resend Error] ${res.error.name}: ${res.error.message}`);
      logger.error(`[Resend Error] ${res.error.name}: ${res.error.message}`);

      if (res.error.message?.includes("testing emails to your own email address") && notifyEmail && !params.to.includes(notifyEmail)) {
        console.log(`[Resend Test Fallback] Resending email to verified test recipient: ${notifyEmail}`);
        const fallbackRes = await resendClient.emails.send({
          from: `${params.fromName} <${params.fromEmail}>`,
          to: [notifyEmail],
          subject: params.subject,
          text: params.text,
          html: params.html,
          replyTo: params.replyTo,
        });
        if (fallbackRes.error) {
          console.error(`[Resend Fallback Error] ${fallbackRes.error.message}`);
        } else {
          console.log(`[Resend Fallback Sent] Success ID: ${fallbackRes.data?.id}`);
        }
      }
      return false;
    } else {
      console.log(`[Resend Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${res.data?.id})`);
      logger.info(`[Resend Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${res.data?.id})`);
      return true;
    }
  } catch (err) {
    console.error("[Resend Exception]", err);
    logger.error("Failed to send email via Resend:", err);
    return false;
  }
}

/**
 * Universal email dispatcher that respects dynamic settings from DB or env (default: msg91)
 */
export async function sendEmailSafely(params: SendEmailParams): Promise<void> {
  const config = await getEmailConfig();

  if (!config.isEnabled) {
    logger.info(`[Email Disabled] Skipping email "${params.subject}" to ${params.to.join(", ")}`);
    return;
  }

  // Ensure chosen provider is enabled by admin
  if (config.provider === "msg91" && !config.msg91Enabled) {
    logger.info(`[Email MSG91 Disabled] Skipping email "${params.subject}" to ${params.to.join(", ")} because MSG91 is turned off.`);
    return;
  }
  if ((config.provider === "nodemailer" || config.provider === "smtp") && !config.smtpEnabled) {
    logger.info(`[Email SMTP Disabled] Skipping email "${params.subject}" to ${params.to.join(", ")} because SMTP is turned off.`);
    return;
  }
  if (config.provider === "resend" && !config.resendEnabled) {
    logger.info(`[Email Resend Disabled] Skipping email "${params.subject}" to ${params.to.join(", ")} because Resend is turned off.`);
    return;
  }

  const { fromEmail, fromName } = await resolveSenderIdentity(
    params.category,
    params.countryCode,
    params.from,
    params.fromName
  );

  const emailParams = {
    fromEmail,
    fromName,
    to: params.to,
    subject: params.subject,
    text: params.text,
    html: params.html,
    replyTo: params.replyTo,
  };

  let sent = false;

  if (config.provider === "nodemailer" || config.provider === "smtp") {
    sent = await sendNodemailerEmail(
      {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        secure: config.smtpSecure,
      },
      emailParams
    );
  } else if (config.provider === "resend") {
    sent = await sendResendEmail(config.resendApiKey, config.notify, emailParams);
  } else {
    // Default: msg91
    sent = await sendMsg91Email(config.msg91AuthKey, config.msg91Domain || undefined, emailParams);
  }

  // Automatic fallback: if primary provider did not send and SMTP is configured, attempt SMTP
  if (!sent && config.provider !== "nodemailer" && config.provider !== "smtp" && config.smtpUser && config.smtpPass) {
    logger.info(`[Email Fallback] Primary provider ${config.provider} did not deliver. Attempting fallback delivery via SMTP for "${params.subject}" to ${params.to.join(", ")}`);
    await sendNodemailerEmail(
      {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        secure: config.smtpSecure,
      },
      emailParams
    );
  }
}

export async function sendCustomerPasswordResetEmail(data: {
  email: string;
  firstName: string;
  resetToken: string;
  countryCode?: string;
}): Promise<void> {
  const resetBaseUrl =
    process.env.CUSTOMER_PASSWORD_RESET_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password`;
  const separator = resetBaseUrl.includes("?") ? "&" : "?";
  const resetUrl = `${resetBaseUrl}${separator}token=${encodeURIComponent(data.resetToken)}`;

  const textContent = [
    `Dear ${data.firstName || "Customer"},`,
    "",
    "We received a request to reset your Modern Orthodontics account password.",
    "Use the link below to choose a new password. This link expires in 1 hour.",
    "",
    resetUrl,
    "",
    "If you did not request this, you can ignore this email.",
    "",
    "Modern Orthodontics Team",
  ].join("\n");

  const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your password</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e4e4e7;">
          <tr>
            <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f4f4f5;">
              <span style="font-size: 18px; font-weight: 700; color: #E31E24; letter-spacing: -0.5px;">MODERN ORTHODONTICS</span>
            </td>
          </tr>
          <tr>
            <td style="padding: 32px; text-align: left;">
              <h2 style="margin: 0 0 16px; font-size: 18px; font-weight: 600; color: #09090b;">Password Reset Request</h2>
              <p style="margin: 0 0 16px; font-size: 14px; line-height: 24px; color: #52525b;">
                Dear ${data.firstName || "Customer"},
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 24px; color: #52525b;">
                We received a request to reset the password for your Modern Orthodontics account. Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.
              </p>
              <table border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 24px;">
                <tr>
                  <td align="center" style="border-radius: 8px; background-color: #E31E24;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 13px; line-height: 20px; color: #71717a;">
                Or copy and paste this link into your browser:
              </p>
              <p style="margin: 0 0 24px; font-size: 12px; line-height: 18px; word-break: break-all; color: #2563eb;">
                <a href="${resetUrl}" target="_blank" style="color: #2563eb; text-decoration: underline;">${resetUrl}</a>
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 20px; color: #71717a;">
                If you did not request this password reset, no action is needed. Your account remains secure.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px; background-color: #fafafa; border-top: 1px solid #f4f4f5; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
                &copy; Modern Orthodontics. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmailSafely({
    category: "auth",
    countryCode: data.countryCode,
    to: [data.email],
    subject: "Reset your Modern Orthodontics password",
    text: textContent,
    html: htmlContent,
  });
}

export async function sendCustomerApprovalEmail(data: { email: string; firstName: string; countryCode?: string }): Promise<void> {
  await sendEmailSafely({
    category: "auth",
    countryCode: data.countryCode,
    to: [data.email],
    subject: "Your Modern Orthodontics account has been approved",
    text: [
      `Dear ${data.firstName},`,
      "",
      "Your account has been approved. You can now place orders through Modern Orthodontics.",
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendCustomerRejectionEmail(data: { email: string; firstName: string; countryCode?: string }): Promise<void> {
  await sendEmailSafely({
    category: "auth",
    countryCode: data.countryCode,
    to: [data.email],
    subject: "Modern Orthodontics account request update",
    text: [
      `Dear ${data.firstName},`,
      "",
      "Your account request was not approved at this time. Please contact support if you believe this needs review.",
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendQuoteNotification(data: QuoteEmailData & { countryCode?: string }): Promise<void> {
  const config = await getEmailConfig();
  const itemRows = data.items
    .map((item) => {
      const skuLabel = item.sku ? ` [${item.sku}]` : "";
      return `  • ${item.productTitle}${skuLabel} × ${item.quantity} @ ${formatCurrency(item.unitPrice)}`;
    })
    .join("\n");
  const discount = Number(data.discount || 0);
  const summaryRows = [
    `Subtotal: ${formatCurrency(data.subtotal)}`,
    discount > 0 ? `Volume Discount${data.discountPercent ? ` (${data.discountPercent}%)` : ""}: -${formatCurrency(discount)}` : "",
    data.total != null ? `Estimated Total: ${formatCurrency(data.total)}` : "",
  ].filter(Boolean);

  // Admin Notification
  await sendEmailSafely({
    category: "quotes",
    countryCode: data.countryCode,
    to: [config.notify],
    replyTo: data.customerEmail,
    subject: `New Quote Request — ${data.quoteNumber}`,
    text: [
      `Quote Number: ${data.quoteNumber}`,
      `Customer: ${data.customerName} <${data.customerEmail}>`,
      data.customerPhone ? `Phone: ${data.customerPhone}` : "",
      data.companyName ? `Company: ${data.companyName}` : "",
      "",
      "Items:",
      itemRows,
      "",
      ...summaryRows,
      data.notes ? `\nNotes: ${data.notes}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  });

  // Customer Confirmation
  await sendEmailSafely({
    category: "quotes",
    countryCode: data.countryCode,
    to: [data.customerEmail],
    subject: `We received your quote request — ${data.quoteNumber}`,
    text: [
      `Dear ${data.customerName},`,
      "",
      "Thank you for your quote request. Our team will review it and respond within 24 hours.",
      "",
      `Quote Reference: ${data.quoteNumber}`,
      "",
      "Items requested:",
      itemRows,
      "",
      ...summaryRows,
      "",
      "Best regards,",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendQuoteConvertedEmail(data: {
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
  orderNumber: string;
  total: number;
  countryCode?: string;
}): Promise<void> {
  await sendEmailSafely({
    category: "quotes",
    countryCode: data.countryCode,
    to: [data.customerEmail],
    subject: `Your quote was approved - ${data.quoteNumber}`,
    text: [
      `Dear ${data.customerName},`,
      "",
      "Your quote has been approved and converted into an order.",
      "",
      `Quote Reference: ${data.quoteNumber}`,
      `Order Number: ${data.orderNumber}`,
      `Order Total: ${formatCurrency(data.total)}`,
      "",
      "Our team will follow up with the next steps.",
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendQuoteSentEmail(data: {
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
  total: number;
  countryCode?: string;
}): Promise<void> {
  await sendEmailSafely({
    category: "quotes",
    countryCode: data.countryCode,
    to: [data.customerEmail],
    subject: `Your Quote Proposal is Ready — ${data.quoteNumber}`,
    text: [
      `Dear ${data.customerName},`,
      "",
      `We have prepared your custom price quotation (${data.quoteNumber}).`,
      "",
      `Quotation Total: ${formatCurrency(data.total)}`,
      "",
      "You can view, review, and accept or decline this quote directly from your account portal:",
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/account`,
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendContactNotification(data: ContactEmailData & { countryCode?: string }): Promise<void> {
  const config = await getEmailConfig();
  await sendEmailSafely({
    category: "support",
    countryCode: data.countryCode,
    to: [config.notify],
    replyTo: data.email,
    subject: `Contact Form — ${data.type ?? "general"}: ${data.subject ?? data.name}`,
    text: [
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      data.phone ? `Phone: ${data.phone}` : "",
      data.company ? `Company: ${data.company}` : "",
      data.country ? `Country: ${data.country}` : "",
      data.subject ? `Subject: ${data.subject}` : "",
      `Type: ${data.type ?? "general"}`,
      "",
      "Message:",
      data.message,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendOrderStatusEmail(data: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  status: string;
  trackingNumber?: string;
  trackingUrl?: string;
  items?: { productTitle: string; sku?: string; quantity: number; unitPrice: number }[];
  total?: number;
  countryCode?: string;
}): Promise<void> {
  const trackingInfo = data.trackingNumber
    ? `\nTracking Number: ${data.trackingNumber}${data.trackingUrl ? `\nTrack your shipment: ${data.trackingUrl}` : ""}`
    : "";

  const itemsInfo =
    data.items && data.items.length > 0
      ? "\n\nItems in this order:\n" +
        data.items
          .map((item) => `  • ${item.productTitle}${item.sku ? ` [${item.sku}]` : ""} × ${item.quantity} @ ${formatCurrency(item.unitPrice)}`)
          .join("\n")
      : "";

  const totalInfo = data.total != null ? `\nOrder Total: ${formatCurrency(data.total)}` : "";

  await sendEmailSafely({
    category: "orders",
    countryCode: data.countryCode,
    to: [data.customerEmail],
    subject: `Order Update — #${data.orderNumber} is ${data.status}`,
    text: [
      `Dear ${data.customerName},`,
      "",
      `Your order #${data.orderNumber} status has been updated to: ${data.status}.`,
      trackingInfo,
      totalInfo,
      itemsInfo,
      "",
      "You can view your order details anytime in your account dashboard:",
      `${process.env.FRONTEND_URL || "http://localhost:3000"}/account/orders`,
      "",
      "Best regards,",
      "Modern Orthodontics Team",
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendNewsletterWelcomeEmail(email: string, countryCode?: string): Promise<void> {
  const unsubscribeUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
  await sendEmailSafely({
    category: "newsletter",
    countryCode,
    to: [email],
    subject: "Welcome to the Modern Orthodontics Newsletter",
    text: [
      "Hello,",
      "",
      "Thank you for subscribing to the Modern Orthodontics newsletter. You will now receive updates on our latest products, news, and special offers.",
      "",
      "If you wish to unsubscribe at any time, please click the link below:",
      unsubscribeUrl,
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
    html: `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h2 style="color: #e31e24; margin-bottom: 20px;">Modern Orthodontics</h2>
        <p>Hello,</p>
        <p>Thank you for subscribing to the Modern Orthodontics newsletter. You will now receive updates on our latest products, news, and special offers.</p>
        <p>Best regards,<br/>Modern Orthodontics Team</p>
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 11px; color: #666; text-align: center;">
          You are receiving this because you subscribed to our newsletter.
          <br/>
          <a href="${unsubscribeUrl}" style="color: #e31e24; text-decoration: underline;">Unsubscribe</a> at any time.
        </p>
      </div>
    `,
  });
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}

/**
 * Sends a real test email to verify credentials and API connection for MSG91, SMTP, or Resend
 */
export async function sendTestEmailDirectly(
  toEmail: string,
  providerOverride?: string
): Promise<{ success: boolean; message: string; provider: string }> {
  const config = await getEmailConfig();
  const provider = (providerOverride || config.provider || "msg91").trim().toLowerCase();

  const testSubject = "Test Email from Modern Orthodontics";
  const testHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 8px;">
      <h2 style="color: #e31e24; margin: 0 0 12px 0;">Modern Orthodontics</h2>
      <p style="font-size: 15px; color: #1f2937; line-height: 1.5;">This is a test email sent from your <strong>${provider.toUpperCase()}</strong> email configuration.</p>
      <p style="font-size: 13px; color: #4b5563;">Timestamp: ${new Date().toUTCString()}</p>
      <div style="margin-top: 20px; padding: 14px; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 12.5px; color: #374151; line-height: 1.6;">
        <div><strong>Sender Name:</strong> ${config.fromName}</div>
        <div><strong>Sender Email:</strong> ${config.fromEmail}</div>
        <div><strong>Active Provider:</strong> ${provider.toUpperCase()}</div>
        ${config.msg91Domain ? `<div><strong>MSG91 Domain:</strong> ${config.msg91Domain}</div>` : ""}
        <div><strong>Status:</strong> Connected & Operational</div>
      </div>
      <p style="font-size: 11.5px; color: #9ca3af; margin-top: 20px; margin-bottom: 0;">Modern Orthodontics System Diagnostics</p>
    </div>
  `;

  const emailParams = {
    fromEmail: config.fromEmail,
    fromName: config.fromName,
    to: [toEmail.trim()],
    subject: testSubject,
    text: `Test email from Modern Orthodontics via ${provider.toUpperCase()} at ${new Date().toISOString()}.`,
    html: testHtml,
  };

  if (provider === "nodemailer" || provider === "smtp") {
    if (!config.smtpUser || !config.smtpPass) {
      return { success: false, message: "SMTP Username or Password is not saved in settings.", provider: "nodemailer" };
    }
    const ok = await sendNodemailerEmail(
      {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.smtpUser,
        pass: config.smtpPass,
        secure: config.smtpSecure,
      },
      emailParams
    );
    return ok
      ? { success: true, message: `Test email successfully sent to ${toEmail} via SMTP.`, provider: "nodemailer" }
      : { success: false, message: "SMTP failed to deliver test email. Check your SMTP host, port, username, and password.", provider: "nodemailer" };
  } else if (provider === "resend") {
    if (!config.resendApiKey) {
      return { success: false, message: "Resend API Key is missing. Please save your API Key first.", provider: "resend" };
    }
    const ok = await sendResendEmail(config.resendApiKey, config.notify, emailParams);
    return ok
      ? { success: true, message: `Test email successfully sent to ${toEmail} via Resend.`, provider: "resend" }
      : { success: false, message: "Resend API rejected the email. Check your Resend API Key and verified domain.", provider: "resend" };
  } else {
    // msg91
    if (!config.msg91AuthKey) {
      return { success: false, message: "MSG91 AuthKey is missing. Please enter and save your MSG91 AuthKey.", provider: "msg91" };
    }
    const ok = await sendMsg91Email(config.msg91AuthKey, config.msg91Domain || undefined, emailParams);
    return ok
      ? { success: true, message: `Test email successfully sent to ${toEmail} via MSG91!`, provider: "msg91" }
      : { success: false, message: "MSG91 rejected the email. Verify that your MSG91 AuthKey is valid and your sender domain/email is configured in MSG91.", provider: "msg91" };
  }
}
