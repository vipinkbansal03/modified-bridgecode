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

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-IN", { year: "numeric", month: "short", day: "2-digit" }).format(date);
}

function shippingAddressLines(address: unknown): string[] {
  if (!address || typeof address !== "object") return [];
  const record = address as Record<string, unknown>;
  return [
    record.fullName,
    record.addressLine1,
    record.addressLine2,
    [record.city, record.state, record.postalCode].filter(Boolean).join(", "),
    record.countryCode,
    record.phone ? `Phone: ${record.phone}` : null,
  ].filter((line): line is string => Boolean(line));
}

function addRightAmount(doc: PdfDoc, label: string, amount: string, y: number, bold = false) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 11 : 9.5);
  doc.fillColor(bold ? "#0f172a" : "#475569");
  doc.text(label, 260, y, { width: 180, align: "right" });
  doc.text(amount, 450, y, { width: 95, align: "right" });
}

function maybeNewPage(doc: PdfDoc, y: number) {
  if (y < 700) return y;
  doc.addPage();
  return 60;
}

export async function generateInvoice(orderId: string): Promise<Buffer> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { include: { addresses: { include: { country: true }, orderBy: { isDefault: "desc" }, take: 1 } } },
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      shippingZone: { include: { provider: true, country: true } },
      warehouse: true,
    },
  });
  if (!order) throw new AppError("Order not found.", 404);

  const [siteNameSetting, siteUrlSetting, sellerName, sellerIec] = await Promise.all([
    getSettingValue("general.site_name").catch(() => ""),
    getSettingValue("general.site_url").catch(() => ""),
    getSettingValue("tax.seller_name").catch(() => "Modern Orthodontics Pvt Ltd"),
    getSettingValue("tax.seller_iec").catch(() => ""),
  ]);

  const shipFromState = order.warehouse?.state || "Punjab";
  const sellerGstin = order.warehouse?.gstin || "";
  const storeName = process.env.STORE_NAME || sellerName || siteNameSetting || "Store";
  const storeAddress = process.env.STORE_ADDRESS || "";
  const storeEmail = process.env.STORE_EMAIL || process.env.EMAIL_FROM || "";
  const storeUrl = process.env.STORE_URL || siteUrlSetting || "";
  let symbol = order.currency?.symbol ?? "";
  if (symbol === "₹") {
    symbol = "Rs. ";
  }
  const invoiceNumber = `INV-${order.orderNumber || order.id.slice(-8)}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // 1. Top Accent Brand Banner
    doc.rect(0, 0, 595, 10).fill("#E31E24");

    // 2. Brand / Seller Title & Document Title Y = 38
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0f172a").text(storeName, 50, 38);
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#E31E24").text("INVOICE", 300, 32, { width: 245, align: "right" });

    // 3. Metadata Dashboard Card (Horizontal Layout) Y = 70
    const cardY = 70;
    doc.rect(50, cardY, 495, 44).fill("#f8fafc");
    doc.rect(50, cardY, 495, 44).strokeColor("#e2e8f0").lineWidth(1).stroke();

    // Invoice Number Column
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("INVOICE NUMBER", 65, cardY + 8);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(invoiceNumber, 65, cardY + 20);

    // Date Column
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("DATE OF ISSUE", 240, cardY + 8);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(formatDate(order.createdAt), 240, cardY + 20);

    // Order Number Column
    doc.font("Helvetica-Bold").fontSize(8).fillColor("#64748b").text("ORDER NUMBER", 390, cardY + 8);
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(order.orderNumber, 390, cardY + 20);

    // 4. Billing & Vendor Information columns side-by-side Y = 135
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#64748b").text("SOLD BY", 50, 135);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#64748b").text("BILL TO", 315, 135);

    // Left Column details (Seller)
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(storeName, 50, 150);
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    let storeY = 165;
    for (const line of [storeAddress, storeEmail, storeUrl].filter(Boolean)) {
      doc.text(line, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (sellerGstin) {
      doc.text(`GSTIN: ${sellerGstin}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (sellerIec && (order as any).isZeroRated) {
      doc.text(`IEC: ${sellerIec}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    doc.text(`Ship-From State: ${shipFromState}`, 50, storeY, { width: 235 });
    storeY += 13;

    // Right Column details (Buyer)
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(order.customerName, 315, 150);
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    const addressLines = shippingAddressLines(order.shippingAddress);
    const fallbackAddress = order.customer?.addresses?.[0]
      ? [
          order.customer.addresses[0].fullName,
          order.customer.addresses[0].addressLine1,
          order.customer.addresses[0].addressLine2,
          `${order.customer.addresses[0].city}, ${order.customer.addresses[0].state} ${order.customer.addresses[0].postalCode}`,
          order.customer.addresses[0].country.code,
        ].filter(Boolean)
      : [];
    const billLines = [
      order.customerEmail,
      ...((addressLines.length ? addressLines : fallbackAddress) as string[]),
      (order as any).taxIdSnapshot ? `${(order as any).taxIdTypeSnapshot || 'Tax ID'}: ${(order as any).taxIdSnapshot}` : null,
    ].filter(Boolean);

    let billY = 165;
    for (const line of billLines) {
      doc.text(textValue(line), 315, billY, { width: 230 });
      billY += 13;
    }

    // Dynamic Y position for table header
    let tableY = Math.max(storeY, billY) + 20;

    // 5. Items Table Header
    doc.rect(50, tableY, 495, 26).fill("#1e293b");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(9.5);
    doc.text("#", 55, tableY + 8, { width: 20 });
    doc.text("Product (Code / HSN)", 80, tableY + 8, { width: 135 });
    doc.text("Variant", 220, tableY + 8, { width: 160 });
    doc.text("Qty", 385, tableY + 8, { width: 25, align: "right" });
    doc.text("Taxable Val", 415, tableY + 8, { width: 65, align: "right" });
    doc.text("Line Total", 485, tableY + 8, { width: 60, align: "right" });

    let y = tableY + 30;

    // Items list rows
    order.items.forEach((item, index) => {
      y = maybeNewPage(doc, y);
      const rowTop = y;

      const hsnCode = (item as any).hsnCode || (item.product as any)?.hsnCode || null;
      const displayHsn = hsnCode ? `HSN: ${hsnCode}` : "HSN: Not Assigned";

      const itemTaxMode = (item as any).taxMode || (order as any).taxMode || "EXCLUSIVE";
      const rawRate = (item as any).taxRate ?? (item as any).taxPercent ?? (order as any).taxRate ?? null;
      const unitPrice = Number(item.unitPrice);

      let unitTaxableValue = unitPrice;
      if (rawRate === null || rawRate === undefined || isNaN(Number(rawRate))) {
        unitTaxableValue = Math.round(unitPrice * 100) / 100;
      } else {
        const itemTaxRate = Number(rawRate);
        if (itemTaxMode === "INCLUSIVE" && itemTaxRate > 0) {
          unitTaxableValue = Math.round((unitPrice / (1 + itemTaxRate / 100)) * 100) / 100;
        } else {
          unitTaxableValue = Math.round(unitPrice * 100) / 100;
        }
      }

      const prodHeight = doc.heightOfString(`${item.product?.title ?? item.title}\n(${displayHsn})`, { width: 135 });
      const variantHeight = doc.heightOfString(item.variant?.title ?? item.title ?? "-", { width: 160 });
      const rowHeight = Math.max(prodHeight, variantHeight, 20) + 12;

      // Draw alternating row background for readability
      if (index % 2 === 1) {
        doc.rect(50, rowTop - 2, 495, rowHeight).fill("#f8fafc");
      }

      doc.fillColor("#334155").font("Helvetica").fontSize(9);
      doc.text(String(index + 1), 55, rowTop + 4, { width: 20 });
      doc.text(`${item.product?.title ?? item.title}\n(${displayHsn})`, 80, rowTop + 4, { width: 135 });
      doc.text(item.variant?.title ?? item.title ?? "-", 220, rowTop + 4, { width: 160 });
      doc.text(String(item.quantity), 385, rowTop + 4, { width: 25, align: "right" });
      doc.text(money(symbol, unitTaxableValue), 415, rowTop + 4, { width: 65, align: "right" });
      doc.text(money(symbol, item.total), 485, rowTop + 4, { width: 60, align: "right" });

      y = rowTop + rowHeight;
      doc.moveTo(50, y - 2).lineTo(545, y - 2).strokeColor("#e2e8f0").lineWidth(0.75).stroke();
    });

    // Summary calculation
    const isTaxInclusive = (order as any).taxMode === "INCLUSIVE";
    const totalTax = Number(order.taxAmount ?? 0);
    const taxableSubtotal = isTaxInclusive ? Number(order.subtotal) - totalTax : Number(order.subtotal);

    y = maybeNewPage(doc, y + 15);
    addRightAmount(doc, "Subtotal (Taxable Value)", money(symbol, taxableSubtotal), y);
    y += 18;

    const couponDiscount = Number(order.couponDiscount ?? 0);
    const genericDiscount = Number(order.discount ?? 0);
    if (genericDiscount > 0 && !order.couponCode) {
      addRightAmount(doc, "Tier/MOQ Discount", `-${money(symbol, genericDiscount)}`, y);
      y += 18;
    }
    if (order.couponCode && couponDiscount > 0) {
      addRightAmount(doc, `Coupon (${order.couponCode})`, `-${money(symbol, couponDiscount)}`, y);
      y += 18;
    }

    const cgst = Number((order as any).cgstAmount ?? 0);
    const sgst = Number((order as any).sgstAmount ?? 0);
    const igst = Number((order as any).igstAmount ?? 0);
    const vat = Number((order as any).vatAmount ?? 0);
    const taxLabel = String((order as any).taxLabel ?? "Tax");

    if ((order as any).isZeroRated) {
      addRightAmount(doc, "Zero-Rated Export (LUT)", money(symbol, 0), y);
      y += 18;
    } else if (taxLabel === "VAT Reverse Charge") {
      addRightAmount(doc, "VAT Treatment", "Reverse Charge", y);
      y += 18;
      addRightAmount(doc, "VAT", money(symbol, 0), y);
      y += 18;
    } else if (cgst > 0 || sgst > 0) {
      addRightAmount(doc, "CGST", `+${money(symbol, cgst)}`, y);
      y += 18;
      addRightAmount(doc, "SGST", `+${money(symbol, sgst)}`, y);
      y += 18;
    } else if (igst > 0) {
      addRightAmount(doc, "IGST", `+${money(symbol, igst)}`, y);
      y += 18;
    } else if (vat > 0) {
      addRightAmount(doc, "VAT", `+${money(symbol, vat)}`, y);
      y += 18;
    } else {
      addRightAmount(doc, "Tax Exempt (0%)", money(symbol, 0), y);
      y += 18;
    }

    if ((order as any).isZeroRated) {
      y = maybeNewPage(doc, y + 10);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#475569");
      doc.text("Declaration: Supply meant for export under bond or letter of undertaking (LUT) without payment of integrated tax.", 50, y, { width: 495 });
      y += 18;
    }
    if ((order as any).taxIdSnapshot) {
      y = maybeNewPage(doc, y + 4);
      doc.font("Helvetica-Oblique").fontSize(8).fillColor("#475569");
      doc.text(`Buyer VAT ID: ${(order as any).taxIdSnapshot}`, 50, y, { width: 495 });
      y += 18;
    }
    if (Number(order.shippingCharge ?? 0) > 0) {
      addRightAmount(doc, `Shipping (${order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "Shipping"})`, `+${money(symbol, order.shippingCharge)}`, y);
      y += 18;
    }

    // Double lines and highlighted totals block
    doc.moveTo(350, y).lineTo(545, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
    y += 10;
    
    // Draw background block for Grand Total
    doc.rect(280, y - 4, 265, 24).fill("#f1f5f9");
    addRightAmount(doc, "Total", money(symbol, order.total), y + 3, true);
    y += 26;

    // Footer decoration
    const footerY = 750;
    doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor("#e2e8f0").lineWidth(1).stroke();
    
    doc.font("Helvetica").fontSize(8.5).fillColor("#64748b");
    doc.text("Thank you for your order! For support, please contact orders@modortho.com.", 50, footerY);
    doc.text(`Order Status: ${order.status.toUpperCase()} | Computer-Generated Document`, 50, footerY + 13);

    doc.end();
  });
}
