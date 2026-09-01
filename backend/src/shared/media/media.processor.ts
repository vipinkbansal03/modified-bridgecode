import sharp, { ResizeOptions, WebpOptions } from "sharp";
import { ImagePresetDefinition, ProcessedVariantBuffer } from "./media.types";

/**
 * Optimizes an input image buffer into WebP variants according to the specified preset.
 * 
 * Invariants enforced:
 * - Applies EXIF rotation (.rotate())
 * - Never upscales smaller images (withoutEnlargement: true)
 * - Fits within target dimensions using preset fit mode ('inside' / 'cover')
 * - Compresses to WebP using preset quality target
 * - Strips EXIF metadata to minimize byte weight and protect customer privacy
 */
export async function processImageVariants(
  buffer: Buffer,
  preset: ImagePresetDefinition
): Promise<ProcessedVariantBuffer[]> {
  const basePipeline = sharp(buffer, { failOn: "none" }).rotate();

  const variantEntries = Object.entries(preset);
  const processedVariants = await Promise.all(
    variantEntries.map(async ([variantName, variantConfig]) => {
      const resizeOptions: ResizeOptions = {
        width: variantConfig.width,
        height: variantConfig.height,
        fit: variantConfig.fit || "inside",
        withoutEnlargement: true,
      };

      const webpOptions: WebpOptions = {
        quality: variantConfig.quality,
        alphaQuality: 90,
        effort: 4,
      };

      const { data, info } = await basePipeline
        .clone()
        .resize(resizeOptions)
        .webp(webpOptions)
        .toBuffer({ resolveWithObject: true });

      const result: ProcessedVariantBuffer = {
        variantName,
        buffer: data,
        width: info.width,
        height: info.height,
        format: "webp",
        size: info.size,
      };

      return result;
    })
  );

  return processedVariants;
}
