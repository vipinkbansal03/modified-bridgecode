import { PaymentStrategy } from "./types/payment.types";
import { CodStrategy } from "./strategies/cod.strategy";
import { RazorpayStrategy } from "./strategies/razorpay.strategy";
import { StripeStrategy } from "./strategies/stripe.strategy";
import { CashfreeStrategy } from "./strategies/cashfree.strategy";

export class PaymentGatewayRegistry {
  private static strategies = new Map<string, PaymentStrategy>();

  public static register(strategy: PaymentStrategy) {
    this.strategies.set(strategy.code.toUpperCase(), strategy);
  }

  public static get(code: string): PaymentStrategy {
    const strategy = this.strategies.get(code.toUpperCase());
    if (!strategy) {
      throw new Error(`Payment strategy '${code}' is not supported on server.`);
    }
    return strategy;
  }

  public static has(code: string): boolean {
    return this.strategies.has(code.toUpperCase());
  }
}

// Auto-register built-in strategies
PaymentGatewayRegistry.register(new CodStrategy());
PaymentGatewayRegistry.register(new RazorpayStrategy());
PaymentGatewayRegistry.register(new StripeStrategy());
PaymentGatewayRegistry.register(new CashfreeStrategy());

