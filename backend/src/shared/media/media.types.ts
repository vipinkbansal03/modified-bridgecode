export interface ImagePresetVariant {
  width: number;
  height?: number;
  quality: number;
  fit?: "inside" | "cover" | "contain" | "fill";
}

export type ImagePresetDefinition = Record<string, ImagePresetVariant>;

export interface ImageValidationOptions {
  maxSizeBytes?: number;
  maxWidth?: number;
  maxHeight?: number;
  allowedFormats?: string[];
}

export interface ImageMetadataInfo {
  format: string;
  width: number;
  height: number;
  size: number;
}

export interface ProcessedVariantBuffer {
  variantName: string;
  buffer: Buffer;
  width: number;
  height: number;
  format: "webp";
  size: number;
}

export interface UploadImageOptions {
  buffer: Buffer;
  folder: string;
  presetName?: string;
  customPreset?: ImagePresetDefinition;
  entityId?: string;
}

export interface MediaUploadResult {
  uploadId: string;
  folder: string;
  variants: Record<string, string>; // Maps variantName -> S3 object key
  primaryKey: string;              // The main/largest or default variant key
  primaryUrl: string;              // Resolved CDN URL for primary variant
}
