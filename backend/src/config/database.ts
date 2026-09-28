import "./env";
import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

declare global {
  // Allow global var re-use in dev hot-reload
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Ensure connection pool settings if not explicitly specified in DATABASE_URL
if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("connection_limit=")) {
  const separator = process.env.DATABASE_URL.includes("?") ? "&" : "?";
  process.env.DATABASE_URL = `${process.env.DATABASE_URL}${separator}connection_limit=15&pool_timeout=30`;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    datasources: process.env.DATABASE_URL
      ? {
          db: {
            url: process.env.DATABASE_URL,
          },
        }
      : undefined,
    log: [
      { level: "query", emit: "event" },
      { level: "error", emit: "stdout" },
      { level: "warn", emit: "stdout" },
    ],
  });

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

prisma.$on("query" as never, (e: { query: string; duration: number }) => {
  if (process.env.NODE_ENV === "development") {
    logger.debug(`Query: ${e.query} | Duration: ${e.duration}ms`);
  }
});

export async function connectDB() {
  try {
    await prisma.$connect();
    logger.info("PostgreSQL connected via Prisma");
  } catch (err) {
    logger.error("Database connection failed", err);
    process.exit(1);
  }
}
