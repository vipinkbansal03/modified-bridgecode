import { AppError } from "../../utils/apiResponse";

export interface MediaConfig {
  region: string;
  bucket: string;
  cdnUrl: string;
  appEnv: string;
}

const DEFAULT_REGION = "eu-central-1";

/**
 * Returns the active media infrastructure configuration from environment variables.
 */
export function getMediaConfig(): MediaConfig {
  const appEnv = process.env.APP_ENV || process.env.NODE_ENV || "development";
  const region = process.env.AWS_REGION || DEFAULT_REGION;
  const bucket = process.env.AWS_S3_BUCKET || "";
  const cdnUrl = (process.env.MEDIA_CDN_URL || "").trim().replace(/\/+$/, "");

  return {
    region,
    bucket,
    cdnUrl,
    appEnv,
  };
}

/**
 * Validates media environment configuration.
 * Enforces production and staging infrastructure invariants to prevent cross-environment pollution.
 */
export function validateMediaConfig(): MediaConfig {
  const config = getMediaConfig();
  const isDeployed = config.appEnv === "production" || config.appEnv === "staging";

  if (isDeployed) {
    if (!config.bucket) {
      throw new AppError(`AWS_S3_BUCKET is required for ${config.appEnv} environment.`, 500);
    }
    if (!config.cdnUrl) {
      throw new AppError(`MEDIA_CDN_URL is required for ${config.appEnv} environment.`, 500);
    }

    if (config.appEnv === "production" && config.cdnUrl.includes("staging")) {
      throw new AppError("Production MEDIA_CDN_URL cannot point to staging CDN.", 500);
    }

    if (config.appEnv === "staging" && !config.cdnUrl.includes("staging") && !config.cdnUrl.includes("localhost")) {
      throw new AppError("Staging MEDIA_CDN_URL must not point to production CDN.", 500);
    }
  }

  return config;
}
