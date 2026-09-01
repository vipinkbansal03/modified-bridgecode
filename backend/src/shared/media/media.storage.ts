import { PutObjectCommand, DeleteObjectsCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { getS3Client } from "./media.client";
import { getMediaConfig } from "./media.config";
import { ProcessedVariantBuffer } from "./media.types";
import { AppError } from "../../utils/apiResponse";
import { logger } from "../../config/logger";

const IMMUTABLE_CACHE_CONTROL = "public, max-age=31536000, immutable";

/**
 * Constructs a unique, versioned S3 object key.
 */
export function buildObjectKey(
  folder: string,
  uploadId: string,
  variantName: string,
  entityId?: string,
  ext = "webp"
): string {
  const cleanFolder = folder.replace(/^\/+|\/+$/g, "");
  const baseName = `${uploadId}-${variantName}.${ext}`;

  if (entityId) {
    const cleanEntityId = entityId.replace(/^\/+|\/+$/g, "");
    return `${cleanFolder}/${cleanEntityId}/${baseName}`;
  }

  return `${cleanFolder}/${baseName}`;
}

/**
 * Uploads an array of processed WebP variant buffers to S3 with immutable caching.
 * Performs best-effort rollback deletion if any variant upload fails during batching.
 */
export async function uploadOptimizedVariants(
  variants: ProcessedVariantBuffer[],
  folder: string,
  entityId?: string
): Promise<{ uploadId: string; variants: Record<string, string>; primaryKey: string }> {
  const config = getMediaConfig();
  const s3 = getS3Client();
  const uploadId = randomUUID();

  const keyMap: Record<string, string> = {};
  const uploadedKeys: string[] = [];

  try {
    for (const variant of variants) {
      const key = buildObjectKey(folder, uploadId, variant.variantName, entityId, "webp");

      await s3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: variant.buffer,
          ContentType: "image/webp",
          CacheControl: IMMUTABLE_CACHE_CONTROL,
        })
      );

      uploadedKeys.push(key);
      keyMap[variant.variantName] = key;
    }

    // Determine the primary key (prefer medium or large or desktop, otherwise first available)
    const primaryKey =
      keyMap.medium || keyMap.large || keyMap.desktop || Object.values(keyMap)[0] || "";

    return {
      uploadId,
      variants: keyMap,
      primaryKey,
    };
  } catch (error) {
    logger.error("Failed to upload image variants to S3, initiating rollback cleanup", {
      uploadId,
      uploadedKeys,
      error,
    });

    if (uploadedKeys.length > 0) {
      await deleteStoredObjects(uploadedKeys).catch((cleanupError) => {
        logger.error("Rollback cleanup failed for keys", { uploadedKeys, cleanupError });
      });
    }

    throw new AppError("Failed to upload optimized image variants to storage.", 500);
  }
}

/**
 * Deletes one or more S3 objects with best-effort error handling.
 */
export async function deleteStoredObjects(keys: string[]): Promise<void> {
  if (!keys || keys.length === 0) {
    return;
  }

  const validKeys = keys.filter((k) => typeof k === "string" && k.trim().length > 0);
  if (validKeys.length === 0) {
    return;
  }

  const config = getMediaConfig();
  const s3 = getS3Client();

  if (validKeys.length === 1) {
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: config.bucket,
          Key: validKeys[0],
        })
      );
    } catch (error) {
      logger.warn(`Failed to delete S3 object: ${validKeys[0]}`, { error });
    }
    return;
  }

  try {
    await s3.send(
      new DeleteObjectsCommand({
        Bucket: config.bucket,
        Delete: {
          Objects: validKeys.map((Key) => ({ Key })),
          Quiet: true,
        },
      })
    );
  } catch (error) {
    logger.warn("Failed to batch delete S3 objects", { keys: validKeys, error });
  }
}
