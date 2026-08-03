import { Resend } from "resend";
import { logger } from "../config/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY ? process.env.RESEND_API_KEY.trim() : null;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM ? process.env.EMAIL_FROM.trim() : "onboarding@resend.dev";
const NOTIFY = process.env.EMAIL_NOTIFY ? process.env.EMAIL_NOTIFY.trim() : "mayuragarwal2096@gmail.com";

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

async function sendEmailSafely(params: { from: string; to: string[]; subject: string; text: string; html?: string; replyTo?: string }) {
  if (!resend) {
    console.warn("[Resend Warning] RESEND_API_KEY is not configured. Email skipped.");
    logger.warn("[Resend Warning] RESEND_API_KEY is not configured. Email skipped.");
    return;
  }

  try {
    const res = await resend.emails.send(params);
    if (res.error) {
      console.error(`[Resend Error] ${res.error.name}: ${res.error.message}`);
      logger.error(`[Resend Error] ${res.error.name}: ${res.error.message}`);

      // In Resend test mode (onboarding@resend.dev), if recipient is not the account owner, attempt fallback to NOTIFY address
      if (res.error.message?.includes("testing emails to your own email address") && NOTIFY && !params.to.includes(NOTIFY)) {
        console.log(`[Resend Test Fallback] Resending email to verified test recipient: ${NOTIFY}`);
        const fallbackRes = await resend.emails.send({ ...params, to: [NOTIFY] });
        if (fallbackRes.error) {
          console.error(`[Resend Fallback Error] ${fallbackRes.error.message}`);
        } else {
          console.log(`[Resend Fallback Sent] Success ID: ${fallbackRes.data?.id}`);
        }
      }
    } else {
      console.log(`[Resend Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${res.data?.id})`);
      logger.info(`[Resend Email Sent] ${params.subject} -> ${params.to.join(", ")} (ID: ${res.data?.id})`);
    }
  } catch (err) {
    console.error("[Resend Exception]", err);
    logger.error("Failed to send email via Resend:", err);
  }
}

export async function sendCustomerPasswordResetEmail(data: {
  email: string;
  firstName: string;
  resetToken: string;
}): Promise<void> {
  const resetBaseUrl =
    process.env.CUSTOMER_PASSWORD_RESET_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password`;
  const separator = resetBaseUrl.includes("?") ? "&" : "?";
  const resetUrl = `${resetBaseUrl}${separator}token=${encodeURIComponent(data.resetToken)}`;

  await sendEmailSafely({
    from: FROM,
    to: [data.email],
    subject: "Reset your Modern Orthodontics password",
    text: [
      `Dear ${data.firstName},`,
      "",
      "We received a request to reset your Modern Orthodontics account password.",
      "Use the link below to choose a new password. This link expires in 1 hour.",
      "",
      resetUrl,
      "",
      "If you did not request this, you can ignore this email.",
      "",
      "Modern Orthodontics Team",
    ].join("\n"),
  });
}

export async function sendCustomerApprovalEmail(data: { email: string; firstName: string }): Promise<void> {
  await sendEmailSafely({
    from: FROM,
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

export async function sendCustomerRejectionEmail(data: { email: string; firstName: string }): Promise<void> {
  await sendEmailSafely({
    from: FROM,
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

export async function sendQuoteNotification(data: QuoteEmailData): Promise<void> {
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
    from: FROM,
    to: [NOTIFY],
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
    from: FROM,
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
}): Promise<void> {
  await sendEmailSafely({
    from: FROM,
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
}): Promise<void> {
  await sendEmailSafely({
    from: FROM,
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

export async function sendContactNotification(data: ContactEmailData): Promise<void> {
  await sendEmailSafely({
    from: FROM,
    to: [NOTIFY],
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

export async function sendNewsletterWelcomeEmail(email: string): Promise<void> {
  const unsubscribeUrl = `${process.env.FRONTEND_URL || "http://localhost:3000"}/newsletter/unsubscribe?email=${encodeURIComponent(email)}`;
  await sendEmailSafely({
    from: FROM,
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
