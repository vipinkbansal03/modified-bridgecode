import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { Prisma } from "@prisma/client";
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

function formatDate(date: Date | string, timeZone = "Asia/Kolkata") {
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

function formatDateTime(date: Date | string, timeZone = "Asia/Kolkata") {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(date));
  } catch {
    return formatDate(date, timeZone);
  }
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
  contentType?: string;
}

export interface InvoiceCustomData {
  documentTitle?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceDueDate?: string;
  seller?: {
    name?: string;
    address?: string;
    email?: string;
    website?: string;
    pan?: string;
    gstin?: string;
    iec?: string;
    shipFromState?: string;
  };
  buyer?: {
    name?: string;
    companyName?: string;
    addressLines?: string[];
    taxId?: string;
    taxIdType?: string;
    stateCode?: string;
    placeOfSupply?: string;
    email?: string;
    phone?: string;
  };
  items?: Array<{
    id?: string;
    sl?: number;
    title: string;
    variantTitle?: string;
    sku?: string;
    hsnCode?: string;
    unitPrice: number;
    quantity: number;
    netAmount?: number;
    taxType?: string;
    taxRate?: number;
    taxAmount: number;
    total: number;
  }>;
  summary?: {
    subtotal?: number;
    discount?: number;
    shippingCharge?: number;
    cgstAmount?: number;
    sgstAmount?: number;
    igstAmount?: number;
    vatAmount?: number;
    taxAmount?: number;
    total?: number;
  };
  notes?: string;
  terms?: string;
  bankDetails?: string;
  authorizedSignatory?: string;
}

// ─── Get Default or Saved Invoice Data ──────────────────────────────────────

