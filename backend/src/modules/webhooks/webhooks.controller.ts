import type { Request, Response } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { OrderStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { reconcilePaymentSuccess, reconcilePaymentFailure } from "../payment/paymentReconciliation.service";
import { getSettingValue } from "../settings/settings.service";

// ─── Razorpay ────────────────────────────────────────────

export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  let secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    const pm = await prisma.paymentMethod.findUnique({
      where: { code: "RAZORPAY" },
      include: { configs: true },
    });
    if (pm) {
      secret = pm.configs.find((c) => c.configKey === "RAZORPAY_WEBHOOK_SECRET")?.configValue;
    }
  }

  if (!secret) {
    res.status(500).json({ error: "Razorpay webhook secret is not configured." });
    return;
  }

  const signature = req.headers["x-razorpay-signature"] as string;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !signature) {
    res.status(400).json({ error: "Missing body or signature." });
    return;
  }

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    res.status(400).json({ error: "Invalid signature." });
    return;
  }

  const event = req.body as {
    event: string;
    payload: {
      payment?: {
        entity?: {
          id: string;
          order_id: string;
          status: string;
          error_code?: string;
          error_description?: string;
        };
      };
      order?: {
        entity?: {
          id: string;
          status: string;
        };
      };
    };
  };

  try {
    const paymentEntity = event.payload?.payment?.entity;
    const orderEntity = event.payload?.order?.entity;
    const gatewayOrderId = paymentEntity?.order_id || orderEntity?.id;
    const paymentId = paymentEntity?.id || "";

    if (event.event === "payment.captured" || event.event === "order.paid") {
      if (gatewayOrderId) {
        await reconcilePaymentSuccess({
          gatewayOrderId,
          gatewayPaymentId: paymentId || `pay_captured_${Date.now()}`,
          provider: "RAZORPAY",
          metadata: { webhookEvent: event.event, payload: event.payload },
        });
        logger.info(`Razorpay Webhook: payment captured for gateway order ${gatewayOrderId}`);
      }
    } else if (event.event === "payment.failed") {
      if (gatewayOrderId) {
        await reconcilePaymentFailure({
          gatewayOrderId,
          gatewayPaymentId: paymentId,
          errorCode: paymentEntity?.error_code,
          errorMessage: paymentEntity?.error_description || "Razorpay webhook reported payment failure.",
          provider: "RAZORPAY",
        });
        logger.info(`Razorpay Webhook: payment failed for gateway order ${gatewayOrderId}`);
      }
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Razorpay webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
}

// ─── Stripe Helpers ──────────────────────────────────────

function resolveNextPaidOrderStatus(currentStatus: OrderStatus): OrderStatus {
  if (currentStatus === "PENDING" || currentStatus === "CONFIRMED") {
    return "PROCESSING";
  }
  return currentStatus;
}

// ─── Stripe ──────────────────────────────────────────────

export async function stripeWebhook(req: Request, res: Response): Promise<void> {
  let secret = process.env.STRIPE_WEBHOOK_SECRET;
  let secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secret || !secretKey) {
    const pm = await prisma.paymentMethod.findUnique({
      where: { code: "STRIPE" },
      include: { configs: true },
    });
    if (pm) {
      secret = secret || pm.configs.find((c) => c.configKey === "STRIPE_WEBHOOK_SECRET")?.configValue;
      secretKey = secretKey || pm.configs.find((c) => c.configKey === "STRIPE_SECRET_KEY")?.configValue;
    }
  }

  if (!secret || !secretKey) {
    res.status(500).json({ error: "Stripe webhook secret or key is not configured." });
    return;
  }

  const sig = req.headers["stripe-signature"] as string;
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!rawBody || !sig) {
    res.status(400).json({ error: "Missing body or signature." });
    return;
  }

  const stripe = new Stripe(secretKey);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    res.status(400).json({ error: `Invalid Stripe signature: ${err?.message || err}` });
    return;
  }

  // Idempotency Check: Skip immediately if event ID already recorded
  const existingEvent = await prisma.webhookEvent.findUnique({
    where: { eventId: event.id },
  });
  if (existingEvent) {
    logger.info(`Stripe: event ${event.id} (${event.type}) already processed. Skipping (idempotent 200).`);
    res.json({ received: true, alreadyProcessed: true });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.client_reference_id || session.metadata?.orderId;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.id;

      await prisma.$transaction(async (tx) => {
        if (orderId) {
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (order) {
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: "PAID",
                status: resolveNextPaidOrderStatus(order.status),
                paymentMethod: "STRIPE",
                paymentProvider: "STRIPE",
                paymentId: paymentIntentId,
              },
            });
            logger.info(`Stripe: checkout session completed for order ${orderId}, paymentId: ${paymentIntentId}`);
          }
        } else if (session.id) {
          const orders = await tx.order.findMany({
            where: { paymentId: session.id },
          });
          for (const ord of orders) {
            await tx.order.update({
              where: { id: ord.id },
              data: {
                paymentStatus: "PAID",
                status: resolveNextPaidOrderStatus(ord.status),
                paymentMethod: "STRIPE",
                paymentProvider: "STRIPE",
                paymentId: paymentIntentId,
              },
            });
          }
        }

        await tx.webhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            provider: "STRIPE",
            payload: event.data.object as any,
          },
        });
      });
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.orderId;

      await prisma.$transaction(async (tx) => {
        if (orderId) {
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (order) {
            await tx.order.update({
              where: { id: order.id },
              data: {
                paymentStatus: "PAID",
                status: resolveNextPaidOrderStatus(order.status),
                paymentMethod: "STRIPE",
                paymentProvider: "STRIPE",
                paymentId: intent.id,
              },
            });
          }
        } else {
          const orders = await tx.order.findMany({
            where: { paymentId: intent.id },
          });
          for (const ord of orders) {
            await tx.order.update({
              where: { id: ord.id },
              data: {
                paymentStatus: "PAID",
                status: resolveNextPaidOrderStatus(ord.status),
                paymentMethod: "STRIPE",
                paymentProvider: "STRIPE",
              },
            });
          }
        }

        await tx.webhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            provider: "STRIPE",
            payload: event.data.object as any,
          },
        });
      });
      logger.info(`Stripe: payment succeeded for intent ${intent.id}`);
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.orderId;

      await prisma.$transaction(async (tx) => {
        if (orderId) {
          const order = await tx.order.findUnique({ where: { id: orderId } });
          if (order) {
            if (order.paymentStatus === "PAID") {
              logger.info(`Stripe: payment failed event received for already PAID order ${order.id}. Preserving PAID status.`);
            } else {
              await tx.order.update({
                where: { id: order.id },
                data: { paymentStatus: "FAILED" },
              });
            }
          }
        } else {
          await tx.order.updateMany({
            where: {
              paymentId: intent.id,
              paymentStatus: { not: "PAID" },
            },
            data: { paymentStatus: "FAILED" },
          });
        }

        await tx.webhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            provider: "STRIPE",
            payload: event.data.object as any,
          },
        });
      });
      logger.info(`Stripe: payment failed for intent ${intent.id}`);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;

      await prisma.$transaction(async (tx) => {
        if (charge.payment_intent) {
          await tx.order.updateMany({
            where: { paymentId: charge.payment_intent as string },
            data: { paymentStatus: "REFUNDED" },
          });
        }

        await tx.webhookEvent.create({
          data: {
            eventId: event.id,
            eventType: event.type,
            provider: "STRIPE",
            payload: event.data.object as any,
          },
        });
      });
    } else {
      await prisma.webhookEvent.create({
        data: {
          eventId: event.id,
          eventType: event.type,
          provider: "STRIPE",
          payload: event.data.object as any,
        },
      });
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
}

