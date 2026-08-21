import "./config/env";
import app from "./app";
import { connectDB, prisma } from "./config/database";
import { logger } from "./config/logger";
import { initScheduledSync } from "./modules/currencies/currencies.scheduler";

const PORT = parseInt(process.env.PORT || "4000", 10);

async function main() {
  await connectDB();
  await initScheduledSync();

  try {
    const { initializeApp } = await import("firebase-admin/app");
    initializeApp();
    logger.info("Firebase Admin initialized successfully.");
  } catch (err: any) {
    logger.warn(`Firebase Admin initialization skipped: ${err.message}`);
  }

  const server = app.listen(PORT, () => {
    logger.info(`🚀 Server running on http://localhost:${PORT}`);
    logger.info(`   Environment: ${process.env.NODE_ENV || "development"}`);
    logger.info(`   Storage: ${process.env.STORAGE_PROVIDER || "local"}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully…`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Database disconnected. Bye!");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled Rejection:", reason);
    shutdown("unhandledRejection");
  });
}

main().catch((err) => {
  logger.error("Fatal startup error:", err);
  process.exit(1);
});
