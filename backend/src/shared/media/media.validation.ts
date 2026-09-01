import sharp, { Metadata } from "sharp";
import { AppError } from "../../utils/apiResponse";
import { ImageMetadataInfo, ImageValidationOptions } from "./media.types";

const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const DEFAULT_MAX_DIMENSION = 8000; // 8000 px max width/height to prevent decompression bombs
const DEFAULT_ALLOWED_FORMATS = ["jpeg", "jpg", "png", "webp", "avif", "tiff", "heif"];

/**
 * Validates an input image buffer before performing expensive transformations.
 * Inspects byte size, image format, and decoded pixel dimensions.
 */
export async function validateImageBuffer(
  buffer: Buffer,
  options?: ImageValidationOptions
): Promise<ImageMetadataInfo> {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new AppError("Invalid or empty image file buffer.", 400);
  }

  const maxSizeBytes = options?.maxSizeBytes ?? DEFAULT_MAX_SIZE_BYTES;
  if (buffer.length > maxSizeBytes) {
    const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
    throw new AppError(`Image file size (${(buffer.length / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum limit of ${maxMb}MB.`, 400);
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(buffer).metadata();
  } catch (error) {
    throw new AppError("Failed to decode image metadata. File may be corrupted or not a valid image.", 400);
  }

  const format = (metadata.format || "").toLowerCase();
  const allowedFormats = options?.allowedFormats ?? DEFAULT_ALLOWED_FORMATS;
  if (!format || !allowedFormats.includes(format)) {
    throw new AppError(
      `Unsupported image format "${format || "unknown"}". Allowed formats: ${allowedFormats.join(", ").toUpperCase()}.`,
      400
    );
  }

  const maxWidth = options?.maxWidth ?? DEFAULT_MAX_DIMENSION;
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_DIMENSION;
  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width <= 0 || height <= 0) {
    throw new AppError("Invalid image dimensions detected.", 400);
  }

  if (width > maxWidth || height > maxHeight) {
    throw new AppError(
      `Image dimensions (${width}x${height}px) exceed the maximum permitted bounds (${maxWidth}x${maxHeight}px).`,
      400
    );
  }

  return {
    format,
    width,
    height,
    size: buffer.length,
  };
}