export async function getInvoiceData(orderId: string): Promise<{
  orderId: string;
  orderNumber: string;
  isInvoiceGenerated: boolean;
  invoiceType: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceDueDate: string | null;
  invoiceUrl: string | null;
  invoiceOriginalName: string | null;
  customData: InvoiceCustomData;
  defaultData?: InvoiceCustomData;
}> {
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

  const defaultInvoiceNumber = order.invoiceNumber || `INV-${order.orderNumber || order.id.slice(-8)}`;
  const defaultInvoiceDate = (order.invoiceDate || order.createdAt).toISOString().slice(0, 10);
  const defaultDueDate = order.invoiceDueDate ? order.invoiceDueDate.toISOString().slice(0, 10) : null;

  const savedData = (order.invoiceData as InvoiceCustomData) || {};

  const cgst = Number((order as any).cgstAmount ?? 0);
  const sgst = Number((order as any).sgstAmount ?? 0);
  const igst = Number((order as any).igstAmount ?? 0);
  const isGst = cgst > 0 || sgst > 0 || igst > 0;
  const defaultDocumentTitle = isGst ? "TAX INVOICE" : "BILL OF SUPPLY / CASH MEMO";

  const sellerGstin = order.warehouse?.gstin || sellerGstinSetting || "";
  const sellerAddress = order.warehouse?.address || companyAddressSetting || "Ludhiana, Punjab, India";
  const sellerPan = sellerGstin && sellerGstin.length >= 12 ? sellerGstin.slice(2, 12) : "";

  const defaultSeller = {
    name: process.env.STORE_NAME || sellerName || siteNameSetting || "Modern Orthodontics",
    address: sellerAddress,
    email: process.env.STORE_EMAIL || process.env.EMAIL_FROM || "orders@modortho.com",
    website: process.env.STORE_URL || siteUrlSetting || "www.modortho.com",
    pan: sellerPan,
    gstin: sellerGstin,
    iec: sellerIec || "",
    shipFromState: order.warehouse?.state || "Punjab",
  };

  const shippingAddressObj = order.shippingAddress as Record<string, string>;
  const buyerState = shippingAddressObj?.state || "—";
  const buyerStateCode = (order as any).taxIdSnapshot ? (order as any).taxIdSnapshot.slice(0, 2) : "08";

  const defaultBuyer = {
    name: order.customerName,
    companyName: order.companyName || "",
    addressLines: shippingAddressLines(shippingAddressObj),
    taxId: (order as any).taxIdSnapshot || "",
    taxIdType: (order as any).taxIdTypeSnapshot || "Tax ID",
    stateCode: buyerStateCode,
    placeOfSupply: buyerState.toUpperCase(),
    email: order.customerEmail,
    phone: order.customerPhone || "",
  };

  const defaultItems = order.items.map((item, index) => {
    const hsnCode = (item as any).hsnCode || (item.product as any)?.hsnCode || "";
    const netAmount = Number(item.total) - Number(item.taxAmount);
    const unitPrice = item.quantity > 0 ? netAmount / item.quantity : Number(item.unitPrice);
    const taxRate = netAmount > 0 ? Math.round((Number(item.taxAmount) / netAmount) * 100) : 0;

    let rowTaxType = "IGST";
    if (cgst > 0 || sgst > 0) {
      rowTaxType = "CGST/SGST";
    } else if (order.country?.code && order.country.code !== "IN") {
      rowTaxType = "VAT";
    } else if ((order as any).isZeroRated) {
      rowTaxType = "LUT";
    }

    return {
      id: item.id,
      sl: index + 1,
      title: item.product?.title ?? item.title,
      variantTitle: item.variant?.title ?? "",
      sku: item.variant?.sku ?? item.sku ?? "",
      hsnCode,
      unitPrice,
      quantity: item.quantity,
      netAmount,
      taxType: rowTaxType,
      taxRate,
      taxAmount: Number(item.taxAmount),
      total: Number(item.total),
    };
  });

  const isTaxInclusive = (order as any).taxMode === "INCLUSIVE";
  const totalTax = Number(order.taxAmount ?? 0);
  const taxableSubtotal = isTaxInclusive ? Number(order.subtotal) - totalTax : Number(order.subtotal);

  const defaultSummary = {
    subtotal: taxableSubtotal,
    discount: Number(order.discount ?? 0),
    shippingCharge: Number(order.shippingCharge ?? 0),
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    vatAmount: Number((order as any).vatAmount ?? 0),
    taxAmount: totalTax,
    total: Number(order.total),
  };

  const mergedCustomData: InvoiceCustomData = {
    documentTitle: savedData.documentTitle || defaultDocumentTitle,
    invoiceNumber: savedData.invoiceNumber || defaultInvoiceNumber,
    invoiceDate: savedData.invoiceDate || defaultInvoiceDate,
    invoiceDueDate: savedData.invoiceDueDate || defaultDueDate || undefined,
    seller: { ...defaultSeller, ...(savedData.seller || {}) },
    buyer: { ...defaultBuyer, ...(savedData.buyer || {}) },
    items: savedData.items && savedData.items.length > 0 ? savedData.items : defaultItems,
    summary: { ...defaultSummary, ...(savedData.summary || {}) },
    notes: savedData.notes !== undefined ? savedData.notes : (order.notes || ""),
    terms: savedData.terms || "Standard commercial terms apply. Goods once sold will not be taken back unless subject to approved RMA warranty claim.",
    bankDetails: savedData.bankDetails || "",
    authorizedSignatory: savedData.authorizedSignatory || `For ${defaultSeller.name}`,
  };

  const pristineDefaultData: InvoiceCustomData = {
    documentTitle: defaultDocumentTitle,
    invoiceNumber: defaultInvoiceNumber,
    invoiceDate: defaultInvoiceDate,
    invoiceDueDate: defaultDueDate || undefined,
    seller: defaultSeller,
    buyer: defaultBuyer,
    items: defaultItems,
    summary: defaultSummary,
    notes: order.notes || "",
    terms: "Standard commercial terms apply. Goods once sold will not be taken back unless subject to approved RMA warranty claim.",
    bankDetails: "",
    authorizedSignatory: `For ${defaultSeller.name}`,
  };

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    isInvoiceGenerated: order.isInvoiceGenerated,
    invoiceType: order.invoiceType || (order.isInvoiceGenerated ? "AUTO" : "NONE"),
    invoiceNumber: defaultInvoiceNumber,
    invoiceDate: defaultInvoiceDate,
    invoiceDueDate: defaultDueDate,
    invoiceUrl: order.invoiceUrl || null,
    invoiceOriginalName: order.invoiceOriginalName || null,
    customData: mergedCustomData,
    defaultData: pristineDefaultData,
  };
}

// ─── Save Custom Invoice Data ───────────────────────────────────────────────

