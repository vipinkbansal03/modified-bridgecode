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
    record.addressLine1 as string,
    record.addressLine2 as string,
    [record.city, record.state, record.postalCode].filter(Boolean).join(", "),
    record.countryCode as string,
    record.phone ? `Phone: ${record.phone}` : null,
  ].filter((line): line is string => Boolean(line));
}

function formatPaymentMethod(value?: string | null) {
  if (!value) return "—";
  if (value === "PAY_ON_DELIVERY") return "Pay on Delivery (COD)";
  if (value === "RAZORPAY") return "Razorpay";
  return value;
}

function numberToWords(num: number): string {
  const a = [
    "", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
    "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"
  ];
  const b = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];

  function g(n: number): string {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? " " + a[digit] : "");
  }

  function h(n: number): string {
    if (n < 100) return g(n);
    const rest = n % 100;
    return a[Math.floor(n / 100)] + " hundred" + (rest ? " and " + h(rest) : "");
  }

  function convert(n: number): string {
    if (n === 0) return "zero";
    let str = "";
    if (n >= 10000000) { // Crores
      const crores = Math.floor(n / 10000000);
      str += convert(crores) + " crore ";
      n %= 10000000;
    }
    if (n >= 100000) { // Lakhs
      const lakhs = Math.floor(n / 100000);
      str += h(lakhs) + " lakh ";
      n %= 100000;
    }
    if (n >= 1000) { // Thousands
      const thousands = Math.floor(n / 1000);
      str += h(thousands) + " thousand ";
      n %= 1000;
    }
    if (n > 0) {
      str += h(n);
    }
    return str.trim();
  }

  const integerPart = Math.floor(num);
  const decimalPart = Math.round((num - integerPart) * 100);

  let words = convert(integerPart);
  if (decimalPart > 0) {
    words += " and " + convert(decimalPart) + " paise";
  }

  if (words) {
    return words.charAt(0).toUpperCase() + words.slice(1) + " only";
  }
  return "Zero only";
}

function addRightAmount(doc: PdfDoc, label: string, amount: string, y: number, bold = false) {
  doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10.5 : 9.5);
  doc.fillColor(bold ? "#0f172a" : "#475569");
  doc.text(label, 250, y, { width: 190, align: "right" });
  doc.text(amount, 445, y, { width: 100, align: "right" });
}

function maybeNewPage(doc: PdfDoc, y: number, requiredSpace = 60) {
  if (y + requiredSpace < 730) return y;
  doc.addPage();
  doc.rect(0, 0, 595, 10).fill("#E31E24");
  return 50;
}

export interface GeneratedInvoiceResult {
  buffer: Buffer;
  filename: string;
  invoiceNumber: string;
}

