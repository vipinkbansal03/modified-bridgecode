import { validateImageBuffer } from "./media.validation";
import { getPreset } from "./media.presets";
import { processImageVariants } from "./media.processor";
import { uploadOptimizedVariants, deleteStoredObjects } from "./media.storage";
import { getMediaUrl } from "./media.url";
import { MediaUploadResult, UploadImageOptions } from "./media.types";

/**
 * Orchestrates the full public media pipeline:
 * 1. Validates input buffer format, dimensions, and byte size
 * 2. Resolves target preset variants
 * 3. Processes Sharp WebP transformations
 * 4. Stores variants in S3 with immutable headers and rollback protection
 * 5. Resolves primary CDN URL
 */
export async function optimizeAndUploadPublicImage(
  options: UploadImageOptions
): Promise<MediaUploadResult> {
  // 1. Validation
  await validateImageBuffer(options.buffer);

  // 2. Preset resolution
  const preset = options.customPreset || getPreset(options.presetName);

  // 3. Sharp processing
  const processedVariants = await processImageVariants(options.buffer, preset);

  // 4. S3 storage upload with rollback
  const uploadResult = await uploadOptimizedVariants(
    processedVariants,
    options.folder,
    options.entityId
  );

  // 5. CDN URL resolution
  const primaryUrl = getMediaUrl(uploadResult.primaryKey) || "";

  return {
    uploadId: uploadResult.uploadId,
    folder: options.folder,
    variants: uploadResult.variants,
    primaryKey: uploadResult.primaryKey,
    primaryUrl,
  };
}

/**
 * Deletes public media variants from S3 storage.
 */
export async function deletePublicMediaVariants(
  variantKeys: string[] | Record<string, string>
): Promise<void> {
  const keys = Array.isArray(variantKeys) ? variantKeys : Object.values(variantKeys);
  await deleteStoredObjects(keys);
}
