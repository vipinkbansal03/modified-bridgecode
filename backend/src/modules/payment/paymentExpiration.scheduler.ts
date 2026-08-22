import { logger } from "../../config/logger";
import { processExpiredOrders } from "./paymentReconciliation.service";

let intervalHandle: NodeJS.Timeout | null = null;

export function initPaymentExpirationWorker(intervalMs: number = 60000) {
  if (intervalHandle) {
    clearInterval(intervalHandle);
  }

  logger.info(`[paymentExpiration] Starting payment expiration worker (Interval: ${intervalMs}ms)`);

  // Run initial pass
  processExpiredOrders().catch((err) => {
    logger.error("[paymentExpiration] Error in initial expired orders pass:", err);
  });

  intervalHandle = setInterval(async () => {
    try {
      const count = await processExpiredOrders();
      if (count > 0) {
        logger.info(`[paymentExpiration] Worker expired ${count} abandoned orders and released reservations.`);
      }
    } catch (err) {
      logger.error("[paymentExpiration] Error processing expired orders in worker:", err);
    }
  }, intervalMs);

  return intervalHandle;
}

export function stopPaymentExpirationWorker() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    logger.info("[paymentExpiration] Stopped payment expiration worker.");
  }
}
