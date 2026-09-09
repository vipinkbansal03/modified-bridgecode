import { PaymentMethodType } from "@prisma/client";
import { prisma } from "../../../config/database";
import { AppError } from "../../../utils/apiResponse";
import { PaymentInitiateResult, PaymentStrategy, PaymentVerifyResult } from "../types/payment.types";
import { getSettingValue } from "../../settings/settings.service";

const CASHFREE_API_VERSION = "2025-01-01";
const CASHFREE_SDK_URL = "https://sdk.cashfree.com/js/v3/cashfree.js";

function resolveEnv(): "sandbox" | "production" {
  const env = (process.env.CASHFREE_ENV || "production").trim().toLowerCase();
  return env === "sandbox" ? "sandbox" : "production";
}

function resolveBaseUrl(): string {
  if (process.env.CASHFREE_API_BASE_URL) {
    return process.env.CASHFREE_API_BASE_URL.replace(/\/+$/, "");
  }
  return resolveEnv() === "sandbox" ? "https://sandbox.cashfree.com" : "https://api.cashfree.com";
}

async function resolveCredentials(config?: Record<string, string>) {
  const clientId =
    config?.CASHFREE_CLIENT_ID ||
    (await getSettingValue("payment.cashfree_client_id")) ||
    process.env.CASHFREE_CLIENT_ID;
  const clientSecret =
    config?.CASHFREE_CLIENT_SECRET ||
    (await getSettingValue("payment.cashfree_client_secret")) ||
    process.env.CASHFREE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new AppError("Cashfree credentials are not configured.", 500);
  }

  return { clientId, clientSecret };
}

export class CashfreeStrategy implements PaymentStrategy {
  readonly code = "CASHFREE";

  async initiatePayment(order: any, config?: Record<string, string>): Promise<PaymentInitiateResult> {
    const { clientId, clientSecret } = await resolveCredentials(config);

    // Compute next sequential attempt number
    const lastAttempt = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id },
      orderBy: { attemptNumber: "desc" },
    });
    const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;
    const cfOrderId = attemptNumber > 1 ? `${order.orderNumber}-A${attemptNumber}` : order.orderNumber;

    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const returnUrl = (process.env.CASHFREE_RETURN_URL || `${frontendUrl}/orders/{ORDER_ID}/pay?payment=cashfree&order_id={order_id}`)
      .replace("{ORDER_ID}", order.id);
    const notifyUrl =
      process.env.CASHFREE_NOTIFY_URL ||
      `${process.env.BACKEND_URL || "http://localhost:4000"}/api/webhooks/cashfree`;

    const payload = {
      order_id: cfOrderId,
      order_amount: Number(order.total),
      order_currency: order.currency?.code ?? "INR",
      customer_details: {
        customer_id: order.customerId || cfOrderId,
        customer_name: order.customerName || "Modern Orthodontics Customer",
        customer_email: order.customerEmail || "",
        customer_phone: order.customerPhone || "",
      },
      order_meta: {
        return_url: returnUrl,
        notify_url: notifyUrl,
      },
      order_note: `Order ${order.orderNumber} (Attempt #${attemptNumber})`,
    };

    let cfOrder: any;
    try {
      const res = await fetch(`${resolveBaseUrl()}/pg/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "x-api-version": CASHFREE_API_VERSION,
          "X-Client-Id": clientId,
          "X-Client-Secret": clientSecret,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (body as any)?.message || JSON.stringify(body);
        throw new AppError(`Cashfree order creation failed: ${message}`, 502);
      }
      cfOrder = body;
    } catch (err: any) {
      if (err instanceof AppError) throw err;
      throw new AppError(`Cashfree order creation failed: ${err?.message || err}`, 502);
    }

    const paymentSessionId = cfOrder?.payment_session_id;
    if (!paymentSessionId) {
      throw new AppError("Cashfree did not return a payment session for the order.", 502);
    }

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: cfOrderId,
        paymentMethod: "CASHFREE",
      },
    });

    // Record PaymentTransaction attempt
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        attemptNumber,
        paymentMethod: "CASHFREE",
        provider: "CASHFREE",
        gatewayOrderId: cfOrderId,
        status: "PENDING",
        amount: order.total,
        currency: order.currency?.code ?? "INR",
        metadata: { paymentSessionId, attemptNumber, environment: resolveEnv() },
      },
    });

    return {
      paymentId: cfOrderId,
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: CASHFREE_SDK_URL,
      sdkPayload: {
        paymentSessionId,
        orderId: cfOrderId,
        mode: resolveEnv(),
      },
    };
  }

  async verifyPayment(order: any, _payload?: Record<string, unknown>, _config?: Record<string, string>): Promise<PaymentVerifyResult> {
    // Cashfree confirmation is webhook-authoritative; no status-API polling.
    // Report the persisted order state only.
    const tx = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id },
      orderBy: { attemptNumber: "desc" },
    });

    let paymentStatus: "PAID" | "PENDING" | "FAILED";
    if (order.paymentStatus === "PAID") {
      paymentStatus = "PAID";
    } else if (order.paymentStatus === "FAILED" || tx?.status === "FAILED") {
      paymentStatus = "FAILED";
    } else {
      paymentStatus = "PENDING";
    }

    return {
      success: paymentStatus === "PAID",
      transactionId: tx?.gatewayPaymentId ?? tx?.gatewayOrderId ?? undefined,
      paymentStatus,
      message: paymentStatus === "PAID" ? "Payment verified successfully." : "Payment confirmation is awaited via the Cashfree webhook.",
      order,
    };
  }
}