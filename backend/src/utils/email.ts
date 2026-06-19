import { Resend } from "resend";
import { logger } from "../config/logger";

const resend = new Resend(process.env.RESEND_API_KEY);
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

export async function sendQuoteNotification(data: QuoteEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const itemRows = data.items
    .map((i) => `  • ${i.productTitle}${i.sku ? ` [${i.sku}]` : ""} × ${i.quantity} @ ₹${i.unitPrice}`)
    .join("\n");

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
        `Subtotal: ₹${data.subtotal}`,
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
        "Best regards,",
        "Modern Orthodontics Team",
      ].join("\n"),
    });
  } catch (err) {
    logger.error("Failed to send quote email:", err);
  }
}

export async function sendContactNotification(data: ContactEmailData): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

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
