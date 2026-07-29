import type { Request, Response } from "express";
import crypto from "crypto";
import Stripe from "stripe";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

// ─── Razorpay ────────────────────────────────────────────

export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Webhook secret not configured." });
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

  const event = req.body as { event: string; payload: { payment: { entity: { id: string; order_id: string; status: string } } } };

  try {
    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment.entity.id;
      await prisma.order.updateMany({
        where: { paymentId: event.payload.payment.entity.order_id },
        data: { paymentStatus: "PAID", paymentId },
      });
      logger.info(`Razorpay: payment captured for order ${event.payload.payment.entity.order_id}`);
    } else if (event.event === "payment.failed") {
      await prisma.order.updateMany({
        where: { paymentId: event.payload.payment.entity.order_id },
        data: { paymentStatus: "FAILED" },
      });
    }
    res.json({ received: true });
  } catch (err) {
    logger.error("Razorpay webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.client_reference_id || session.metadata?.orderId;
      const paymentIntentId =
        typeof session.payment_intent === "string"
          ? session.payment_intent
          : session.id;

      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            status: "PROCESSING",
            paymentMethod: "STRIPE",
            paymentId: paymentIntentId,
          },
        });
        logger.info(`Stripe: checkout session completed for order ${orderId}, paymentId: ${paymentIntentId}`);
      } else if (session.id) {
        await prisma.order.updateMany({
          where: { paymentId: session.id },
          data: {
            paymentStatus: "PAID",
            status: "PROCESSING",
            paymentMethod: "STRIPE",
            paymentId: paymentIntentId,
          },
        });
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: {
            paymentStatus: "PAID",
            status: "PROCESSING",
            paymentMethod: "STRIPE",
            paymentId: intent.id,
          },
        });
      } else {
        await prisma.order.updateMany({
          where: { paymentId: intent.id },
          data: {
            paymentStatus: "PAID",
            status: "PROCESSING",
            paymentMethod: "STRIPE",
          },
        });
      }
      logger.info(`Stripe: payment succeeded for intent ${intent.id}`);
    } else if (event.type === "payment_intent.payment_failed") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata?.orderId;
      if (orderId) {
        await prisma.order.update({
          where: { id: orderId },
          data: { paymentStatus: "FAILED" },
        });
      } else {
        await prisma.order.updateMany({
          where: { paymentId: intent.id },
          data: { paymentStatus: "FAILED" },
        });
      }
      logger.info(`Stripe: payment failed for intent ${intent.id}`);
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if (charge.payment_intent) {
        await prisma.order.updateMany({
          where: { paymentId: charge.payment_intent as string },
          data: { paymentStatus: "REFUNDED" },
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    logger.error("Stripe webhook error:", err);
    res.status(500).json({ error: "Webhook processing failed." });
  }
}
