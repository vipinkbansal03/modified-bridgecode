import { logger } from "../../config/logger";
import { prisma } from "../../config/database";
import { syncExchangeRates } from "./currencies.service";

let timerId: NodeJS.Timeout | null = null;

export async function initScheduledSync() {
  logger.info("[Currency Scheduler] Initializing Daily Exchange Rate Sync Scheduler...");

  // Schedule the next check
  scheduleNextRun();
}

function scheduleNextRun() {
  const now = new Date();
  const nextRun = new Date(now);
  
  // Set to 01:00 UTC
  nextRun.setUTCHours(1, 0, 0, 0);
  
  // If 01:00 UTC has already passed today, set to tomorrow
  if (now.getTime() >= nextRun.getTime()) {
    nextRun.setUTCDate(nextRun.getUTCDate() + 1);
  }

  const delay = nextRun.getTime() - now.getTime();
  logger.info(`[Currency Scheduler] Next scheduled sync set for: ${nextRun.toISOString()} (in ${(delay / 1000 / 60).toFixed(2)} minutes)`);

  // Save next scheduled sync time to Settings
  prisma.setting.upsert({
    where: { key: "currency.next_scheduled_sync_time" },
    create: { key: "currency.next_scheduled_sync_time", value: nextRun.toISOString(), group: "currency", type: "string" },
    update: { value: nextRun.toISOString() }
  }).catch((err) => {
    logger.error("[Currency Scheduler] Failed to save next scheduled sync time setting:", err);
  });

  if (timerId) {
    clearTimeout(timerId);
  }

  timerId = setTimeout(async () => {
    logger.info("[Currency Scheduler] Running scheduled exchange rate sync...");
    try {
      await syncExchangeRates(undefined, "Auto");
      logger.info("[Currency Scheduler] Scheduled exchange rate sync completed successfully.");
    } catch (err) {
      logger.error("[Currency Scheduler] Scheduled exchange rate sync failed:", err);
    }

    // Schedule next run
    scheduleNextRun();
  }, delay);
}
