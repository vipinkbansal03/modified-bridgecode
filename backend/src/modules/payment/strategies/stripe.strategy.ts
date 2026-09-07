import Stripe from "stripe";
import { PaymentMethodType } from "@prisma/client";
import { prisma } from "../../../config/database";
import { AppError } from "../../../utils/apiResponse";
import { PaymentInitiateResult, PaymentStrategy, PaymentVerifyResult } from "../types/payment.types";
import { getSettingValue } from "../../settings/settings.service";

const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA",
  "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF",
]);

function toStripeAmount(amount: number, currencyCode: string = "USD"): number {
  const code = currencyCode.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) {
    return Math.round(amount);
  }
  return Math.round(amount * 100);
}

export class StripeStrategy implements PaymentStrategy {
  readonly code = "STRIPE";

  async initiatePayment(order: any, config?: Record<string, string>): Promise<PaymentInitiateResult> {
    const secretKey =
      config?.STRIPE_SECRET_KEY ||
      (await getSettingValue("payment.stripe_secret_key")) ||
      process.env.STRIPE_SECRET_KEY;
    const successUrlPattern =
      config?.STRIPE_SUCCESS_URL ||
      process.env.STRIPE_SUCCESS_URL ||
      "http://localhost:3000/orders/{ORDER_ID}?payment=success";
    const cancelUrlPattern =
      config?.STRIPE_CANCEL_URL ||
      process.env.STRIPE_CANCEL_URL ||
      "http://localhost:3000/checkout?payment=cancelled";

    if (!secretKey) {
      throw new AppError("Stripe secret key is not configured.", 500);
    }

    const stripe = new Stripe(secretKey);

    const currencyCode = (order.currency?.code ?? "USD").toUpperCase();
    const amountInSmallestUnit = toStripeAmount(Number(order.total), currencyCode);

    const successUrl = successUrlPattern
      .replace("{ORDER_ID}", order.id)
      .replace("{SESSION_ID}", "{CHECKOUT_SESSION_ID}");

    const cancelUrl = cancelUrlPattern.replace("{ORDER_ID}", order.id);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: currencyCode.toLowerCase(),
            product_data: {
              name: `Modern Orthodontics - Order #${order.orderNumber}`,
              description: `Order total for ${order.items?.length ?? 1} item(s)`,
            },
            unit_amount: amountInSmallestUnit,
          },
          quantity: 1,
        },
      ],
      customer_email: order.customerEmail || undefined,
      client_reference_id: order.id,
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId ?? "",
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: session.id,
        paymentMethod: "STRIPE",
      },
    });

    return {
      paymentId: session.id,
      type: PaymentMethodType.HOSTED_REDIRECT,
      redirectUrl: session.url ?? undefined,
    };
  }

  async verifyPayment(order: any, payload: Record<string, unknown>, config?: Record<string, string>): Promise<PaymentVerifyResult> {
    const secretKey = config?.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      throw new AppError("Stripe secret key is not configured.", 500);
    }

    const sessionId = String(payload.sessionId || payload.session_id || order.paymentId || "");
    if (!sessionId) {
      throw new AppError("Missing Stripe session ID for verification.", 400);
    }

    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isPaid = session.payment_status === "paid";
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.id;

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: isPaid ? "PAID" : "FAILED",
        status: isPaid ? "PROCESSING" : order.status,
        paymentMethod: "STRIPE",
        paymentId: paymentIntentId,
      },
      include: {
        items: { include: { product: true, variant: true } },
        country: true,
        currency: true,
      },
    });

    return {
      success: isPaid,
      transactionId: paymentIntentId,
      paymentStatus: isPaid ? "PAID" : "FAILED",
      message: isPaid ? "Payment verified successfully." : "Payment not completed.",
      order: updatedOrder,
    };
  }
}