export async function saveInvoiceData(orderId: string, customData: InvoiceCustomData) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError("Order not found.", 404);

  const invoiceNumber = customData.invoiceNumber?.trim() || existing.invoiceNumber || `INV-${existing.orderNumber}`;
  const invoiceDate = customData.invoiceDate ? new Date(customData.invoiceDate) : (existing.invoiceDate || new Date());
  const invoiceDueDate = customData.invoiceDueDate ? new Date(customData.invoiceDueDate) : null;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      isInvoiceGenerated: true,
      invoiceType: "CUSTOM_EDITED",
      invoiceNumber,
      invoiceDate,
      invoiceDueDate,
      invoiceData: customData as any,
    },
  });

  return getInvoiceData(orderId);
}

// ─── Upload Custom Invoice File ─────────────────────────────────────────────

export async function uploadCustomInvoice(
  orderId: string,
  file?: Express.Multer.File,
  metadata?: { invoiceNumber?: string; invoiceDate?: string; invoiceDueDate?: string; notes?: string; fileUrl?: string; fileName?: string }
) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError("Order not found.", 404);

  let invoiceUrl = metadata?.fileUrl || "";
  let invoiceOriginalName = metadata?.fileName || "";

  if (file) {
    const invoicesDir = path.join(process.cwd(), "uploads", "invoices");
    if (!fs.existsSync(invoicesDir)) fs.mkdirSync(invoicesDir, { recursive: true });

    const ext = path.extname(file.originalname) || ".pdf";
    const filename = `invoice-${existing.orderNumber}-${Date.now()}${ext}`;
    const targetPath = path.join(invoicesDir, filename);

    fs.copyFileSync(file.path, targetPath);
    try {
      fs.unlinkSync(file.path);
    } catch {}

    invoiceUrl = `/uploads/invoices/${filename}`;
    invoiceOriginalName = file.originalname;
  }

  if (!invoiceUrl) {
    throw new AppError("Please provide an invoice file or select one from the media library.", 400);
  }

  const invoiceNumber = metadata?.invoiceNumber?.trim() || existing.invoiceNumber || `INV-${existing.orderNumber}`;
  const invoiceDate = metadata?.invoiceDate ? new Date(metadata.invoiceDate) : (existing.invoiceDate || new Date());
  const invoiceDueDate = metadata?.invoiceDueDate ? new Date(metadata.invoiceDueDate) : existing.invoiceDueDate;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      isInvoiceGenerated: true,
      invoiceType: "MANUAL_UPLOAD",
      invoiceUrl,
      invoiceOriginalName: invoiceOriginalName || path.basename(invoiceUrl),
      invoiceNumber,
      invoiceDate,
      invoiceDueDate,
      ...(metadata?.notes ? { notes: metadata.notes } : {}),
    },
  });

  return getInvoiceData(orderId);
}

// ─── Generate System Invoice ────────────────────────────────────────────────

export async function generateSystemInvoice(orderId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError("Order not found.", 404);

  const invoiceNumber = existing.invoiceNumber || `INV-${existing.orderNumber}`;
  const invoiceDate = existing.invoiceDate || new Date();

  await prisma.order.update({
    where: { id: orderId },
    data: {
      isInvoiceGenerated: true,
      invoiceType: "AUTO",
      invoiceNumber,
      invoiceDate,
    },
  });

  return getInvoiceData(orderId);
}

// ─── Delete / Disable Invoice ───────────────────────────────────────────────

export async function deleteInvoice(orderId: string) {
  const existing = await prisma.order.findUnique({ where: { id: orderId } });
  if (!existing) throw new AppError("Order not found.", 404);

  // If local file exists, remove it
  if (existing.invoiceUrl && existing.invoiceUrl.startsWith("/uploads/invoices/")) {
    const filePath = path.join(process.cwd(), existing.invoiceUrl);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      isInvoiceGenerated: false,
      invoiceType: "NONE",
      invoiceUrl: null,
      invoiceOriginalName: null,
      invoiceData: Prisma.DbNull,
    },
  });

  return getInvoiceData(orderId);
}