// ─── Cashfree ────────────────────────────────────────────

export async function cashfreeWebhook(req: Request, res: Response): Promise<void> {
  const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
  const signature = req.headers["x-webhook-signature"] as string;
  const timestamp = req.headers["x-webhook-timestamp"] as string;
  const idempotencyKey = req.headers["x-idempotency-key"] as string;
  const attempt = req.headers["x-webhook-attempt"] as string;

  if (!rawBody || !signature || !timestamp) {
    res.status(400).json({ error: "Missing body, signature or timestamp." });
    return;
  }

  let secret = process.env.CASHFREE_WEBHOOK_SECRET;
  if (!secret) {
    const pm = await prisma.paymentMethod.findUnique({
      where: { code: "CASHFREE" },
      include: { configs: true },
    });
    if (pm) {
      secret = pm.configs.find((c) => c.configKey === "CASHFREE_WEBHOOK_SECRET")?.configValue;
    }
  }
  if (!secret) {
    secret = await getSettingValue("payment.cashfree_webhook_secret");
  }
  if (!secret) {
    secret = process.env.CASHFREE_CLIENT_SECRET || (await getSettingValue("payment.cashfree_client_secret"));
  }

  if (!secret) {
    res.status(500).json({ error: "Cashfree webhook secret is not configured." });
    return;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}${rawBody.toString("utf8")}`)
    .digest("base64");

  if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    res.status(400).json({ error: "Invalid signature." });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid payload." });
    return;
  }

  const type = String(event?.type || "");
  const data = event?.data || {};
  const orderData = data?.order || {};
  const paymentData = data?.payment || {};
  const errorDetails = data?.error_details || {};
  const gatewayOrderId = String(orderData?.order_id || "");
  const gatewayPaymentId = String(paymentData?.cf_payment_id || "");

  try {
    if (type === "PAYMENT_CHARGES_WEBHOOK" || !gatewayOrderId) {
      if (gatewayOrderId) {
        logger.info(`Cashfree Webhook: charges event for gateway order ${gatewayOrderId}`);
      } else {
        logger.warn("Cashfree Webhook: event without gateway order id.");
      }
      res.json({ received: true });
      return;
    }

    const tx = await prisma.paymentTransaction.findFirst({
      where: { gatewayOrderId, provider: "CASHFREE" },
      include: { order: { include: { currency: true } } },
    });

    if (!tx) {
      logger.warn(`Cashfree Webhook: no payment transaction for gateway order ${gatewayOrderId}`);
      res.json({ received: true });
      return;
    }

    const order = tx.order;

    if (type === "PAYMENT_SUCCESS_WEBHOOK" || paymentData?.payment_status === "SUCCESS") {
      const webhookAmount = Number(orderData?.order_amount);
      const webhookCurrency = String(orderData?.order_currency || "").toUpperCase();
      const expectedAmount = Number(order.total);
      const expectedCurrency = (order.currency?.code || "INR").toUpperCase();

      if (Number.isNaN(webhookAmount) || Math.abs(webhookAmount - expectedAmount) > 0.01) {
        logger.error(
          `Cashfree Webhook: amount mismatch for order ${order.id}. Expected ${expectedAmount} ${expectedCurrency}, got ${orderData?.order_amount} ${webhookCurrency}`
        );
        res.status(500).json({ error: "Webhook amount validation failed." });
        return;
      }

      if (webhookCurrency && webhookCurrency !== expectedCurrency) {
        logger.error(
          `Cashfree Webhook: currency mismatch for order ${order.id}. Expected ${expectedCurrency}, got ${webhookCurrency}`
        );
        res.status(500).json({ error: "Webhook currency validation failed." });
        return;
      }

      await reconcilePaymentSuccess({
        gatewayOrderId,
        gatewayPaymentId: gatewayPaymentId || `cf_pay_captured_${Date.now()}`,
        provider: "CASHFREE",
        metadata: {
          webhookEvent: type,
          paymentStatus: paymentData?.payment_status,
          paymentAmount: paymentData?.payment_amount,
          paymentCurrency: paymentData?.payment_currency,
          idempotencyKey,
          attempt,
        },
      });
      logger.info(`Cashfree Webhook: payment captured for gateway order ${gatewayOrderId}`);
    } else if (type === "PAYMENT_FAILED_WEBHOOK" || paymentData?.payment_status === "FAILED") {
      await reconcilePaymentFailure({
        gatewayOrderId,
        gatewayPaymentId,
        errorCode: errorDetails?.error_code,
        errorMessage: errorDetails?.error_description || paymentData?.payment_message || "Cashfree webhook reported payment failure.",
        provider: "CASHFREE",
      });
      logger.info(`Cashfree Webhook: payment failed for gateway order ${gatewayOrderId}`);
    } else if (type === "PAYMENT_USER_DROPPED_WEBHOOK" || paymentData?.payment_status === "USER_DROPPED") {
      await reconcilePaymentFailure({
        gatewayOrderId,
        gatewayPaymentId,
        errorCode: "USER_DROPPED",
        errorMessage: paymentData?.payment_message || "Customer dropped the payment before completion.",
        provider: "CASHFREE",
      });
      logger.info(`Cashfree Webhook: payment dropped for gateway order ${gatewayOrderId}`);
    } else {
      logger.info(`Cashfree Webhook: unhandled event type '${type}' for gateway order ${gatewayOrderId}`);
    }

    res.json({ received: true });
  } catch (err) {
    logger.error("Cashfree webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
}
