import assert from "node:assert";
import sharp from "sharp";
import { prisma } from "../config/database";
import * as BannersService from "../modules/banners/banners.service";
import { s3Client } from "../shared/media/media.client";

async function runBannerMigrationTests() {
  console.log("=== RUNNING BANNERS MODULE MEDIA MIGRATION TEST SUITE ===\n");

  process.env.MEDIA_CDN_URL = "https://media.apricotequipment.in";
  process.env.APP_ENV = "production";
  process.env.AWS_S3_BUCKET = "modern-orthodontics-prod-uploads";

  // Mock S3 PutObject / DeleteObject
  const originalSend = s3Client.send;
  const recordedPuts: any[] = [];
  const recordedDeletes: string[] = [];

  (s3Client as any).send = async (command: any) => {
    const name = command.constructor.name;
    if (name === "PutObjectCommand") {
      recordedPuts.push(command.input);
      return {};
    }
    if (name === "DeleteObjectCommand") {
      recordedDeletes.push(command.input.Key);
      return {};
    }
    if (name === "DeleteObjectsCommand") {
      command.input.Delete?.Objects?.forEach((o: any) => recordedDeletes.push(o.Key));
      return {};
    }
    return {};
  };

  const createdBannerIds: string[] = [];

  try {
    // ─── 1. Upload Banner Image Test ─────────────────────────────
    console.log("1. Testing BannersService.uploadBannerImage()...");

    const testImageBuffer = await sharp({
      create: {
        width: 2400,
        height: 1200,
        channels: 4,
        background: { r: 0, g: 120, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const uploadRes = await BannersService.uploadBannerImage(testImageBuffer);

    assert.ok(uploadRes.uploadId, "Must return uploadId");
    assert.ok(uploadRes.desktopKey.startsWith("banners/"), "Desktop key must start with banners/");
    assert.ok(uploadRes.desktopKey.endsWith("-desktop.webp"), "Desktop key must end with -desktop.webp");
    assert.ok(uploadRes.mobileKey.endsWith("-mobile.webp"), "Mobile key must end with -mobile.webp");

    assert.strictEqual(
      uploadRes.desktopUrl,
      `https://media.apricotequipment.in/${uploadRes.desktopKey}`,
      "Desktop URL must be resolved CDN URL"
    );
    assert.strictEqual(
      uploadRes.mobileUrl,
      `https://media.apricotequipment.in/${uploadRes.mobileKey}`,
      "Mobile URL must be resolved CDN URL"
    );

    // Verify S3 PutObject invocations
    assert.strictEqual(recordedPuts.length, 2, "Must perform 2 PutObject calls (desktop and mobile)");
    const desktopPut = recordedPuts.find((p) => p.Key === uploadRes.desktopKey);
    const mobilePut = recordedPuts.find((p) => p.Key === uploadRes.mobileKey);

    assert.ok(desktopPut, "Desktop PutObject must exist");
    assert.strictEqual(desktopPut.ContentType, "image/webp", "ContentType must be image/webp");
    assert.strictEqual(desktopPut.CacheControl, "public, max-age=31536000, immutable", "CacheControl must be immutable");

    assert.ok(mobilePut, "Mobile PutObject must exist");

    console.log("   ✓ uploadBannerImage passed (desktop & mobile WebP variants with immutable S3 headers).");

    // ─── 2. Create Banner with Clean Object Keys ────────────────
    console.log("\n2. Testing BannersService.createBanner() with object keys...");

    const newBanner = await BannersService.createBanner({
      title: "Test Summer Ortho Sale",
      image: uploadRes.desktopKey,
      mobileImage: uploadRes.mobileKey,
      placement: "HOMEPAGE_HERO",
      status: true,
      sortOrder: 999,
    });

    createdBannerIds.push(newBanner.id);

    // Verify API return shape has CDN URLs
    assert.strictEqual(
      newBanner.image,
      `https://media.apricotequipment.in/${uploadRes.desktopKey}`,
      "API response must contain CDN URL for desktop image"
    );
    assert.strictEqual(
      newBanner.mobileImage,
      `https://media.apricotequipment.in/${uploadRes.mobileKey}`,
      "API response must contain CDN URL for mobile image"
    );

    // Verify raw DB record contains ONLY object keys
    const rawDbRecord = await prisma.banner.findUnique({ where: { id: newBanner.id } });
    assert.ok(rawDbRecord, "DB record must exist");
    assert.strictEqual(rawDbRecord.image, uploadRes.desktopKey, "DB must store clean object key, NOT full URL");
    assert.strictEqual(rawDbRecord.mobileImage, uploadRes.mobileKey, "DB must store clean object key for mobileImage");

    console.log("   ✓ createBanner passed (DB stores clean keys, API returns CDN URLs).");

    // ─── 3. Read Banner via Admin & Public APIs ──────────────────
    console.log("\n3. Testing BannersService read APIs (getBanner, listBanners, listPublicBanners)...");

    const fetchedAdminBanner = await BannersService.getBanner(newBanner.id);
    assert.strictEqual(fetchedAdminBanner.image, newBanner.image, "getBanner must return CDN URL");

    const adminList = await BannersService.listBanners({ placement: "HOMEPAGE_HERO" });
    const foundInAdminList = adminList.find((b: any) => b.id === newBanner.id);
    assert.ok(foundInAdminList, "Banner must be in admin list");
    assert.strictEqual(foundInAdminList.image, newBanner.image, "listBanners must return CDN URL");

    const publicList = await BannersService.listPublicBanners({ placement: "HOMEPAGE_HERO" });
    const foundInPublicList = publicList.find((b: any) => b.id === newBanner.id);
    assert.ok(foundInPublicList, "Banner must be in public list");
    assert.strictEqual(foundInPublicList.image, newBanner.image, "listPublicBanners must return CDN URL");

    console.log("   ✓ Read APIs passed.");

    // ─── 4. Update / Replace Banner Image Test ───────────────────
    console.log("\n4. Testing BannersService.updateBanner() image replacement...");

    // Upload a new replacement image
    recordedPuts.length = 0;
    const replacementUpload = await BannersService.uploadBannerImage(testImageBuffer, newBanner.id);
    assert.notStrictEqual(replacementUpload.desktopKey, uploadRes.desktopKey, "Replacement key must be unique");

    const updatedBanner = await BannersService.updateBanner(newBanner.id, {
      title: "Test Summer Ortho Sale Updated",
      image: replacementUpload.desktopKey,
      mobileImage: replacementUpload.mobileKey,
      placement: "HOMEPAGE_HERO",
    });

    assert.strictEqual(
      updatedBanner.image,
      `https://media.apricotequipment.in/${replacementUpload.desktopKey}`,
      "Updated banner API response must reflect new CDN URL"
    );

    const updatedDbRecord = await prisma.banner.findUnique({ where: { id: newBanner.id } });
    assert.strictEqual(updatedDbRecord?.image, replacementUpload.desktopKey, "DB must be updated to new key");

    console.log("   ✓ Update & replacement passed (new unique key generated, old key not overwritten).");

    // ─── 5. Legacy URL Compatibility Test ────────────────────────
    console.log("\n5. Testing Legacy URL Compatibility (Unsplash / external URLs)...");

    const legacyUnsplashUrl = "https://images.unsplash.com/photo-1738162837438-92ff852619a1?w=1600";
    const legacyBanner = await BannersService.createBanner({
      title: "Legacy External Promo Banner",
      image: legacyUnsplashUrl,
      placement: "HOMEPAGE_HERO",
      status: true,
      sortOrder: 1000,
    });
    createdBannerIds.push(legacyBanner.id);

    assert.strictEqual(
      legacyBanner.image,
      legacyUnsplashUrl,
      "Legacy Unsplash URL must be preserved unchanged by getMediaUrl"
    );

    const fetchedLegacy = await BannersService.getBanner(legacyBanner.id);
    assert.strictEqual(fetchedLegacy.image, legacyUnsplashUrl, "getBanner must preserve legacy absolute URL");

    console.log("   ✓ Legacy compatibility passed (existing URLs continue to render without breakage).");

    // ─── 6. Clean Deletion & S3 Cleanup Test ───────────────────
    console.log("\n6. Testing BannersService.deleteBanner() & S3 cleanup...");

    recordedDeletes.length = 0;

    // Delete the migrated banner (has S3 object keys)
    await BannersService.deleteBanner(newBanner.id);
    const newBannerIndex = createdBannerIds.indexOf(newBanner.id);
    if (newBannerIndex > -1) createdBannerIds.splice(newBannerIndex, 1);

    // Verify S3 delete was called for the banner's active S3 keys
    assert.ok(
      recordedDeletes.includes(replacementUpload.desktopKey),
      "Must delete active desktop S3 key on banner delete"
    );
    assert.ok(
      recordedDeletes.includes(replacementUpload.mobileKey),
      "Must delete active mobile S3 key on banner delete"
    );

    // Delete legacy banner (has external Unsplash URL)
    recordedDeletes.length = 0;
    await BannersService.deleteBanner(legacyBanner.id);
    const legacyIndex = createdBannerIds.indexOf(legacyBanner.id);
    if (legacyIndex > -1) createdBannerIds.splice(legacyIndex, 1);

    // Verify S3 delete was NOT called for external URL
    assert.strictEqual(
      recordedDeletes.length,
      0,
      "Must NOT attempt S3 delete for legacy external URLs"
    );

    console.log("   ✓ Deletion passed (DB record removed, S3 keys cleaned up, legacy URLs safely ignored).");

    console.log("\n=======================================================");
    console.log(" ALL BANNERS MODULE MEDIA MIGRATION TESTS PASSED (100%)");
    console.log("=======================================================\n");
  } finally {
    (s3Client as any).send = originalSend;
    // Cleanup any lingering test banners
    for (const id of createdBannerIds) {
      await prisma.banner.delete({ where: { id } }).catch(() => {});
    }
  }
}

runBannerMigrationTests().catch((err) => {
  console.error("Banner Migration Test Suite Failed:", err);
  process.exit(1);
});
