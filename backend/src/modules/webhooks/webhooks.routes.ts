import { Router, type Request, type Response, type NextFunction } from "express";
import { razorpayWebhook, stripeWebhook, cashfreeWebhook } from "./webhooks.controller";

const router = Router();

function captureRawBody(req: Request, _res: Response, next: NextFunction) {
  const chunks: Buffer[] = [];
  req.on("data", (chunk: Buffer) => chunks.push(chunk));
  req.on("end", () => {
    (req as Request & { rawBody?: Buffer }).rawBody = Buffer.concat(chunks);
    next();
  });
  req.on("error", next);
}

router.post("/razorpay", captureRawBody, razorpayWebhook);
router.post("/stripe", captureRawBody, stripeWebhook);
router.post("/cashfree", captureRawBody, cashfreeWebhook);

export default router;