// ─── Generate PDF or Serve Uploaded Invoice ─────────────────────────────────

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

  // Check if invoice is disabled and no manual upload exists
  if (!order.isInvoiceGenerated && !order.invoiceUrl) {
    throw new AppError("Invoice has not been generated for this order yet.", 404);
  }

  // If manual uploaded file exists, serve it
  if (order.invoiceUrl) {
    let filePath = "";
    if (order.invoiceUrl.startsWith("/uploads/") || order.invoiceUrl.startsWith("uploads/")) {
      filePath = path.join(process.cwd(), order.invoiceUrl.startsWith("/") ? order.invoiceUrl.slice(1) : order.invoiceUrl);
    } else {
      filePath = path.join(process.cwd(), "uploads", "invoices", path.basename(order.invoiceUrl));
    }

    if (fs.existsSync(filePath)) {
      const buffer = fs.readFileSync(filePath);
      const invoiceNumber = order.invoiceNumber || `INV-${order.orderNumber}`;
      const filename = order.invoiceOriginalName || `Invoice-${invoiceNumber}${path.extname(filePath)}`;
      const ext = path.extname(filePath).toLowerCase();
      const contentType = ext === ".pdf" ? "application/pdf" : ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
      return { buffer, filename, invoiceNumber, contentType };
    }
  }

  // Otherwise, render PDF dynamically with any customized data
  const invoiceDataObj = await getInvoiceData(orderId);
  const custom = invoiceDataObj.customData;

  const [timezoneSetting] = await Promise.all([
    getSettingValue("general.timezone").catch(() => "Asia/Kolkata"),
  ]);
  const timezone = timezoneSetting || "Asia/Kolkata";

  let symbol = order.currency?.symbol ?? "";
  if (symbol === "₹") {
    symbol = "Rs. ";
  }

  const invoiceNumber = custom.invoiceNumber || order.invoiceNumber || `INV-${order.orderNumber || order.id.slice(-8)}`;
  const filename = `Invoice-${invoiceNumber}.pdf`;
  const documentTitle = custom.documentTitle || "TAX INVOICE";

  const storeName = custom.seller?.name || process.env.STORE_NAME || "Modern Orthodontics";
  const storeEmail = custom.seller?.email || process.env.STORE_EMAIL || "orders@modortho.com";
  const storeUrl = custom.seller?.website || process.env.STORE_URL || "www.modortho.com";
  const sellerAddress = custom.seller?.address || "Ludhiana, Punjab, India";
  const sellerPan = custom.seller?.pan || "";
  const sellerGstin = custom.seller?.gstin || "";
  const sellerIec = custom.seller?.iec || "";
  const shipFromState = custom.seller?.shipFromState || "Punjab";

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50, compress: false });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve({ buffer: Buffer.concat(chunks), filename, invoiceNumber, contentType: "application/pdf" }));
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
    if (sellerIec) {
      doc.text(`IEC: ${sellerIec}`, 50, storeY, { width: 235 });
      storeY += 12;
    }
    doc.text(`Ship-From State: ${shipFromState}`, 50, storeY, { width: 235 });
    storeY += 12;

    // Right Column details (Billing & Shipping)
    const buyer = custom.buyer || {};
    const buyerName = buyer.name || order.customerName;
    const buyerCompany = buyer.companyName ? `${buyer.companyName}\n` : "";
    const buyerLines = buyer.addressLines && buyer.addressLines.length > 0 ? buyer.addressLines : shippingAddressLines(order.shippingAddress);
    const buyerStateCode = buyer.stateCode || "08";
    const placeOfSupply = buyer.placeOfSupply || "—";
    const buyerTaxId = buyer.taxId || "";
    const taxIdLabel = buyer.taxIdType || "Tax ID";

    let rightY = 76;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#64748b").text("BILLING & SHIPPING TO:", 315, rightY);
    rightY += 13;
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#0f172a").text(`${buyerCompany}${buyerName}`, 315, rightY, { width: 230 });
    rightY += doc.heightOfString(`${buyerCompany}${buyerName}`, { width: 230 }) + 3;
    doc.font("Helvetica").fontSize(8.5).fillColor("#475569");
    for (const line of buyerLines) {
      doc.text(line, 315, rightY, { width: 230 });
      rightY += 12;
    }
    if (buyer.phone) {
      doc.text(`Phone: ${buyer.phone}`, 315, rightY, { width: 230 });
      rightY += 12;
    }
    if (buyer.email) {
      doc.text(`Email: ${buyer.email}`, 315, rightY, { width: 230 });
      rightY += 12;
    }
    if (buyerTaxId) {
      doc.text(`${taxIdLabel}: ${buyerTaxId}`, 315, rightY, { width: 230 });
      rightY += 12;
    }
    doc.text(`State/UT Code: ${buyerStateCode}`, 315, rightY, { width: 230 });
    rightY += 12;
    doc.text(`Place of Supply: ${placeOfSupply}`, 315, rightY, { width: 230 });
    rightY += 12;

    // Dynamic Y position for order metadata card
    let metaCardY = Math.max(storeY, rightY) + 12;

    // 4. Order Details Card (Horizontal Summary Bar)
    doc.rect(50, metaCardY, 495, 42).fill("#f8fafc");
    doc.rect(50, metaCardY, 495, 42).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    // Left block
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Order Number: " + order.orderNumber, 62, metaCardY + 9);
    doc.text("Order Date: " + formatDate(order.createdAt, timezone), 62, metaCardY + 23);

    // Right block
    const invDateDisplay = custom.invoiceDate ? formatDate(custom.invoiceDate, timezone) : formatDate(order.createdAt, timezone);
    doc.text("Invoice Number: " + invoiceNumber, 315, metaCardY + 9);
    doc.text("Invoice Date: " + invDateDisplay, 315, metaCardY + 23);

    let tableY = metaCardY + 54;

    // 5. Items Table Column Layout & Headers (Spacious, Well-Padded Grid)
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

    const itemsToRender = custom.items && custom.items.length > 0 ? custom.items : [];

    itemsToRender.forEach((item, index) => {
      const displayHsn = item.hsnCode ? `HSN: ${item.hsnCode}` : null;
      const netAmount = item.netAmount !== undefined ? Number(item.netAmount) : Number(item.total) - Number(item.taxAmount);
      const unitTaxableValue = item.quantity > 0 ? netAmount / item.quantity : Number(item.unitPrice || 0);
      const taxRateVal = item.taxRate !== undefined ? item.taxRate : (netAmount > 0 ? Math.round((Number(item.taxAmount) / netAmount) * 100) : 0);
      const rowTaxType = item.taxType || "IGST";

      const prodTitle = item.title;
      const varTitle = item.variantTitle ? ` - ${item.variantTitle}` : "";
      const hsnText = displayHsn ? `\n(${displayHsn})` : "";
      const descText = `${prodTitle}${varTitle}${hsnText}`;

      const descHeight = doc.heightOfString(descText, { width: 160 });
      const rowPaddingY = 7;
      const rowHeight = Math.max(descHeight + rowPaddingY * 2, 28);

      if (currentY + rowHeight > 730) {
        doc.addPage();
        doc.rect(0, 0, 595, 10).fill("#E31E24");
        currentY = 50;
        drawTableHeader(currentY);
        currentY += 22;
      }

      const rowTop = currentY;

      if (index % 2 === 1) {
        doc.rect(50, rowTop, 495, rowHeight).fill("#f8fafc");
      }

      const descY = rowTop + (rowHeight - descHeight) / 2;
      const singleLineY = rowTop + (rowHeight - 10) / 2;
      const doubleLineY = rowTop + (rowHeight - 20) / 2;

      doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5);

      // Sl. No
      doc.text(String(item.sl || index + 1), 50, singleLineY, { width: 28, align: "center" });

      // Description
      doc.text(descText, 84, descY, { width: 160, align: "left" });

      // Unit Price
      doc.text(money(symbol, unitTaxableValue), 250, singleLineY, { width: 55, align: "center" });

      // Qty
      doc.text(String(item.quantity), 305, singleLineY, { width: 30, align: "center" });

      // Net Amount
      doc.text(money(symbol, netAmount), 335, singleLineY, { width: 55, align: "center" });

      // Tax Rate & Type
      doc.text(`${taxRateVal}%\n${rowTaxType}`, 390, doubleLineY, { width: 45, align: "center" });

      // Tax Amount
      doc.text(money(symbol, item.taxAmount), 435, singleLineY, { width: 55, align: "center" });

      // Total Amount
      doc.text(money(symbol, item.total), 490, singleLineY, { width: 55, align: "center" });

      currentY += rowHeight;

      doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
      colX.forEach((x) => {
        doc.moveTo(x, rowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
      });
    });

    // Summary Totals
    const summary = custom.summary || {};
    const taxableSubtotal = summary.subtotal !== undefined ? summary.subtotal : Number(order.subtotal);
    const totalTax = summary.taxAmount !== undefined ? summary.taxAmount : Number(order.taxAmount ?? 0);
    const finalTotal = summary.total !== undefined ? summary.total : Number(order.total);

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
    doc.text(money(symbol, finalTotal), 490, totalY, { width: 55, align: "center" });

    currentY += totalRowHeight;
    doc.lineCap("butt").moveTo(50, currentY).lineTo(545, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    colX.forEach((x) => {
      doc.moveTo(x, totalRowTop).lineTo(x, currentY).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    });

    let y = currentY + 14;

    // Subtotal Breakdown Section
    const discountAmount = summary.discount !== undefined ? summary.discount : Number(order.discount ?? 0);
    const shippingCharge = summary.shippingCharge !== undefined ? summary.shippingCharge : Number(order.shippingCharge ?? 0);
    const hasDiscountsOrShipping = discountAmount > 0 || shippingCharge > 0;

    if (hasDiscountsOrShipping) {
      y = maybeNewPage(doc, y, 90);
      addRightAmount(doc, "Subtotal (Taxable Value)", money(symbol, taxableSubtotal), y);
      y += 16;

      if (discountAmount > 0) {
        addRightAmount(doc, "Discount", `-${money(symbol, discountAmount)}`, y);
        y += 16;
      }
      if (shippingCharge > 0) {
        addRightAmount(doc, `Shipping (${order.shippingProvider ?? "Standard"})`, `+${money(symbol, shippingCharge)}`, y);
        y += 16;
      }
      doc.moveTo(335, y).lineTo(545, y).strokeColor("#cbd5e1").lineWidth(1).stroke();
      y += 8;
      doc.rect(280, y - 4, 265, 24).fill("#f1f5f9");
      addRightAmount(doc, "Total Amount", money(symbol, finalTotal), y + 3, true);
      y += 28;
    }

    // 6. Amount in Words & Authorized Signatory Block
    y = maybeNewPage(doc, y, 75);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#0f172a").text("Amount in Words:", 50, y);
    y += 13;
    doc.font("Helvetica").fontSize(9).fillColor("#475569").text(numberToWords(finalTotal), 50, y, { width: 235 });

    let signatoryY = y - 13;
    doc.rect(300, signatoryY, 245, 60).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text(custom.authorizedSignatory || `For ${storeName}:`, 306, signatoryY + 6);
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#475569").text("Authorized Signatory", 306, signatoryY + 44, { width: 233, align: "right" });

    y = Math.max(y + 20, signatoryY + 68);

    if (custom.notes) {
      y = maybeNewPage(doc, y, 25);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Notes / Remarks:", 50, y);
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#475569").text(custom.notes, 50, y, { width: 495 });
      y += doc.heightOfString(custom.notes, { width: 495 }) + 10;
    }

    if (custom.terms) {
      y = maybeNewPage(doc, y, 25);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Terms & Conditions:", 50, y);
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#475569").text(custom.terms, 50, y, { width: 495 });
      y += doc.heightOfString(custom.terms, { width: 495 }) + 10;
    }

    if (custom.bankDetails) {
      y = maybeNewPage(doc, y, 25);
      doc.font("Helvetica-Bold").fontSize(8.5).fillColor("#0f172a").text("Bank Details for Wire / NEFT Transfer:", 50, y);
      y += 11;
      doc.font("Helvetica").fontSize(8).fillColor("#475569").text(custom.bankDetails, 50, y, { width: 495 });
      y += doc.heightOfString(custom.bankDetails, { width: 495 }) + 10;
    }

    // 7. Payment Transaction Info Card
    y = maybeNewPage(doc, y, 42);
    const boxHeight = 34;
    doc.rect(50, y, 495, boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    doc.moveTo(200, y).lineTo(200, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.moveTo(320, y).lineTo(320, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();
    doc.moveTo(420, y).lineTo(420, y + boxHeight).strokeColor("#cbd5e1").lineWidth(0.75).stroke();

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Payment Transaction ID:", 55, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(order.paymentId || "—", 55, y + 18, { width: 140 });

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Date & Time:", 205, y + 6);
    doc.font("Helvetica").fontSize(8).fillColor("#0f172a").text(formatDateTime(order.createdAt, timezone), 205, y + 18, { width: 112 });

    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#64748b").text("Invoice Value:", 325, y + 6);
    doc.font("Helvetica").fontSize(8.5).fillColor("#0f172a").text(money(symbol, finalTotal), 325, y + 18, { width: 90 });

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
