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

  const storeName = process.env.STORE_NAME || sellerName || siteNameSetting || "Store";
  const storeEmail = process.env.STORE_EMAIL || process.env.EMAIL_FROM || "";
  const storeUrl = process.env.STORE_URL || siteUrlSetting || "";
  let symbol = order.currency?.symbol ?? "";
  if (symbol === "₹") {
    symbol = "Rs. ";
  }
  const invoiceNumber = `INV-${order.orderNumber || order.id.slice(-8)}`;

  const cgst = Number((order as any).cgstAmount ?? 0);
  const sgst = Number((order as any).sgstAmount ?? 0);
  const igst = Number((order as any).igstAmount ?? 0);
  const isGst = cgst > 0 || sgst > 0 || igst > 0;
  const documentTitle = isGst ? "Tax Invoice" : "Bill of Supply";

  let transactionType = "INTER-STATE";
  if (cgst > 0 || sgst > 0) {
    transactionType = "INTRA-STATE";
  } else if (order.country?.code && order.country.code !== "IN") {
    transactionType = "EXPORT / INT'L";
  }

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // 1. Top Accent Brand Banner
    doc.rect(0, 0, 595, 10).fill("#E31E24");

    // 2. Brand / Seller Title & Document Title Y = 32
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0f172a").text("Modern Orthodontics", 50, 32);
    doc.font("Helvetica-Bold").fontSize(13.5).fillColor("#0f172a").text(`${documentTitle}/Cash Memo`, 220, 32, { width: 325, align: "right" });
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569").text("(Original for Recipient)", 220, 47, { width: 325, align: "right" });

    // Thin header divider line (Amazon Style)
    doc.moveTo(50, 60).lineTo(545, 60).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // 3. Billing & Vendor Information columns side-by-side Y = 70
    // Left Column details (Seller)
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#64748b").text("Sold By :", 50, 75);
    doc.font("Helvetica-Bold").fontSize(11).fillColor("#0f172a").text(storeName, 50, 90);
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    let storeY = 105;
    doc.text(sellerAddress, 50, storeY, { width: 235 });
    storeY += doc.heightOfString(sellerAddress, { width: 235 }) + 3;

    if (storeEmail) {
      doc.text(`Email: ${storeEmail}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (storeUrl) {
      doc.text(`Website: ${storeUrl}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (sellerPan) {
      doc.text(`PAN No: ${sellerPan}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (sellerGstin) {
      doc.text(`GST Registration No: ${sellerGstin}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    if (sellerIec && (order as any).isZeroRated) {
      doc.text(`IEC: ${sellerIec}`, 50, storeY, { width: 235 });
      storeY += 13;
    }
    doc.text(`Ship-From State: ${shipFromState}`, 50, storeY, { width: 235 });
    storeY += 13;

    // Right Column details (Billing & Shipping)
    const shippingAddressObj = order.shippingAddress as Record<string, string>;
    const billingAddressObj = ((order as any).billingAddress || order.shippingAddress) as Record<string, string>;
    const buyerState = shippingAddressObj?.state || "—";
    const buyerStateCode = (order as any).taxIdSnapshot ? (order as any).taxIdSnapshot.slice(0, 2) : "08";
    const taxIdLabel = (order as any).taxIdTypeSnapshot || "Tax ID";

    let rightY = 75;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#64748b").text("Billing Address :", 315, rightY);
    rightY += 15;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#0f172a").text(order.customerName, 315, rightY);
    rightY += 13;
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    const billLines = shippingAddressLines(billingAddressObj);
    for (const line of billLines) {
      doc.text(line, 315, rightY, { width: 230 });
      rightY += 13;
    }
    doc.text(`State/UT Code: ${buyerStateCode}`, 315, rightY, { width: 230 });
    rightY += 13;

    rightY += 8;
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#64748b").text("Shipping Address :", 315, rightY);
    rightY += 15;
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#0f172a").text(order.customerName, 315, rightY);
    rightY += 13;
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    const shipLines = shippingAddressLines(shippingAddressObj);
    for (const line of shipLines) {
      doc.text(line, 315, rightY, { width: 230 });
      rightY += 13;
    }
    doc.text(`State/UT Code: ${buyerStateCode}`, 315, rightY, { width: 230 });
    rightY += 13;
    doc.text(`Place of supply: ${buyerState.toUpperCase()}`, 315, rightY, { width: 230 });
    rightY += 13;
    doc.text(`Place of delivery: ${buyerState.toUpperCase()}`, 315, rightY, { width: 230 });
    rightY += 13;

    // Dynamic Y position for order metadata card
    let metaCardY = Math.max(storeY, rightY) + 15;

    // 3. Order Details Card (Horizontal Layout)
    doc.rect(50, metaCardY, 495, 44).fill("#f8fafc");
    doc.rect(50, metaCardY, 495, 44).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // Left block
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Order Number: " + order.orderNumber, 65, metaCardY + 10);
    doc.text("Order Date: " + formatDate(order.createdAt), 65, metaCardY + 24);

    // Right block
    doc.text("Invoice Number: " + invoiceNumber, 315, metaCardY + 10);
    doc.text("Invoice Date: " + formatDate(order.createdAt), 315, metaCardY + 24);

    let tableY = metaCardY + 60;

    // 5. Items Table Header
    doc.rect(50, tableY, 495, 20).fill("#f1f5f9");
    doc.rect(50, tableY, 495, 20).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
    doc.text("Sl. No", 50, tableY + 5, { width: 30, align: "center" });
    doc.text("Description", 82, tableY + 5, { width: 136, align: "left" });
    doc.text("Unit Price", 220, tableY + 5, { width: 55, align: "right" });
    doc.text("Qty", 275, tableY + 5, { width: 25, align: "center" });
    doc.text("Net Amount", 300, tableY + 5, { width: 55, align: "right" });
    doc.text("Tax Rate", 355, tableY + 5, { width: 40, align: "center" });
    doc.text("Tax Type", 395, tableY + 5, { width: 45, align: "center" });
    doc.text("Tax Amount", 440, tableY + 5, { width: 50, align: "right" });
    doc.text("Total Amount", 490, tableY + 5, { width: 55, align: "right" });

    // Draw vertical divider lines for header
    const xPositionsHeader = [50, 80, 220, 275, 300, 355, 395, 440, 490, 545];
    xPositionsHeader.forEach((x) => {
      doc.moveTo(x, tableY).lineTo(x, tableY + 20).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    });

    let currentY = tableY + 20;

    // Items list rows
    order.items.forEach((item, index) => {
      const hsnCode = (item as any).hsnCode || (item.product as any)?.hsnCode || null;
      const displayHsn = hsnCode ? `HSN: ${hsnCode}` : "HSN: Not Assigned";

      const netAmount = Number(item.total) - Number(item.taxAmount);
      const unitTaxableValue = netAmount / item.quantity;
      const taxRateVal = netAmount > 0 ? Math.round((Number(item.taxAmount) / netAmount) * 100) : 0;
      
      let rowTaxType = "IGST";
      if (cgst > 0 || sgst > 0) {
        rowTaxType = "CGST/SGST";
      } else if (order.country?.code && order.country.code !== "IN") {
        rowTaxType = "VAT";
      } else if ((order as any).isZeroRated) {
        rowTaxType = "LUT";
      }

      const descText = `${item.product?.title ?? item.title}\n${item.variant?.title ?? ""}\n(${displayHsn})`;
      const descHeight = doc.heightOfString(descText, { width: 136 });
      const rowHeight = Math.max(descHeight, 24) + 12;

      // Check if page needs break
      const nextY = currentY + rowHeight;
      if (nextY > 720) {
        doc.addPage();
        currentY = 60;
        // Redraw table header on new page
        doc.rect(50, currentY, 495, 20).fill("#f1f5f9");
        doc.rect(50, currentY, 495, 20).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
        doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
        doc.text("Sl. No", 50, currentY + 5, { width: 30, align: "center" });
        doc.text("Description", 82, currentY + 5, { width: 136, align: "left" });
        doc.text("Unit Price", 220, currentY + 5, { width: 55, align: "right" });
        doc.text("Qty", 275, currentY + 5, { width: 25, align: "center" });
        doc.text("Net Amount", 300, currentY + 5, { width: 55, align: "right" });
        doc.text("Tax Rate", 355, currentY + 5, { width: 40, align: "center" });
        doc.text("Tax Type", 395, currentY + 5, { width: 45, align: "center" });
        doc.text("Tax Amount", 440, currentY + 5, { width: 50, align: "right" });
        doc.text("Total Amount", 490, currentY + 5, { width: 55, align: "right" });
        
        xPositionsHeader.forEach((x) => {
          doc.moveTo(x, currentY).lineTo(x, currentY + 20).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
        });
        currentY += 20;
      }

      const rowTop = currentY;

      // Alternate row backgrounds
      if (index % 2 === 1) {
        doc.rect(50, rowTop, 495, rowHeight).fill("#f8fafc");
      }

      // Draw values
      doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);
      doc.text(String(index + 1), 50, rowTop + 6, { width: 30, align: "center" });
      doc.text(descText, 82, rowTop + 6, { width: 136, align: "left" });
      doc.text(money(symbol, unitTaxableValue), 220, rowTop + 6, { width: 55, align: "right" });
      doc.text(String(item.quantity), 275, rowTop + 6, { width: 25, align: "center" });
      doc.text(money(symbol, netAmount), 300, rowTop + 6, { width: 55, align: "right" });
      doc.text(`${taxRateVal}%`, 355, rowTop + 6, { width: 40, align: "center" });
      doc.text(rowTaxType, 395, rowTop + 6, { width: 45, align: "center" });
      doc.text(money(symbol, item.taxAmount), 440, rowTop + 6, { width: 50, align: "right" });
      doc.text(money(symbol, item.total), 490, rowTop + 6, { width: 55, align: "right" });

      currentY += rowHeight;

      // Draw horizontal line at the bottom of the row
      doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

      // Draw vertical lines for this row
      const xPositions = [50, 80, 220, 275, 300, 355, 395, 440, 490, 545];
      xPositions.forEach((x) => {
        doc.moveTo(x, rowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
      });
    });

    // Summary calculations
    const isTaxInclusive = (order as any).taxMode === "INCLUSIVE";
    const totalTax = Number(order.taxAmount ?? 0);
    const taxableSubtotal = isTaxInclusive ? Number(order.subtotal) - totalTax : Number(order.subtotal);

    // TOTAL Row in Table
    const totalRowHeight = 20;
    const nextTotalY = currentY + totalRowHeight;
    if (nextTotalY > 720) {
      doc.addPage();
      currentY = 60;
    }
    const totalRowTop = currentY;
    doc.rect(50, totalRowTop, 495, totalRowHeight).fill("#f8fafc");
    
    doc.fillColor("#0f172a").font("Helvetica-Bold").fontSize(8.5);
    doc.text("TOTAL:", 82, totalRowTop + 5, { width: 136, align: "left" });
    doc.text(money(symbol, taxableSubtotal), 300, totalRowTop + 5, { width: 55, align: "right" });
    doc.text(money(symbol, totalTax), 440, totalRowTop + 5, { width: 50, align: "right" });
    doc.text(money(symbol, order.total), 490, totalRowTop + 5, { width: 55, align: "right" });
    
    currentY += totalRowHeight;
    doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    
    const totalXPositions = [50, 80, 220, 275, 300, 355, 395, 440, 490, 545];
    totalXPositions.forEach((x) => {
      doc.moveTo(x, totalRowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    });

    let y = currentY + 15;

    // Subtotal tax breaks displays if any discount or additional costs
    const couponDiscount = Number(order.couponDiscount ?? 0);
    const genericDiscount = Number(order.discount ?? 0);
    const hasDiscountsOrShipping = genericDiscount > 0 || couponDiscount > 0 || Number(order.shippingCharge ?? 0) > 0;
    
    if (hasDiscountsOrShipping) {
      y = maybeNewPage(doc, y);
      addRightAmount(doc, "Subtotal (Taxable Value)", money(symbol, taxableSubtotal), y);
      y += 18;

      if (genericDiscount > 0 && !order.couponCode) {
        addRightAmount(doc, "Tier/MOQ Discount", `-${money(symbol, genericDiscount)}`, y);
        y += 18;
      }
      if (order.couponCode && couponDiscount > 0) {
        addRightAmount(doc, `Coupon (${order.couponCode})`, `-${money(symbol, couponDiscount)}`, y);
        y += 18;
      }
      if (Number(order.shippingCharge ?? 0) > 0) {
        addRightAmount(doc, `Shipping (${order.shippingProvider ?? order.shippingZone?.provider?.displayName ?? "Shipping"})`, `+${money(symbol, order.shippingCharge)}`, y);
        y += 18;
      }
      doc.moveTo(350, y).lineTo(545, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      y += 10;
      doc.rect(280, y - 4, 265, 24).fill("#f1f5f9");
      addRightAmount(doc, "Total", money(symbol, order.total), y + 3, true);
      y += 26;
    }

    // 6. Words and Authorized Signatory Block
    y = maybeNewPage(doc, y + 10);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#0f172a").text("Amount in Words:", 50, y);
    y += 13;
    doc.font("Helvetica").fontSize(9.5).fillColor("#475569").text(numberToWords(Number(order.total)), 50, y, { width: 235 });
    
    let signatoryY = y - 13;
    doc.rect(300, signatoryY, 245, 60).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text(`For ${storeName}:`, 305, signatoryY + 6);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#475569").text("Authorized Signatory", 305, signatoryY + 45, { width: 235, align: "right" });

    y = Math.max(y + 20, signatoryY + 70);
    
    if ((order as any).taxIdSnapshot) {
      y = maybeNewPage(doc, y);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#475569");
      doc.text(`Buyer ${taxIdLabel}: ${(order as any).taxIdSnapshot}`, 50, y, { width: 495 });
      y += 14;
    }
    if ((order as any).isZeroRated) {
      y = maybeNewPage(doc, y);
      doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#475569");
      doc.text("Declaration: Supply meant for export under bond or letter of undertaking (LUT) without payment of integrated tax.", 50, y, { width: 495 });
      y += 14;
    }

    y = maybeNewPage(doc, y);
    doc.font("Helvetica").fontSize(9).fillColor("#475569");
    doc.text("Whether tax is payable under reverse charge - No", 50, y);
    y += 18;

    // 7. Payment Transaction Info Box (Amazon Style)
    y = maybeNewPage(doc, y);
    const boxHeight = 34;
    doc.rect(50, y, 495, boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    
    // Draw vertical column split lines inside the payment box
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

    y += boxHeight + 10;

    // Footer decoration
    const footerY = 750;
    doc.moveTo(50, footerY - 10).lineTo(545, footerY - 10).strokeColor("#e2e8f0").lineWidth(1).stroke();

    doc.font("Helvetica").fontSize(8.5).fillColor("#64748b");
    doc.text("Thank you for your order! For support, please contact orders@modortho.com.", 50, footerY);
    doc.text(`Order Status: ${order.status.toUpperCase()} | Computer-Generated Document`, 50, footerY + 13);

    doc.end();
  });
}
