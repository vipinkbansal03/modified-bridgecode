import { ImagePresetDefinition } from "./media.types";

/**
 * UI-targeted image optimization presets defined in the Modern Orthodontics Media Architecture Guide.
 * 
 * Each variant specifies target bounding width, WebP encoding quality, and resize fit mode.
 */
export const IMAGE_PRESETS: Record<string, ImagePresetDefinition> = {
  product: {
    medium: { width: 800, quality: 80, fit: "inside" },
  },
  banner: {
    mobile: { width: 900, quality: 80, fit: "inside" },
    desktop: { width: 1920, quality: 82, fit: "inside" },
  },
  profile: {
    medium: { width: 500, height: 500, quality: 80, fit: "cover" },
  },
  category: {
    medium: { width: 800, quality: 80, fit: "inside" },
  },
  blog: {
    medium: { width: 800, quality: 80, fit: "inside" },
  },
  adminThumbnail: {
    thumbnail: { width: 320, quality: 75, fit: "inside" },
  },
};

/**
 * Resolves a preset definition by name, falling back to 'product' if unrecognized.
 */
export function getPreset(presetName = "product"): ImagePresetDefinition {
  const preset = IMAGE_PRESETS[presetName];
  if (!preset) {
    return IMAGE_PRESETS.product;
  }
  return preset;
}
