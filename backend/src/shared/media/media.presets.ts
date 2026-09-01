import { ImagePresetDefinition } from "./media.types";

/**
 * UI-targeted image optimization presets defined in the Modern Orthodontics Media Architecture Guide.
 * 
 * Each variant specifies target bounding width, WebP encoding quality, and resize fit mode.
 */
export const IMAGE_PRESETS: Record<string, ImagePresetDefinition> = {
  product: {
    thumbnail: { width: 320, quality: 75, fit: "inside" },
    medium: { width: 800, quality: 80, fit: "inside" },
    large: { width: 1600, quality: 82, fit: "inside" },
  },
  banner: {
    mobile: { width: 900, quality: 80, fit: "inside" },
    desktop: { width: 1920, quality: 82, fit: "inside" },
  },
  profile: {
    thumbnail: { width: 160, height: 160, quality: 75, fit: "cover" },
    medium: { width: 500, height: 500, quality: 80, fit: "cover" },
  },
  category: {
    thumbnail: { width: 320, quality: 75, fit: "inside" },
    medium: { width: 800, quality: 80, fit: "inside" },
  },
  blog: {
    thumbnail: { width: 320, quality: 75, fit: "inside" },
    medium: { width: 800, quality: 80, fit: "inside" },
    large: { width: 1600, quality: 82, fit: "inside" },
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
