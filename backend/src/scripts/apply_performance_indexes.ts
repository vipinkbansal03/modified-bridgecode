import "../config/env";
import fs from "fs";
import path from "path";
import { prisma } from "../config/database";

async function main() {
  console.log("🚀 Applying Performance Indexes to PostgreSQL...");
  const sqlPath = path.resolve(__dirname, "../prisma/migrations/add_performance_indexes.sql");
  if (!fs.existsSync(sqlPath)) {
    throw new Error(`Migration SQL file not found at: ${sqlPath}`);
  }

  const rawSql = fs.readFileSync(sqlPath, "utf-8");
  const statements = rawSql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Found ${statements.length} SQL statements to execute.`);

  let successCount = 0;
  for (const statement of statements) {
    const t0 = Date.now();
    try {
      await prisma.$executeRawUnsafe(statement);
      const duration = Date.now() - t0;
      const preview = statement.replace(/\s+/g, " ").slice(0, 65);
      console.log(`  ✅ [${duration}ms] ${preview}...`);
      successCount++;
    } catch (err: any) {
      console.error(`  ❌ Failed on statement:\n${statement}\nError: ${err.message}`);
      throw err;
    }
  }

  console.log(`\n🎉 Successfully applied ${successCount}/${statements.length} indexes and constraints!`);
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
