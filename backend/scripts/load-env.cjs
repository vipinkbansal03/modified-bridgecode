const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

function getAppEnv() {
  const raw = String(process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  if (raw === "production" || raw === "staging" || raw === "test") return raw;
  return "development";
}

function resolveEnvFile(appEnv) {
  if (process.env.DOTENV_CONFIG_PATH) return process.env.DOTENV_CONFIG_PATH;
  if (appEnv === "production") return ".env.production";
  if (appEnv === "staging") return ".env.staging";
  if (appEnv === "test") return ".env.test";
  return ".env";
}

function getDatabaseName(databaseUrl) {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

const appEnv = getAppEnv();
const envFile = resolveEnvFile(appEnv);
const envPath = path.resolve(process.cwd(), envFile);
const mustExist = appEnv === "production" || appEnv === "staging" || Boolean(process.env.DOTENV_CONFIG_PATH);

if (!fs.existsSync(envPath)) {
  if (mustExist) throw new Error(`Required environment file is missing: ${envPath}`);
} else {
  const result = dotenv.config({ path: envPath, override: mustExist, quiet: true });
  if (result.error) throw result.error;
}

if (appEnv === "production" || appEnv === "staging") {
  const databaseName = getDatabaseName(process.env.DATABASE_URL || "");
  const expectedDatabaseName = appEnv === "production" ? "modern_prod" : "modern_staging";
  if (databaseName !== expectedDatabaseName) {
    throw new Error(`DATABASE_URL database must be ${expectedDatabaseName} for ${appEnv}`);
  }
}
