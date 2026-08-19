import PDFDocument from "pdfkit";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { getSettingValue } from "../settings/settings.service";

type PdfDoc = InstanceType<typeof PDFDocument>;

function money(symbol: string, value: unknown) {
  return `${symbol}${Number(value ?? 0).toFixed(2)}`;
}

function textValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function formatDate(date: Date | string | null, timeZone = "Asia/Kolkata") {
  if (!date) return "-";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
    }).format(new Date(date));
  } catch {
    return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "2-digit" }).format(new Date(date));
  }
}

function addRightAmount(doc: PdfDoc, label: string, amount: string, y: number, bold = false) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5);
  doc.text(label, 300, y, { width: 140, align: "right" });
  doc.text(amount, 450, y, { width: 90, align: "right" });
}

function maybeNewPage(doc: PdfDoc, y: number) {
  if (y < 700) return y;
  doc.addPage();
  return 60;
}

export async function generateQuotePdf(quoteId: string): Promise<Buffer> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      customer: true,
    },
  });
  if (!quote) throw new AppError("Quote not found.", 404);

  const [siteNameSetting, siteUrlSetting, timezoneSetting] = await Promise.all([
    getSettingValue("general.site_name").catch(() => ""),
    getSettingValue("general.site_url").catch(() => ""),
    getSettingValue("general.timezone").catch(() => "Asia/Kolkata"),
  ]);
  const timezone = timezoneSetting || "Asia/Kolkata";
  const storeName = process.env.STORE_NAME || siteNameSetting || "Modern Orthodontics";
  const storeAddress = process.env.STORE_ADDRESS || "";
  const storeEmail = process.env.STORE_EMAIL || process.env.EMAIL_FROM || "info@modernortho.com";
  const storeUrl = process.env.STORE_URL || siteUrlSetting || "";
  const sym = quote.currency?.symbol ?? "$";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Header
    doc.font("Helvetica-Bold").fontSize(18).text(storeName, 50, 50);
    doc.font("Helvetica").fontSize(9);
    let storeY = 75;
    for (const line of [storeAddress, storeEmail, storeUrl].filter(Boolean)) {
      doc.text(line, 50, storeY, { width: 250 });
      storeY += 12;
    }

    doc.font("Helvetica-Bold").fontSize(22).fillColor("#E31E24").text("QUOTATION", 360, 50, { width: 180, align: "right" });
    doc.font("Helvetica").fontSize(9).fillColor("#111111");
    doc.text(`Quote #: ${quote.quoteNumber}`, 360, 78, { width: 180, align: "right" });
    doc.text(`Date: ${formatDate(quote.createdAt, timezone)}`, 360, 92, { width: 180, align: "right" });
    if (quote.expiresAt) {
      doc.text(`Valid Until: ${formatDate(quote.expiresAt, timezone)}`, 360, 106, { width: 180, align: "right" });
    }
    doc.text(`Status: ${quote.status}`, 360, 120, { width: 180, align: "right" });

    doc.moveTo(50, 140).lineTo(545, 140).strokeColor("#dddddd").stroke();

    // Customer Info
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#111111").text("Prepared For:", 50, 155);
    doc.font("Helvetica").fontSize(9.5);
    const customerLines = [
      quote.customerName,
      quote.companyName ? `Company: ${quote.companyName}` : null,
      `Email: ${quote.customerEmail}`,
      quote.customerPhone ? `Phone: ${quote.customerPhone}` : null,
      `Country: ${quote.country.name} (${quote.country.code})`,
    ].filter(Boolean);

    let y = 172;
    for (const line of customerLines) {
      doc.text(textValue(line), 50, y, { width: 260 });
      y += 13;
    }

    y = Math.max(y + 20, 245);

    // Line Items Table Header
    doc.font("Helvetica-Bold").fontSize(10);
    doc.rect(50, y, 495, 22).fill("#f4f4f4");
    doc.fillColor("#111111");
    doc.text("#", 58, y + 6, { width: 22 });
    doc.text("Product Description", 85, y + 6, { width: 185 });
    doc.text("Variant / SKU", 270, y + 6, { width: 105 });
    doc.text("Qty", 375, y + 6, { width: 35, align: "right" });
    doc.text("Unit Price", 415, y + 6, { width: 55, align: "right" });
    doc.text("Total", 475, y + 6, { width: 65, align: "right" });
    y += 26;

    // Items
    doc.font("Helvetica").fontSize(9);
    quote.items.forEach((item, idx) => {
      y = maybeNewPage(doc, y);
      const title = item.title || item.product?.title || "Product";
      const variantTitle = item.variant?.title ?? item.sku ?? "-";
      const unitPriceStr = money(sym, item.unitPrice);
      const totalStr = money(sym, item.total);

      doc.text(String(idx + 1), 58, y, { width: 22 });
      doc.text(title, 85, y, { width: 180 });
      doc.text(variantTitle, 270, y, { width: 100 });
      doc.text(String(item.quantity), 375, y, { width: 35, align: "right" });
      doc.text(unitPriceStr, 415, y, { width: 55, align: "right" });
      doc.text(totalStr, 475, y, { width: 65, align: "right" });
      y += 18;
    });

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).strokeColor("#eeeeee").stroke();
    y += 12;

    // Summary Totals
    addRightAmount(doc, "Subtotal:", money(sym, quote.subtotal), y);
    y += 14;

    if (Number(quote.shippingCharge) > 0) {
      addRightAmount(doc, "Shipping Charge:", money(sym, quote.shippingCharge), y);
      y += 14;
    }

    if (Number(quote.discount) > 0) {
      addRightAmount(doc, "Discount:", `-${money(sym, quote.discount)}`, y);
      y += 14;
    }

    doc.moveTo(300, y + 2).lineTo(545, y + 2).strokeColor("#dddddd").stroke();
    y += 8;
    addRightAmount(doc, "Grand Total:", money(sym, quote.total), y, true);
    y += 30;

    // Notes
    if (quote.notes) {
      y = maybeNewPage(doc, y);
      doc.font("Helvetica-Bold").fontSize(10).text("Notes & Terms:", 50, y);
      y += 14;
      doc.font("Helvetica").fontSize(8.5).fillColor("#444444").text(quote.notes, 50, y, { width: 495 });
    }

    doc.end();
  });
}
