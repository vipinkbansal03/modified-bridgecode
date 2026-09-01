import { S3Client } from "@aws-sdk/client-s3";
import { getMediaConfig } from "./media.config";

let cachedS3Client: S3Client | null = null;

/**
 * Returns a centralized S3Client singleton using the default AWS credential provider chain.
 * Configured with the authoritative region (defaults to eu-central-1).
 */
export function getS3Client(): S3Client {
  if (!cachedS3Client) {
    const config = getMediaConfig();
    cachedS3Client = new S3Client({
      region: config.region,
    });
  }
  return cachedS3Client;
}

/**
 * Direct export of the S3Client singleton.
 */
export const s3Client = getS3Client();
