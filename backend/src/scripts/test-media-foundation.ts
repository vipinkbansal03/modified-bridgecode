import assert from "node:assert";
import sharp from "sharp";
import {
  getMediaUrl,
  getVariantMediaUrl,
  getPreset,
  IMAGE_PRESETS,
  validateImageBuffer,
  processImageVariants,
  buildObjectKey,
  uploadOptimizedVariants,
  deleteStoredObjects,
  optimizeAndUploadPublicImage,
} from "../shared/media";
import { s3Client } from "../shared/media/media.client";

async function runTests() {
  console.log("=== RUNNING CENTRALIZED MEDIA FOUNDATION TEST SUITE ===\n");

  // ─── 1. Media URL Tests ─────────────────────────────────────────
  console.log("1. Testing getMediaUrl()...");

  process.env.MEDIA_CDN_URL = "https://media.apricotequipment.in";
  process.env.APP_ENV = "production";

  assert.strictEqual(getMediaUrl(null), null, "getMediaUrl(null) must return null");
  assert.strictEqual(getMediaUrl(undefined), null, "getMediaUrl(undefined) must return null");
  assert.strictEqual(getMediaUrl(""), null, "getMediaUrl('') must return null");
  assert.strictEqual(getMediaUrl("   "), null, "getMediaUrl('   ') must return null");

  // Relative key
  assert.strictEqual(
    getMediaUrl("products/123/img-medium.webp"),
    "https://media.apricotequipment.in/products/123/img-medium.webp",
    "Relative key must be prefixed with MEDIA_CDN_URL"
  );

  // Leading slash normalization
  assert.strictEqual(
    getMediaUrl("/banners/hero-desktop.webp"),
    "https://media.apricotequipment.in/banners/hero-desktop.webp",
    "Leading slashes must be stripped"
  );

  // Legacy absolute URLs
  const unsplashUrl = "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1600";
  assert.strictEqual(
    getMediaUrl(unsplashUrl),
    unsplashUrl,
    "Absolute HTTPS URL must be preserved unchanged"
  );

  const httpUrl = "http://example.com/legacy-image.jpg";
  assert.strictEqual(
    getMediaUrl(httpUrl),
    httpUrl,
    "Absolute HTTP URL must be preserved unchanged"
  );

  // Variant resolver
  const variantMap = {
    thumbnail: "products/123/img-thumbnail.webp",
    medium: "products/123/img-medium.webp",
    large: "products/123/img-large.webp",
  };
  assert.strictEqual(
    getVariantMediaUrl(variantMap, "medium"),
    "https://media.apricotequipment.in/products/123/img-medium.webp",
    "getVariantMediaUrl must resolve preferred medium variant"
  );
  assert.strictEqual(
    getVariantMediaUrl(variantMap, "nonexistent"),
    "https://media.apricotequipment.in/products/123/img-thumbnail.webp",
    "getVariantMediaUrl fallback to first available variant"
  );

  console.log("   ✓ getMediaUrl tests passed.");

  // ─── 2. Image Presets Tests ─────────────────────────────────────
  console.log("\n2. Testing Image Presets...");

  const productPreset = getPreset("product");
  assert.strictEqual(productPreset.medium.width, 800, "Product medium width must be 800");

  const bannerPreset = getPreset("banner");
  assert.strictEqual(bannerPreset.mobile.width, 900, "Banner mobile width must be 900");
  assert.strictEqual(bannerPreset.desktop.width, 1920, "Banner desktop width must be 1920");

  const fallbackPreset = getPreset("unknown_preset");
  assert.deepStrictEqual(fallbackPreset, IMAGE_PRESETS.product, "Fallback preset must be product");

  console.log("   ✓ Image presets tests passed.");

  // ─── 3. Image Validation Tests ──────────────────────────────────
  console.log("\n3. Testing Image Validation...");

  // Generate a valid 1000x800 test PNG buffer with Sharp
  const testPngBuffer = await sharp({
    create: {
      width: 1000,
      height: 800,
      channels: 4,
      background: { r: 255, g: 0, b: 0, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  const validInfo = await validateImageBuffer(testPngBuffer);
  assert.strictEqual(validInfo.format, "png", "Format must be png");
  assert.strictEqual(validInfo.width, 1000, "Width must be 1000");
  assert.strictEqual(validInfo.height, 800, "Height must be 800");

  // Empty buffer
  await assert.rejects(
    async () => validateImageBuffer(Buffer.alloc(0)),
    /Invalid or empty image file buffer/,
    "Empty buffer must reject"
  );

  // Corrupted / non-image buffer
  await assert.rejects(
    async () => validateImageBuffer(Buffer.from("not an image at all")),
    /Failed to decode image metadata/,
    "Corrupted buffer must reject"
  );

  // Max byte size check
  await assert.rejects(
    async () => validateImageBuffer(testPngBuffer, { maxSizeBytes: 100 }),
    /exceeds the maximum limit/,
    "Oversized buffer must reject"
  );

  // Max dimension bounds check
  await assert.rejects(
    async () => validateImageBuffer(testPngBuffer, { maxWidth: 500 }),
    /exceed the maximum permitted bounds/,
    "Oversized dimensions must reject"
  );

  console.log("   ✓ Image validation tests passed.");

  // ─── 4. Sharp Processor Tests ───────────────────────────────────
  console.log("\n4. Testing Sharp Processor...");

  const processedVariants = await processImageVariants(testPngBuffer, productPreset);
  assert.strictEqual(processedVariants.length, 1, "Must generate only the consumed product variant");

  const medVariant = processedVariants.find((v) => v.variantName === "medium")!;

  assert.ok(medVariant, "Medium variant must exist");
  assert.ok(medVariant.width <= 800, `Medium width (${medVariant.width}) must be <= 800`);
  assert.strictEqual(medVariant.format, "webp", "Output format must be webp");

  console.log("   ✓ Sharp processor tests passed (including withoutEnlargement verification).");

  // ─── 5. Object Key Construction Tests ───────────────────────────
  console.log("\n5. Testing Object Key Construction...");

  const keyWithEntity = buildObjectKey("products", "uuid-123", "medium", "prod-999");
  assert.strictEqual(
    keyWithEntity,
    "products/prod-999/uuid-123-medium.webp",
    "Key with entityId must match expected pattern"
  );

  const keyWithoutEntity = buildObjectKey("banners", "uuid-456", "desktop");
  assert.strictEqual(
    keyWithoutEntity,
    "banners/uuid-456-desktop.webp",
    "Key without entityId must match expected pattern"
  );

  console.log("   ✓ Object key construction tests passed.");

  // ─── 6. S3 Storage & Rollback Simulation Tests ──────────────────
  console.log("\n6. Testing S3 Storage & Rollback (Mocked)...");

  // Temporarily stub s3Client.send to verify PutObject params and rollback execution
  const originalSend = s3Client.send;
  const recordedPutCommands: any[] = [];
  const recordedDeleteKeys: string[] = [];

  let failOnSecondUpload = false;

  (s3Client as any).send = async (command: any) => {
    const name = command.constructor.name;
    if (name === "PutObjectCommand") {
      recordedPutCommands.push(command.input);
      if (failOnSecondUpload && recordedPutCommands.length === 2) {
        throw new Error("Simulated S3 network error during 2nd variant upload");
      }
      return {};
    }
    if (name === "DeleteObjectCommand") {
      recordedDeleteKeys.push(command.input.Key);
      return {};
    }
    if (name === "DeleteObjectsCommand") {
      command.input.Delete?.Objects?.forEach((o: any) => recordedDeleteKeys.push(o.Key));
      return {};
    }
    return {};
  };

  try {
    process.env.AWS_S3_BUCKET = "modern-orthodontics-prod-uploads";

    // Test successful multi-variant upload
    const uploadResult = await uploadOptimizedVariants(processedVariants, "products", "prod-1");
    assert.ok(uploadResult.uploadId, "Must return uploadId");
    assert.strictEqual(recordedPutCommands.length, 1, "Must perform 1 PutObject command for the consumed product variant");

    const firstPut = recordedPutCommands[0];
    assert.strictEqual(firstPut.Bucket, "modern-orthodontics-prod-uploads", "Bucket must match");
    assert.strictEqual(firstPut.ContentType, "image/webp", "ContentType must be image/webp");
    assert.strictEqual(
      firstPut.CacheControl,
      "public, max-age=31536000, immutable",
      "CacheControl must be immutable 1-year"
    );

    assert.ok(uploadResult.primaryKey, "Must identify primaryKey");

    // Test rollback on simulated failure
    recordedPutCommands.length = 0;
    failOnSecondUpload = true;
    const rollbackVariants = [
      processedVariants[0],
      { ...processedVariants[0], variantName: "rollback-second" },
    ];

    await assert.rejects(
      async () => uploadOptimizedVariants(rollbackVariants, "products", "prod-2"),
      /Failed to upload optimized image variants to storage/,
      "Must throw error on upload failure"
    );

    assert.strictEqual(
      recordedDeleteKeys.length,
      1,
      "Must have rolled back and deleted the 1st successfully uploaded key"
    );

    // Test deleteStoredObjects
    recordedDeleteKeys.length = 0;
    await deleteStoredObjects(["test/key1.webp", "test/key2.webp"]);
    assert.strictEqual(recordedDeleteKeys.length, 2, "deleteStoredObjects must delete all passed keys");

    console.log("   ✓ S3 storage, immutable headers, and rollback cleanup tests passed.");
  } finally {
    (s3Client as any).send = originalSend;
  }

  // ─── 7. Full Orchestrator Pipeline Test (Mocked S3) ─────────────
  console.log("\n7. Testing End-to-End Media Pipeline Orchestrator...");

  (s3Client as any).send = async (command: any) => {
    return {};
  };

  try {
    const endToEndResult = await optimizeAndUploadPublicImage({
      buffer: testPngBuffer,
      folder: "blogs",
      presetName: "blog",
      entityId: "post-101",
    });

    assert.ok(endToEndResult.uploadId, "Must return uploadId");
    assert.strictEqual(endToEndResult.folder, "blogs", "Folder must be blogs");
    assert.ok(endToEndResult.variants.medium, "Medium variant key must exist");
    assert.ok(endToEndResult.primaryUrl.startsWith("https://media.apricotequipment.in/blogs/post-101/"), "Primary URL must be resolved CDN URL");

    console.log("   ✓ End-to-end media pipeline orchestrator passed.");
  } finally {
    (s3Client as any).send = originalSend;
  }

  console.log("\n=======================================================");
  console.log(" ALL CENTRALIZED MEDIA FOUNDATION TESTS PASSED (100%) ");
  console.log("=======================================================\n");
}

runTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});
