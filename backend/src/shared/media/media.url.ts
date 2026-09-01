import { getMediaConfig } from "./media.config";
import { AppError } from "../../utils/apiResponse";

/**
 * Resolves a stored database object key into an authoritative CloudFront CDN URL.
 * 
 * Rules:
 * - null/undefined/empty -> null
 * - Absolute HTTP(S)/Data URLs -> preserved unchanged for legacy data compatibility
 * - Relative object keys -> trimmed of leading slashes and prefixed with MEDIA_CDN_URL
 * - Missing CDN configuration in deployed environments -> throws controlled AppError
 */
export function getMediaUrl(key: string | null | undefined): string | null {
  if (key === null || key === undefined) {
    return null;
  }

  const trimmed = key.trim();
  if (!trimmed) {
    return null;
  }

  // Preserve absolute URLs and data URIs for backward compatibility
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  const { cdnUrl, appEnv } = getMediaConfig();
  const normalizedKey = trimmed.replace(/^\/+/, "");

  if (cdnUrl) {
    return `${cdnUrl}/${normalizedKey}`;
  }

  // In deployed production or staging, missing MEDIA_CDN_URL is a critical configuration error
  if (appEnv === "production" || appEnv === "staging") {
    throw new AppError(`MEDIA_CDN_URL is not configured for ${appEnv} environment.`, 500);
  }

  // Development / test fallback when CDN URL is not locally configured
  return `/${normalizedKey}`;
}

/**
 * Resolves a preferred variant URL from a multi-variant dictionary.
 * Falls back to available variants if the preferred variant is not present.
 */
export function getVariantMediaUrl(
  variants: Record<string, string> | null | undefined,
  preferredVariant = "medium"
): string | null {
  if (!variants || typeof variants !== "object") {
    return null;
  }

  const key = variants[preferredVariant] || Object.values(variants)[0];
  return getMediaUrl(key);
}
