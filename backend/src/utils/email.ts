import { Resend } from "resend";
import { logger } from "../config/logger";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
const FROM = process.env.EMAIL_FROM || "orders@modortho.com";
const NOTIFY = process.env.EMAIL_NOTIFY || "team@modortho.com";

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

export async function sendCustomerPasswordResetEmail(data: {
  email: string;
  firstName: string;
  resetToken: string;
}): Promise<void> {
  if (!resend) return;

  const resetBaseUrl =
    process.env.CUSTOMER_PASSWORD_RESET_URL || `${process.env.FRONTEND_URL || "http://localhost:3000"}/reset-password`;
  const separator = resetBaseUrl.includes("?") ? "&" : "?";
  const resetUrl = `${resetBaseUrl}${separator}token=${encodeURIComponent(data.resetToken)}`;

  try {
    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send customer password reset email:", err);
  }
}

export async function sendCustomerApprovalEmail(data: { email: string; firstName: string }): Promise<void> {
  if (!resend) return;

  try {
    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send customer approval email:", err);
  }
}

export async function sendCustomerRejectionEmail(data: { email: string; firstName: string }): Promise<void> {
  if (!resend) return;

  try {
    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send customer rejection email:", err);
  }
}

export async function sendQuoteNotification(data: QuoteEmailData): Promise<void> {
  if (!resend) return;

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

  try {
    await resend.emails.send({
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

    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send quote email:", err);
  }
}

export async function sendQuoteConvertedEmail(data: {
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
  orderNumber: string;
  total: number;
}): Promise<void> {
  if (!resend) return;

  try {
    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send quote conversion email:", err);
  }
}

export async function sendContactNotification(data: ContactEmailData): Promise<void> {
  if (!resend) return;

  try {
    await resend.emails.send({
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
  } catch (err) {
    logger.error("Failed to send contact email:", err);
  }
}
