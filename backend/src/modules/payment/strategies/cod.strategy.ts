import { PaymentMethodType } from "@prisma/client";
import { PaymentInitiateResult, PaymentStrategy, PaymentVerifyResult } from "../types/payment.types";

export class CodStrategy implements PaymentStrategy {
  readonly code = "COD";

  async initiatePayment(order: any): Promise<PaymentInitiateResult> {
    return {
      paymentId: order.id,
      type: PaymentMethodType.OFFLINE,
    };
  }

  async verifyPayment(order: any): Promise<PaymentVerifyResult> {
    return {
      success: true,
      transactionId: order.id,
      paymentStatus: "PENDING",
      message: "Order placed successfully. Payment will be collected on delivery.",
    };
  }
}
