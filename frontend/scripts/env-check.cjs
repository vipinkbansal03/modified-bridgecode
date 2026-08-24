const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const appEnv = process.env.APP_ENV;
const envFile = process.env.DOTENV_CONFIG_PATH || (appEnv === "production" ? ".env.production" : appEnv === "staging" ? ".env.staging" : ".env.local");
const envPath = path.resolve(process.cwd(), envFile);

if (!fs.existsSync(envPath)) {
  throw new Error(`Required frontend environment file is missing: ${envPath}`);
}

dotenv.config({ path: envPath, override: true, quiet: true });

function required(name, errors) {
  const value = process.env[name] && process.env[name].trim();
  if (!value) errors.push(`${name} is required`);
  return value || "";
}

function host(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function validate() {
  const errors = [];
  const isDeployed = appEnv === "production" || appEnv === "staging";
  const backendUrl = required("BACKEND_URL", errors);
  const publicApiUrl = required("NEXT_PUBLIC_API_URL", errors);
  const apiBaseUrl = required("API_BASE_URL", errors);
  const siteUrl = required("NEXT_PUBLIC_SITE_URL", errors);

  if (isDeployed) {
    const backendHost = host(backendUrl);
    if (!backendHost) errors.push(`BACKEND_URL must be a valid URL for ${appEnv}`);
    if (host(publicApiUrl) !== backendHost) errors.push(`NEXT_PUBLIC_API_URL host must match BACKEND_URL host for ${appEnv}`);
    if (host(apiBaseUrl) !== backendHost) errors.push(`API_BASE_URL host must match BACKEND_URL host for ${appEnv}`);
    if (!host(siteUrl)) errors.push(`NEXT_PUBLIC_SITE_URL must be a valid URL for ${appEnv}`);
  }

  if (errors.length > 0) {
    throw new Error(`Frontend environment validation failed:\n- ${errors.join("\n- ")}`);
  }

  return {
    APP_ENV: appEnv || "development",
    envFile,
    BACKEND_URL_HOST: host(backendUrl),
    NEXT_PUBLIC_API_URL_HOST: host(publicApiUrl),
    API_BASE_URL_HOST: host(apiBaseUrl),
    NEXT_PUBLIC_SITE_URL_HOST: host(siteUrl),
  };
}

const info = validate();

if (process.argv[2] === "info") {
  console.log(JSON.stringify(info, null, 2));
} else {
  console.log("Frontend environment validation passed.");
}
