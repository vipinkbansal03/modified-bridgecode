import crypto from "crypto";
import Razorpay from "razorpay";
import { PaymentMethodType } from "@prisma/client";
import { prisma } from "../../../config/database";
import { AppError } from "../../../utils/apiResponse";
import { PaymentInitiateResult, PaymentStrategy, PaymentVerifyResult } from "../types/payment.types";
import { reconcilePaymentSuccess, reconcilePaymentFailure } from "../paymentReconciliation.service";

export class RazorpayStrategy implements PaymentStrategy {
  readonly code = "RAZORPAY";

  async initiatePayment(order: any, config?: Record<string, string>): Promise<PaymentInitiateResult> {
    const keyId = config?.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID;
    const keySecret = config?.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new AppError("Razorpay credentials are not configured.", 500);
    }

    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const amountInPaise = Math.round(Number(order.total) * 100);

    // Compute next sequential attempt number
    const lastAttempt = await prisma.paymentTransaction.findFirst({
      where: { orderId: order.id },
      orderBy: { attemptNumber: "desc" },
    });
    const attemptNumber = (lastAttempt?.attemptNumber ?? 0) + 1;
    const receipt = attemptNumber > 1 ? `${order.orderNumber}-A${attemptNumber}` : order.orderNumber;

    const rzpOrder = await rzp.orders.create({
      amount: amountInPaise,
      currency: order.currency?.code ?? "INR",
      receipt,
      notes: {
        orderId: order.id,
        customerId: order.customerId ?? "",
        attemptNumber: String(attemptNumber),
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: rzpOrder.id,
        paymentMethod: "RAZORPAY",
      },
    });

    // Record PaymentTransaction attempt
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        attemptNumber,
        paymentMethod: "RAZORPAY",
        provider: "RAZORPAY",
        gatewayOrderId: rzpOrder.id,
        status: "PENDING",
        amount: order.total,
        currency: rzpOrder.currency ?? order.currency?.code ?? "INR",
        metadata: { receipt, attemptNumber },
      },
    });

    return {
      paymentId: rzpOrder.id,
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
      sdkPayload: {
        key: keyId,
        amount: amountInPaise,
        currency: rzpOrder.currency,
        name: "Modern Orthodontics",
        description: `Order #${order.orderNumber} (Attempt #${attemptNumber})`,
        order_id: rzpOrder.id,
        prefill: {
          name: order.customerName,
          email: order.customerEmail,
          contact: order.customerPhone,
        },
      },
    };
  }

  async verifyPayment(order: any, payload: Record<string, unknown>, config?: Record<string, string>): Promise<PaymentVerifyResult> {
    const keySecret = config?.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      throw new AppError("Razorpay credentials are not configured.", 500);
    }

    const razorpay_order_id = String(payload.razorpay_order_id || "");
    const razorpay_payment_id = String(payload.razorpay_payment_id || "");
    const razorpay_signature = String(payload.razorpay_signature || "");

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await reconcilePaymentFailure({
        orderId: order.id,
        gatewayOrderId: razorpay_order_id,
        gatewayPaymentId: razorpay_payment_id,
        errorCode: "SIGNATURE_MISMATCH",
        errorMessage: "Invalid payment signature verification failed.",
      });

      throw new AppError("Invalid payment signature verification failed.", 400);
    }

    const { order: updatedOrder } = await reconcilePaymentSuccess({
      orderId: order.id,
      gatewayOrderId: razorpay_order_id,
      gatewayPaymentId: razorpay_payment_id,
      gatewaySignature: razorpay_signature,
      provider: "RAZORPAY",
    });

    return {
      success: true,
      transactionId: razorpay_payment_id,
      paymentStatus: "PAID",
      message: "Payment verified successfully.",
      order: updatedOrder,
    };
  }
}
