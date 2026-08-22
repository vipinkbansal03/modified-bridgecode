import fs from "fs";
import path from "path";
import dotenv from "dotenv";

type AppEnv = "development" | "staging" | "production" | "test";

const loadedEnv = loadEnvFile();

function getAppEnv(): AppEnv {
  const raw = (process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  if (raw === "production" || raw === "staging" || raw === "test") return raw;
  return "development";
}

function resolveEnvFile(appEnv: AppEnv) {
  if (process.env.DOTENV_CONFIG_PATH) return process.env.DOTENV_CONFIG_PATH;
  if (appEnv === "production") return ".env.production";
  if (appEnv === "staging") return ".env.staging";
  if (appEnv === "test") return ".env.test";
  return ".env";
}

function loadEnvFile() {
  const appEnv = getAppEnv();
  const envFile = resolveEnvFile(appEnv);
  const envPath = path.resolve(process.cwd(), envFile);
  const mustExist = appEnv === "production" || appEnv === "staging" || Boolean(process.env.DOTENV_CONFIG_PATH);

  if (!fs.existsSync(envPath)) {
    if (mustExist) {
      throw new Error(`Required environment file is missing: ${envPath}`);
    }
    return { appEnv, envFile, envPath, loaded: false };
  }

  const result = dotenv.config({ path: envPath, override: mustExist, quiet: true });
  if (result.error) throw result.error;

  return { appEnv: getAppEnv(), envFile, envPath, loaded: true };
}

function requireValue(name: string, errors: string[]) {
  const value = process.env[name]?.trim();
  if (!value) errors.push(`${name} is required`);
  return value || "";
}

function getDatabaseName(databaseUrl: string) {
  try {
    return decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\/+/, ""));
  } catch {
    return "";
  }
}

function getHost(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function assertPair(publicName: string, secretName: string, errors: string[]) {
  const hasPublic = Boolean(process.env[publicName]?.trim());
  const hasSecret = Boolean(process.env[secretName]?.trim());
  if (hasPublic !== hasSecret) errors.push(`${publicName} and ${secretName} must be configured together`);
}

export function validateBackendEnv() {
  const errors: string[] = [];
  const appEnv = getAppEnv();
  const isDeployed = appEnv === "production" || appEnv === "staging";

  const nodeEnv = requireValue("NODE_ENV", errors);
  const port = requireValue("PORT", errors);
  const databaseUrl = requireValue("DATABASE_URL", errors);
  requireValue("JWT_SECRET", errors);
  requireValue("JWT_REFRESH_SECRET", errors);
  const frontendUrl = requireValue("FRONTEND_URL", errors);

  if (isDeployed) {
    requireValue("APP_ENV", errors);
    requireValue("AWS_REGION", errors);
    const bucket = requireValue("AWS_S3_BUCKET", errors);
    const expectedDatabaseName = requireValue("EXPECTED_DATABASE_NAME", errors);
    const expectedS3Bucket = requireValue("EXPECTED_S3_BUCKET", errors);
    const expectedFrontendHost = requireValue("EXPECTED_FRONTEND_HOST", errors);
    requireValue("SETTINGS_ENCRYPTION_KEY", errors);

    if (nodeEnv !== "production") errors.push("NODE_ENV must be production for deployed environments");

    const expectedPort = appEnv === "production" ? "3001" : "4001";
    if (port && port !== expectedPort) errors.push(`PORT must be ${expectedPort} for ${appEnv}`);

    const databaseName = getDatabaseName(databaseUrl);
    if (databaseName && expectedDatabaseName && databaseName !== expectedDatabaseName) {
      errors.push(`DATABASE_URL database must be ${expectedDatabaseName} for ${appEnv}`);
    }

    if (bucket && expectedS3Bucket && bucket !== expectedS3Bucket) {
      errors.push(`AWS_S3_BUCKET must match EXPECTED_S3_BUCKET for ${appEnv}`);
    }

    const frontendHost = getHost(frontendUrl);
    if (frontendHost && expectedFrontendHost && frontendHost !== expectedFrontendHost) {
      errors.push(`FRONTEND_URL host must be ${expectedFrontendHost} for ${appEnv}`);
    }

    for (const name of ["CUSTOMER_PASSWORD_RESET_URL", "STRIPE_SUCCESS_URL", "STRIPE_CANCEL_URL", "STORE_URL"]) {
      const value = process.env[name]?.trim();
      if (value && getHost(value) !== expectedFrontendHost) {
        errors.push(`${name} host must be ${expectedFrontendHost} for ${appEnv}`);
      }
    }
  }

  assertPair("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", errors);
  assertPair("STRIPE_PUBLISHABLE_KEY", "STRIPE_SECRET_KEY", errors);
  assertPair("SANDBOX_API_KEY", "SANDBOX_API_SECRET", errors);

  if (errors.length > 0) {
    throw new Error(`Environment validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    appEnv,
    nodeEnv,
    port,
    databaseName: getDatabaseName(databaseUrl),
    databaseHost: databaseUrl ? new URL(databaseUrl).hostname : "",
    awsRegion: process.env.AWS_REGION || "",
    s3Bucket: process.env.AWS_S3_BUCKET || "",
    frontendUrl,
    envFile: loadedEnv.envFile,
    envPath: loadedEnv.envPath,
    envLoaded: loadedEnv.loaded,
  };
}

export function printBackendEnvInfo() {
  const info = validateBackendEnv();
  console.log(JSON.stringify(info, null, 2));
}

export const envInfo = loadedEnv;

if (loadedEnv.appEnv === "production" || loadedEnv.appEnv === "staging") {
  validateBackendEnv();
}
