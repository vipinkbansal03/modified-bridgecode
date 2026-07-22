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
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 12 : 10);
  doc.text(label, 300, y, { width: 140, align: "right" });
  doc.text(amount, 450, y, { width: 90, align: "right" });
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
    },
  });
  if (!order) throw new AppError("Order not found.", 404);

  const [siteNameSetting, siteUrlSetting] = await Promise.all([
    getSettingValue("general.site_name").catch(() => ""),
    getSettingValue("general.site_url").catch(() => ""),
  ]);
  const storeName = process.env.STORE_NAME || siteNameSetting || "Store";
  const storeAddress = process.env.STORE_ADDRESS || "";
  const storeEmail = process.env.STORE_EMAIL || process.env.EMAIL_FROM || "";
  const storeUrl = process.env.STORE_URL || siteUrlSetting || "";
  const symbol = order.currency?.symbol ?? "";
  const invoiceNumber = `INV-${order.orderNumber || order.id.slice(-8)}`;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.font("Helvetica-Bold").fontSize(20).text(storeName, 50, 50);
    doc.font("Helvetica").fontSize(9);
    let storeY = 78;
    for (const line of [storeAddress, storeEmail, storeUrl].filter(Boolean)) {
      doc.text(line, 50, storeY, { width: 250 });
      storeY += 13;
    }

    doc.font("Helvetica-Bold").fontSize(24).text("INVOICE", 360, 50, { width: 180, align: "right" });
    doc.font("Helvetica").fontSize(10);
    doc.text(`Invoice #: ${invoiceNumber}`, 360, 82, { width: 180, align: "right" });
    doc.text(`Date: ${formatDate(order.createdAt)}`, 360, 98, { width: 180, align: "right" });
    doc.text(`Order #: ${order.orderNumber}`, 360, 114, { width: 180, align: "right" });

    doc.moveTo(50, 145).lineTo(545, 145).strokeColor("#dddddd").stroke();

    doc.font("Helvetica-Bold").fontSize(12).fillColor("#111111").text("Bill To", 50, 165);
    doc.font("Helvetica").fontSize(10);
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
      order.customerName,
      order.customerEmail,
      ...((addressLines.length ? addressLines : fallbackAddress) as string[]),
    ];
    let y = 185;
    for (const line of billLines) {
      doc.text(textValue(line), 50, y, { width: 260 });
      y += 14;
    }

    y = Math.max(y + 20, 280);
    doc.font("Helvetica-Bold").fontSize(11);
    doc.rect(50, y, 495, 24).fill("#f4f4f4");
    doc.fillColor("#111111");
    doc.text("#", 58, y + 7, { width: 22 });
    doc.text("Product (Code / HSN)", 85, y + 7, { width: 145 });
    doc.text("Variant", 235, y + 7, { width: 95 });
    doc.text("Qty", 335, y + 7, { width: 30, align: "right" });
    doc.text("Taxable Val", 370, y + 7, { width: 70, align: "right" });
    doc.text("Line Total", 450, y + 7, { width: 90, align: "right" });
    y += 30;

    order.items.forEach((item, index) => {
      y = maybeNewPage(doc, y);
      const rowTop = y;
      
      const hsnCode = (item.product as any)?.hsnCode || null;
      if (!hsnCode) {
        console.warn(`[Invoice Data Gap] Product "${item.product?.title ?? item.title}" (ID: ${item.productId}) has no assigned HSN code.`);
      }
      const displayHsn = hsnCode ? `HSN: ${hsnCode}` : "HSN: Not Assigned";

      const itemTaxMode = (item as any).taxMode || (order as any).taxMode || "EXCLUSIVE";
      const rawRate = (item as any).taxRate ?? (item as any).taxPercent ?? (order as any).taxRate ?? null;
      const unitPrice = Number(item.unitPrice);

      let unitTaxableValue = unitPrice;
      if (rawRate === null || rawRate === undefined || isNaN(Number(rawRate))) {
        console.warn(`[Invoice Data Gap] Tax rate unavailable for item "${item.product?.title ?? item.title}" (ID: ${item.productId}). Printing unit price as-is without assuming 18%.`);
        unitTaxableValue = Math.round(unitPrice * 100) / 100;
      } else {
        const itemTaxRate = Number(rawRate);
        if (itemTaxMode === "INCLUSIVE" && itemTaxRate > 0) {
          unitTaxableValue = Math.round((unitPrice / (1 + itemTaxRate / 100)) * 100) / 100;
        } else {
          unitTaxableValue = Math.round(unitPrice * 100) / 100;
        }
      }

      doc.text(String(index + 1), 58, y, { width: 22 });
      doc.text(`${item.product?.title ?? item.title}\n(${displayHsn})`, 85, y, { width: 145 });
      doc.text(item.variant?.title ?? item.title ?? "-", 235, y, { width: 95 });
      doc.text(String(item.quantity), 335, y, { width: 30, align: "right" });
      doc.text(money(symbol, unitTaxableValue), 370, y, { width: 70, align: "right" });
      doc.text(money(symbol, item.total), 450, y, { width: 90, align: "right" });
      y = rowTop + 28;
      doc.moveTo(50, y - 8).lineTo(545, y - 8).strokeColor("#eeeeee").stroke();
    });

    y = maybeNewPage(doc, y + 20);
    addRightAmount(doc, "Subtotal (Taxable Value)", money(symbol, order.subtotal), y);
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

    const totalTax = Number(order.taxAmount ?? 0);
    const orderTaxType = (order as any).taxType || (totalTax === 0 ? "EXEMPT" : "IGST");

    if (totalTax === 0 || orderTaxType === "EXEMPT") {
      addRightAmount(doc, "Tax Exempt (0%)", money(symbol, 0), y);
      y += 18;
    } else if (orderTaxType === "VAT") {
      addRightAmount(doc, "VAT @ 18%", `+${money(symbol, totalTax)}`, y);
      y += 18;
    } else if (orderTaxType === "CGST_SGST") {
      const cgst = Math.round((totalTax / 2) * 100) / 100;
      const sgst = Math.round((totalTax - cgst) * 100) / 100;
      addRightAmount(doc, "CGST @ 9%", `+${money(symbol, cgst)}`, y);
      y += 18;
      addRightAmount(doc, "SGST @ 9%", `+${money(symbol, sgst)}`, y);
      y += 18;
    } else {
      addRightAmount(doc, "IGST @ 18%", `+${money(symbol, totalTax)}`, y);
      y += 18;
    }
    if (Number(order.shippingCharge ?? 0) > 0) {
      addRightAmount(doc, `Shipping (${order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "Shipping"})`, `+${money(symbol, order.shippingCharge)}`, y);
      y += 18;
    }
    doc.moveTo(350, y).lineTo(540, y).strokeColor("#cccccc").stroke();
    y += 10;
    addRightAmount(doc, "Total", money(symbol, order.total), y, true);

    const footerY = 760;
    doc.font("Helvetica").fontSize(9).fillColor("#666666");
    doc.text("Thank you for your order.", 50, footerY);
    doc.text(`Order status: ${order.status}`, 50, footerY + 14);

    doc.end();
  });
}
