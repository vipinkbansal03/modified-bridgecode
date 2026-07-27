import { PaymentMethodType } from "@prisma/client";

export interface PaymentInitiateResult {
  paymentId: string;
  type: PaymentMethodType;
  redirectUrl?: string;
  clientScriptUrl?: string;
  sdkPayload?: Record<string, unknown>;
}

export interface PaymentVerifyResult {
  success: boolean;
  transactionId?: string;
  paymentStatus: "PAID" | "PENDING" | "FAILED";
  message?: string;
  order?: unknown;
}

export interface PaymentStrategy {
  readonly code: string;
  
  initiatePayment(order: any, config?: Record<string, string>): Promise<PaymentInitiateResult>;
  verifyPayment(order: any, payload: Record<string, unknown>, config?: Record<string, string>): Promise<PaymentVerifyResult>;
  handleWebhook?(event: unknown, config?: Record<string, string>): Promise<PaymentVerifyResult>;
  refund?(order: any, amount: number, config?: Record<string, string>): Promise<unknown>;
}