export async function generateInvoice(orderId: string): Promise<GeneratedInvoiceResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { include: { addresses: { include: { country: true }, orderBy: { isDefault: "desc" }, take: 1 } } },
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      shippingZone: { include: { provider: true, countries: { include: { country: true } } } },
      warehouse: true,
    },
  });
  if (!order) throw new AppError("Order not found.", 404);

  const [siteNameSetting, siteUrlSetting, sellerName, sellerIec, sellerGstinSetting, companyAddressSetting] = await Promise.all([
    getSettingValue("general.site_name").catch(() => ""),
    getSettingValue("general.site_url").catch(() => ""),
    getSettingValue("tax.seller_name").catch(() => "Modern Orthodontics Pvt Ltd"),
    getSettingValue("tax.seller_iec").catch(() => ""),
    getSettingValue("tax.seller_gstin").catch(() => ""),
    getSettingValue("general.address").catch(() => "Ludhiana, Punjab, India"),
  ]);

  const shipFromState = order.warehouse?.state || "Punjab";
  const sellerGstin = order.warehouse?.gstin || sellerGstinSetting || "";
  const sellerAddress = order.warehouse?.address || companyAddressSetting || "Ludhiana, Punjab, India";
  const sellerPan = sellerGstin && sellerGstin.length >= 12 ? sellerGstin.slice(2, 12) : null;

  const storeName = process.env.STORE_NAME || sellerName || siteNameSetting || "Modern Orthodontics";
  const storeEmail = process.env.STORE_EMAIL || process.env.EMAIL_FROM || "orders@modortho.com";
  const storeUrl = process.env.STORE_URL || siteUrlSetting || "www.modortho.com";

  let symbol = order.currency?.symbol ?? "";
  if (symbol === "₹") {
    symbol = "Rs. ";
  }

  const invoiceNumber = `INV-${order.orderNumber || order.id.slice(-8)}`;
  const filename = `Invoice-${invoiceNumber}.pdf`;

  const cgst = Number((order as any).cgstAmount ?? 0);
  const sgst = Number((order as any).sgstAmount ?? 0);
  const igst = Number((order as any).igstAmount ?? 0);
  const isGst = cgst > 0 || sgst > 0 || igst > 0;
  const documentTitle = isGst ? "TAX INVOICE" : "BILL OF SUPPLY / CASH MEMO";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), filename, invoiceNumber }));
    doc.on("error", reject);

    // 1. Top Accent Brand Banner
    doc.rect(0, 0, 595, 10).fill("#E31E24");

    // 2. Official Brand Logo Header (Vector Rendering)
    doc.save();
    doc.circle(66, 36, 14).lineWidth(1.75).strokeColor("#E31E24").stroke();
    doc.path("M 59 41 L 59 30 L 66 37 L 73 30 L 73 41")
       .lineWidth(1.75)
       .strokeColor("#E31E24")
       .lineCap("round")
       .lineJoin("round")
       .stroke();
    doc.restore();

    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text("Modern", 88, 25);
    doc.font("Helvetica").fontSize(10.5).fillColor("#64748b").text("Orthodontics", 88, 41);

    // Document Title & Copy Notice (Right Aligned)
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#0f172a").text(documentTitle, 220, 26, { width: 325, align: "right" });
    doc.font("Helvetica").fontSize(8.5).fillColor("#64748b").text("(Original for Recipient)", 220, 43, { width: 325, align: "right" });

    // Header Divider Line
    doc.moveTo(50, 64).lineTo(545, 64).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // 3. Billing & Vendor Information Columns Y = 74
    // Left Column details (Seller)
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("SOLD BY:", 50, 76);
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#0f172a").text(storeName, 50, 89);
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
    let storeY = 103;
    doc.text(sellerAddress, 50, storeY, { width: 235 });
    storeY += doc.heightOfString(sellerAddress, { width: 235 }) + 3;

    if (storeEmail) {
      doc.text(`Email: ${storeEmail}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    if (storeUrl) {
      doc.text(`Website: ${storeUrl}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    if (sellerPan) {
      doc.text(`PAN: ${sellerPan}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    if (sellerGstin) {
      doc.text(`GSTIN: ${sellerGstin}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    if (sellerIec && (order as any).isZeroRated) {
      doc.text(`IEC: ${sellerIec}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    doc.text(`Ship-From State: ${shipFromState}`, 50, storeY, { width: 235 });
    storeY += 12;

    // Right Column details (Billing & Shipping)
    const shippingAddressObj = order.shippingAddress as Record<string, string>;
    const billingAddressObj = ((order as any).billingAddress || order.shippingAddress) as Record<string, string>;
    const buyerState = shippingAddressObj?.state || "—";
    const buyerStateCode = (order as any).taxIdSnapshot ? (order as any).taxIdSnapshot.slice(0, 2) : "08";
    const taxIdLabel = (order as any).taxIdTypeSnapshot || "Tax ID";

    let rightY = 76;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("BILLING ADDRESS:", 315, rightY);
    rightY += 13;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(order.customerName, 315, rightY);
    rightY += 12;
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
    const billLines = shippingAddressLines(billingAddressObj);
    for (const line of billLines) {
      doc.text(line, 315, rightY, { width: 230 });
      rightY += 12;
    }
    doc.text(`State/UT Code: ${buyerStateCode}`, 315, rightY, { width: 230 });
    rightY += 12;

    rightY += 6;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("SHIPPING ADDRESS:", 315, rightY);
    rightY += 13;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(order.customerName, 315, rightY);
    rightY += 12;
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
    const shipLines = shippingAddressLines(shippingAddressObj);
    for (const line of shipLines) {
      doc.text(line, 315, rightY, { width: 230 });
      rightY += 12;
    }
    doc.text(`State/UT Code: ${buyerStateCode}`, 315, rightY, { width: 230 });
    rightY += 12;
    doc.text(`Place of Supply: ${buyerState.toUpperCase()}`, 315, rightY, { width: 230 });
    rightY += 12;

    // Dynamic Y position for order metadata card
    let metaCardY = Math.max(storeY, rightY) + 12;

    // 4. Order Details Card (Horizontal Summary Bar)
    doc.rect(50, metaCardY, 495, 42).fill("#f8fafc");
    doc.rect(50, metaCardY, 495, 42).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // Left block
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Order Number: " + order.orderNumber, 62, metaCardY + 9);
    doc.text("Order Date: " + formatDate(order.createdAt), 62, metaCardY + 23);

    // Right block
    doc.text("Invoice Number: " + invoiceNumber, 315, metaCardY + 9);
    doc.text("Invoice Date: " + formatDate(order.createdAt), 315, metaCardY + 23);

    let tableY = metaCardY + 54;

    // 5. Items Table Column Layout & Headers (Spacious, Well-Padded Grid)
    // Total Width = 495 (X = 50 to 545)
    // Columns: [Sl.No (28), Description (172), Unit Price (55), Qty (30), Net Amount (55), Tax Rate/Type (45), Tax Amount (55), Total Amount (55)]
    const colX = [50, 78, 250, 305, 335, 390, 435, 490, 545];

    function drawTableHeader(yPos: number) {
      doc.rect(50, yPos, 495, 22).fill("#f1f5f9");
      doc.rect(50, yPos, 495, 22).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

      doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8);
      doc.text("Sl.", 50, yPos + 6.5, { width: 28, align: "center" });
      doc.text("Description", 84, yPos + 6.5, { width: 160, align: "left" });
      doc.text("Unit Price", 250, yPos + 6.5, { width: 55, align: "center" });
      doc.text("Qty", 305, yPos + 6.5, { width: 30, align: "center" });
      doc.text("Net Amount", 335, yPos + 6.5, { width: 55, align: "center" });
      doc.text("Tax", 390, yPos + 6.5, { width: 45, align: "center" });
      doc.text("Tax Amount", 435, yPos + 6.5, { width: 55, align: "center" });
      doc.text("Total Amount", 490, yPos + 6.5, { width: 55, align: "center" });

      colX.forEach((x) => {
        doc.moveTo(x, yPos).lineTo(x, yPos + 22).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
      });
    }

    drawTableHeader(tableY);
    let currentY = tableY + 22;

    // Items list rows
    order.items.forEach((item, index) => {
      const hsnCode = (item as any).hsnCode || (item.product as any)?.hsnCode || null;
      const displayHsn = hsnCode ? `HSN: ${hsnCode}` : null;

      const netAmount = Number(item.total) - Number(item.taxAmount);
      const unitTaxableValue = item.quantity > 0 ? netAmount / item.quantity : Number((item as any).price || 0);
      const taxRateVal = netAmount > 0 ? Math.round((Number(item.taxAmount) / netAmount) * 100) : 0;

      let rowTaxType = "IGST";
      if (cgst > 0 || sgst > 0) {
        rowTaxType = "CGST/SGST";
      } else if (order.country?.code && order.country.code !== "IN") {
        rowTaxType = "VAT";
      } else if ((order as any).isZeroRated) {
        rowTaxType = "LUT";
      }

      const prodTitle = item.product?.title ?? item.title;
      const varTitle = item.variant?.title ? ` - ${item.variant.title}` : "";
      const hsnText = displayHsn ? `\n(${displayHsn})` : "";
      const descText = `${prodTitle}${varTitle}${hsnText}`;

      // Width 160 gives 6px left padding (starts at 84) and 6px right padding (ends at 244 < 250)
      const descHeight = doc.heightOfString(descText, { width: 160 });
      const rowPaddingY = 7;
      const rowHeight = Math.max(descHeight + rowPaddingY * 2, 28);

      // Check if page needs break before drawing row
      if (currentY + rowHeight > 730) {
        doc.addPage();
        doc.rect(0, 0, 595, 10).fill("#E31E24");
        currentY = 50;
        drawTableHeader(currentY);
        currentY += 22;
      }

      const rowTop = currentY;

      // Alternate row background fill
      if (index % 2 === 1) {
        doc.rect(50, rowTop, 495, rowHeight).fill("#f8fafc");
      }

      // Vertical centering Y calculations per cell type
      const descY = rowTop + (rowHeight - descHeight) / 2;
      const singleLineY = rowTop + (rowHeight - 10) / 2;
      const doubleLineY = rowTop + (rowHeight - 20) / 2;

      doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);

      // Sl. No (Vertically & Horizontally Centered)
      doc.text(String(index + 1), 50, singleLineY, { width: 28, align: "center" });

      // Description (Left-aligned, Vertically Centered with 6px padding)
      doc.text(descText, 84, descY, { width: 160, align: "left" });

      // Unit Price (Vertically & Horizontally Centered)
      doc.text(money(symbol, unitTaxableValue), 250, singleLineY, { width: 55, align: "center" });

      // Qty (Vertically & Horizontally Centered)
      doc.text(String(item.quantity), 305, singleLineY, { width: 30, align: "center" });

      // Net Amount (Vertically & Horizontally Centered)
      doc.text(money(symbol, netAmount), 335, singleLineY, { width: 55, align: "center" });

      // Tax Rate & Type (Vertically & Horizontally Centered)
      doc.text(`${taxRateVal}%\n${rowTaxType}`, 390, doubleLineY, { width: 45, align: "center" });

      // Tax Amount (Vertically & Horizontally Centered)
      doc.text(money(symbol, item.taxAmount), 435, singleLineY, { width: 55, align: "center" });

      // Total Amount (Vertically & Horizontally Centered)
      doc.text(money(symbol, item.total), 490, singleLineY, { width: 55, align: "center" });

      currentY += rowHeight;

      // Bottom horizontal line for row
      doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

      // Vertical grid lines for row
      colX.forEach((x) => {
        doc.moveTo(x, rowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
      });
    });

    // Summary Calculations
    const isTaxInclusive = (order as any).taxMode === "INCLUSIVE";
    const totalTax = Number(order.taxAmount ?? 0);
    const taxableSubtotal = isTaxInclusive ? Number(order.subtotal) - totalTax : Number(order.subtotal);

    // TOTAL Summary Row inside Table (Vertically & Horizontally Centered)
    const totalRowHeight = 22;
    if (currentY + totalRowHeight > 730) {
      doc.addPage();
      doc.rect(0, 0, 595, 10).fill("#E31E24");
      currentY = 50;
    }
    const totalRowTop = currentY;
    doc.rect(50, totalRowTop, 495, totalRowHeight).fill("#f8fafc");

    const totalY = totalRowTop + (totalRowHeight - 10) / 2;
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
    doc.text("TOTAL:", 84, totalY, { width: 160, align: "left" });
    doc.text(money(symbol, taxableSubtotal), 335, totalY, { width: 55, align: "center" });
    doc.text(money(symbol, totalTax), 435, totalY, { width: 55, align: "center" });
    doc.text(money(symbol, order.total), 490, totalY, { width: 55, align: "center" });

    currentY += totalRowHeight;
    doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    colX.forEach((x) => {
      doc.moveTo(x, totalRowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    });

    let y = currentY + 14;

    // Subtotal Breakdown Section
    const couponDiscount = Number(order.couponDiscount ?? 0);
    const genericDiscount = Number(order.discount ?? 0);
    const hasDiscountsOrShipping = genericDiscount > 0 || couponDiscount > 0 || Number(order.shippingCharge ?? 0) > 0;

    if (hasDiscountsOrShipping) {
      y = maybeNewPage(doc, y, 90);
      addRightAmount(doc, "Subtotal (Taxable Value)", money(symbol, taxableSubtotal), y);
      y += 16;

      if (genericDiscount > 0 && !order.couponCode) {
        addRightAmount(doc, "Tier/MOQ Discount", `-${money(symbol, genericDiscount)}`, y);
        y += 16;
      }
      if (order.couponCode && couponDiscount > 0) {
        addRightAmount(doc, `Coupon (${order.couponCode})`, `-${money(symbol, couponDiscount)}`, y);
        y += 16;
      }
      if (Number(order.shippingCharge ?? 0) > 0) {
        addRightAmount(doc, `Shipping (${order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "Standard"})`, `+${money(symbol, order.shippingCharge)}`, y);
        y += 16;
      }
      doc.moveTo(335, y).lineTo(545, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      y += 8;
      doc.rect(280, y - 4, 265, 24).fill("#f1f5f9");
      addRightAmount(doc, "Total Amount", money(symbol, order.total), y + 3, true);
      y += 28;
    }

    // 6. Amount in Words & Authorized Signatory Block
    y = maybeNewPage(doc, y, 75);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text("Amount in Words:", 50, y);
    y += 13;
    doc.font("Helvetica").fontSize(9).fillColor("#475569").text(numberToWords(Number(order.total)), 50, y, { width: 235 });

    let signatoryY = y - 13;
    doc.rect(300, signatoryY, 245, 60).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text(`For ${storeName}:`, 306, signatoryY + 6);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#475569").text("Authorized Signatory", 306, signatoryY + 44, { width: 233, align: "right" });

    y = Math.max(y + 20, signatoryY + 68);

    if ((order as any).taxIdSnapshot) {
      y = maybeNewPage(doc, y, 16);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#475569");
      doc.text(`Buyer ${taxIdLabel}: ${(order as any).taxIdSnapshot}`, 50, y, { width: 495 });
      y += 14;
    }
    if ((order as any).isZeroRated) {
      y = maybeNewPage(doc, y, 16);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#475569");
      doc.text("Declaration: Supply meant for export under bond or letter of undertaking (LUT) without payment of integrated tax.", 50, y, { width: 495 });
      y += 14;
    }

    y = maybeNewPage(doc, y, 18);
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
    doc.text("Whether tax is payable under reverse charge - No", 50, y);
    y += 16;

    // 7. Payment Transaction Info Card
    y = maybeNewPage(doc, y, 42);
    const boxHeight = 34;
    doc.rect(50, y, 495, boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // Vertical column dividers
    doc.moveTo(200, y).lineTo(200, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.moveTo(320, y).lineTo(320, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.moveTo(420, y).lineTo(420, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // Col 1
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Payment Transaction ID:", 55, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(order.paymentId || "—", 55, y + 18, { width: 140 });

    // Col 2
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Date & Time:", 205, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(formatDate(order.createdAt), 205, y + 18, { width: 110 });

    // Col 3
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Invoice Value:", 325, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(money(symbol, order.total), 325, y + 18, { width: 90 });

    // Col 4
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Mode of Payment:", 425, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(formatPaymentMethod(order.paymentMethod), 425, y + 18, { width: 110 });

    y += boxHeight + 12;

    // Footer decoration
    const footerY = 750;
    doc.moveTo(50, footerY - 8).lineTo(545, footerY - 8).strokeColor("#e2e8f0").lineWidth(1).stroke();

    doc.font("Helvetica").fontSize(8.5).fillColor("#64748b");
    doc.text("Thank you for your order! For support, please contact orders@modortho.com.", 50, footerY);
    doc.text(`Order Status: ${order.status.toUpperCase()} | Computer-Generated Document`, 50, footerY + 12);

    doc.end();
  });
}
