import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import { StorageProvider } from "@prisma/client";
import fs from "fs";
import { deletePublicMediaVariants, getMediaUrl, getPreset, optimizeAndUploadPublicImage } from "../../shared/media";

export async function listMedia(query: {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  entityType?: string;
  entityId?: string;
  purpose?: string;
  uncategorized?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: any = {};
  
  if (query.uncategorized === "true" || query.entityType === "UNCATEGORIZED") {
    where.entityType = null;
  } else if (query.entityType && query.entityType !== "ALL") {
    where.entityType = query.entityType;
    
    if (query.entityId) {
      where.entityId = query.entityId;
      if (query.purpose) {
        where.purpose = query.purpose;
      }
    }
  }

  // Filter by media type: all | image | document | video
  if (query.type && query.type.toLowerCase() !== "all") {
    const t = query.type.toLowerCase();
    if (t === "image") {
      where.type = "IMAGE";
    } else if (t === "document") {
      where.type = { in: ["DOCUMENT", "PDF"] };
    } else if (t === "video") {
      where.type = "VIDEO";
    }
  }

  // Search filter across original name, filename, title, alt text, description, tags
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    where.OR = [
      { originalName: { contains: term, mode: "insensitive" } },
      { filename: { contains: term, mode: "insensitive" } },
      { title: { contains: term, mode: "insensitive" } },
      { altText: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { tags: { contains: term, mode: "insensitive" } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.media.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.media.count({ where })
  ]);
  return { data, total, page, limit };
}

export async function getMediaFolders(query: { entityType?: string; entityId?: string; purpose?: string }) {
  // 1. Root level (no entityType, no entityId)
  if (!query.entityType) {
    const counts = await prisma.media.groupBy({ by: ['entityType'], _count: { id: true } });
    const rootFolders = [
      { id: "PRODUCT", name: "Products", icon: "box", count: 0 },
      { id: "VARIANT", name: "Variants", icon: "layers", count: 0 },
      { id: "CATEGORY", name: "Categories", icon: "folder", count: 0 },
      { id: "BRAND", name: "Brands", icon: "tag", count: 0 },
      { id: "CUSTOMER", name: "Customers", icon: "users", count: 0 },
      { id: "ORDER", name: "Orders", icon: "shopping-cart", count: 0 },
      { id: "VIDEO", name: "Videos", icon: "video", count: 0 },
      { id: "SYSTEM", name: "System", icon: "settings", count: 0 },
      { id: "CMS", name: "CMS Pages", icon: "layout", count: 0 },
      { id: "BLOG", name: "Blogs", icon: "file-text", count: 0 },
      { id: "AUTHOR", name: "Authors", icon: "user", count: 0 },
      { id: "BANNER", name: "Banners", icon: "image", count: 0 },
      { id: "UNCATEGORIZED", name: "Uncategorized", icon: "file", count: 0 },
    ];
    rootFolders.forEach(f => {
      if (f.id === "UNCATEGORIZED") f.count = counts.find(c => c.entityType === null)?._count.id || 0;
      else f.count = counts.find(c => c.entityType === f.id)?._count.id || 0;
    });
    return rootFolders;
  }
  
  // 2. Entity Level (entityType provided, but no entityId)
  if (query.entityType && !query.entityId) {
    if (query.entityType === "UNCATEGORIZED") return [];
    
    const entities = await prisma.media.groupBy({
      by: ['entityId'],
      where: { entityType: query.entityType, entityId: { not: null } },
      _count: { id: true }
    });
    
    const results = [];
    if (query.entityType === "PRODUCT") {
      const ids = entities.map(e => e.entityId as string);
      const products = await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, title: true }});
      for (const e of entities) {
        const prod = products.find(p => p.id === e.entityId);
        results.push({ id: e.entityId, name: prod?.title || `Product ${e.entityId}`, count: e._count.id });
      }
    } else if (query.entityType === "CATEGORY") {
      const ids = entities.map(e => e.entityId as string);
      const categories = await prisma.category.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }});
      for (const e of entities) {
        const cat = categories.find(c => c.id === e.entityId);
        results.push({ id: e.entityId, name: cat?.name || `Category ${e.entityId}`, count: e._count.id });
      }
    } else if (query.entityType === "CMS") {
      const ids = entities.map(e => e.entityId as string);
      const pages = await prisma.cMSPage.findMany({ where: { id: { in: ids } }, select: { id: true, title: true }});
      for (const e of entities) {
        const p = pages.find((c: {id: string, title: string}) => c.id === e.entityId);
        results.push({ id: e.entityId, name: p?.title || `Page ${e.entityId}`, count: e._count.id });
      }
    } else if (query.entityType === "BLOG") {
      const ids = entities.map(e => e.entityId as string);
      const blogs = await prisma.blog.findMany({ where: { id: { in: ids } }, select: { id: true, title: true }});
      for (const e of entities) {
        const b = blogs.find((c: {id: string, title: string}) => c.id === e.entityId);
        results.push({ id: e.entityId, name: b?.title || `Blog ${e.entityId}`, count: e._count.id });
      }
    } else if (query.entityType === "AUTHOR") {
      const ids = entities.map(e => e.entityId as string);
      const authors = await prisma.blogAuthor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true }});
      for (const e of entities) {
        const a = authors.find((c: {id: string, name: string}) => c.id === e.entityId);
        results.push({ id: e.entityId, name: a?.name || `Author ${e.entityId}`, count: e._count.id });
      }
    } else if (query.entityType === "BANNER") {
      const ids = entities.map(e => e.entityId as string);
      const banners = await prisma.banner.findMany({ where: { id: { in: ids } }, select: { id: true, title: true }});
      for (const e of entities) {
        const b = banners.find((c: {id: string, title: string}) => c.id === e.entityId);
        results.push({ id: e.entityId, name: b?.title || `Banner ${e.entityId}`, count: e._count.id });
      }
    } else {
      for (const e of entities) {
        results.push({ id: e.entityId, name: `${query.entityType} ${e.entityId}`, count: e._count.id });
      }
    }
    return results;
  }
  
  // 3. Purpose Level - User requested to remove purpose subfolders
  if (query.entityType && query.entityId) {
    return [];
  }
  
  return [];
}

import { deleteObject, generatePresignedUploadUrl, getObjectBuffer, uploadObjectBuffer } from "./media.aws";
import { v4 as uuidv4 } from "uuid";
import { dispatchMediaProcessingJob } from "./media.worker";

function shouldUseS3MediaPipeline() {
  return (process.env.STORAGE_PROVIDER || "").toLowerCase() === "s3";
}

function assertS3MediaEnvironment() {
  if (!process.env.AWS_REGION || !process.env.AWS_S3_BUCKET) {
    throw new AppError("AWS_REGION and AWS_S3_BUCKET are required for S3 media uploads.", 500);
  }

  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  const bucketEnv = (process.env.AWS_S3_BUCKET_ENV || "").toLowerCase();
  const bucket = process.env.AWS_S3_BUCKET.toLowerCase();

  if (appEnv !== "production" && (bucketEnv === "production" || bucket.includes("prod"))) {
    throw new AppError("Non-production environments cannot upload media to the production S3 bucket.", 500);
  }

  if ((appEnv === "production" || appEnv === "staging") && bucketEnv && bucketEnv !== appEnv) {
    throw new AppError(`AWS_S3_BUCKET_ENV must be ${appEnv} for ${appEnv} media uploads.`, 500);
  }
}

function validateUploadRequest(data: { mimeType: string; size: number }) {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-m4v",
    "text/csv",
    "text/plain",
    "application/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];
  if (!allowed.includes(data.mimeType) && !data.mimeType.startsWith("video/")) {
    throw new AppError(`File type '${data.mimeType}' is not allowed.`, 400);
  }
  if (!Number.isFinite(data.size) || data.size <= 0 || data.size > 100 * 1024 * 1024) {
    throw new AppError("File size exceeds the maximum limit of 100MB.", 400);
  }
}

function resolveMediaFolder(folder?: string | null, entityType?: string | null) {
  if (folder) return folder;
  return entityType ? entityType.toLowerCase() : "modortho/media";
}

function resolvePresetName(entityType?: string | null, purpose?: string | null) {
  if (entityType === "BANNER" || purpose === "BANNER") return "banner";
  if (entityType === "CATEGORY") return "category";
  if (entityType === "BLOG" || entityType === "CMS") return "blog";
  if (entityType === "CUSTOMER" || entityType === "AUTHOR") return "profile";
  return "product";
}

function getStoredVariantKeys(media: { publicId: string | null; entityType: string | null; purpose: string | null }) {
  if (!media.publicId) return [];

  const match = media.publicId.match(/^(.*\/)?(.+)-([^-/.]+)\.webp$/);
  if (!match) return [media.publicId];

  const [, dir = "", uploadId] = match;
  const preset = getPreset(resolvePresetName(media.entityType, media.purpose));
  return Object.keys(preset).map((variantName) => `${dir}${uploadId}-${variantName}.webp`);
}

export async function presignUpload(data: {
  filename: string;
  mimeType: string;
  size: number;
  entityType?: string;
  entityId?: string;
  purpose?: string;
}) {
  assertS3MediaEnvironment();
  validateUploadRequest(data);

  const uploadSessionId = uuidv4();
  const ext = data.filename.split(".").pop();
  const key = `temporary/${uploadSessionId}/source.${ext}`;

  const media = await prisma.media.create({
    data: {
      filename: data.filename,
      originalName: data.filename,
      url: key,
      publicId: key,
      mimeType: data.mimeType,
      size: data.size,
      status: "PENDING_UPLOAD",
      entityType: data.entityType,
      entityId: data.entityId,
      purpose: data.purpose,
      type: data.mimeType.startsWith("image")
        ? "IMAGE"
        : data.mimeType.startsWith("video")
          ? "VIDEO"
          : data.mimeType.includes("pdf")
            ? "PDF"
            : "DOCUMENT",
      storageProvider: StorageProvider.S3,
    },
  });

  const uploadUrl = await generatePresignedUploadUrl(key, data.mimeType);

  return { uploadUrl, mediaId: media.id, key };
}

export async function confirmUpload(mediaId: string) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("Media not found.", 404);

  let readyMedia = await prisma.media.update({
    where: { id: mediaId },
    data: {
      status: "UPLOADED",
      storageProvider: StorageProvider.S3,
      url: getMediaUrl(media.publicId || media.url) || media.url,
    },
  });

  if (media.type === "IMAGE") {
    const sourceBuffer = await getObjectBuffer(media.publicId || media.url);
    const folder = resolveMediaFolder(media.folder, media.entityType);
    const uploadResult = await optimizeAndUploadPublicImage({
      buffer: sourceBuffer,
      folder,
      presetName: resolvePresetName(media.entityType, media.purpose),
      entityId: media.entityId || undefined,
    });
    await deleteObject(media.publicId || media.url).catch(() => undefined);

    readyMedia = await prisma.media.update({
      where: { id: mediaId },
      data: {
        filename: uploadResult.primaryKey.split("/").pop() || media.filename,
        url: uploadResult.primaryUrl,
        publicId: uploadResult.primaryKey,
        mimeType: "image/webp",
        size: sourceBuffer.length,
        status: "READY",
        storageProvider: StorageProvider.S3,
        folder,
      },
    });

    if (!readyMedia.url || readyMedia.url.startsWith("temporary/")) {
      throw new AppError("Upload confirmation failed to produce a final optimized media URL.", 500);
    }
  }

  if (readyMedia.entityType === "PRODUCT" && readyMedia.entityId && readyMedia.purpose !== "PACKAGE") {
    const existing = await prisma.productMedia.findFirst({
      where: { productId: readyMedia.entityId, url: readyMedia.url }
    });
    if (!existing) {
      await prisma.productMedia.create({
        data: {
          productId: readyMedia.entityId,
          url: readyMedia.url,
          type: readyMedia.type,
        }
      });
    }
  }

  if (readyMedia.status !== "READY") dispatchMediaProcessingJob(mediaId);
  return readyMedia;
}

export async function uploadMedia(
  files: Express.Multer.File[], 
  folder = "modortho/media",
  entityType?: string,
  entityId?: string,
  purpose?: string
) {
  if (!files || !files.length) return [];
  const useS3 = shouldUseS3MediaPipeline();
  if (useS3) assertS3MediaEnvironment();
  const resolvedFolder = resolveMediaFolder(folder, entityType);
  const results = await Promise.all(files.map(async (f) => {
    if (useS3 && f.mimetype.startsWith("image")) {
      const buffer = await fs.promises.readFile(f.path);
      const uploadResult = await optimizeAndUploadPublicImage({
        buffer,
        folder: resolvedFolder,
        presetName: resolvePresetName(entityType, purpose),
        entityId,
      });
      await fs.promises.unlink(f.path).catch(() => undefined);
      return {
        url: uploadResult.primaryUrl,
        publicId: uploadResult.primaryKey,
        storageProvider: StorageProvider.S3,
        mimeType: "image/webp",
        size: buffer.length,
      };
    }

    if (useS3) {
      const buffer = await fs.promises.readFile(f.path);
      const key = await uploadObjectBuffer(resolvedFolder, f.filename || f.originalname, f.mimetype, buffer);
      await fs.promises.unlink(f.path).catch(() => undefined);
      return {
        url: getMediaUrl(key) || key,
        publicId: key,
        storageProvider: StorageProvider.S3,
        mimeType: f.mimetype,
        size: buffer.length,
      };
    }

    const uploadResult = await uploadFile(f.path, resolvedFolder);
    return { ...uploadResult, mimeType: f.mimetype, size: f.size };
  }));
  
  const createdMedia = await prisma.$transaction(
    files.map((f, i) =>
      prisma.media.create({
        data: {
          filename: results[i].publicId || f.filename,
          originalName: f.originalname,
          url: results[i].url,
          publicId: results[i].publicId,
          mimeType: results[i].mimeType,
          size: results[i].size,
          type: f.mimetype.startsWith("image")
            ? "IMAGE" as const
            : f.mimetype.startsWith("video") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(f.originalname || "")
              ? "VIDEO" as const
              : f.mimetype.includes("pdf")
                ? "PDF" as const
                : "DOCUMENT" as const,
          storageProvider: results[i].storageProvider,
          folder: resolvedFolder,
          entityType,
          entityId,
          purpose,
        },
      }),
    ),
  );

  if (entityType === "PRODUCT" && entityId && purpose !== "PACKAGE") {
    await prisma.productMedia.createMany({
      data: createdMedia.map(m => ({
        productId: entityId,
        url: m.url,
        type: m.type,
      }))
    });
  }

  return createdMedia;
}

export async function updateMedia(id: string, data: { title?: string; altText?: string; description?: string; tags?: string; filename?: string; originalName?: string }) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new AppError("Media not found.", 404);

  return prisma.media.update({
    where: { id },
    data: {
      title: data.title,
      altText: data.altText,
      description: data.description,
      tags: data.tags,
      filename: data.filename,
      originalName: data.originalName,
    },
  });
}

export async function deleteMedia(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new AppError("Media not found.", 404);
  
  if (media.storageProvider === StorageProvider.S3) {
    await deletePublicMediaVariants(getStoredVariantKeys(media));
  } else {
    await deleteFile(media.storageProvider === "LOCAL" ? media.url : media.publicId || media.url, media.storageProvider, media.folder);
  }
  
  // Also delete associated ProductMedia if it shares the same URL
  await prisma.productMedia.deleteMany({ where: { url: media.url } });

  return prisma.media.delete({ where: { id } });
}

export async function deleteMediaByUrl(url: string) {
  if (!url) throw new AppError("Media URL is required.", 400);

  const media = await prisma.media.findFirst({ where: { url } });
  if (!media) return null;

  if (media.storageProvider === StorageProvider.S3) {
    await deletePublicMediaVariants(getStoredVariantKeys(media));
  } else {
    await deleteFile(media.storageProvider === "LOCAL" ? media.url : media.publicId || media.url, media.storageProvider, media.folder);
  }
  
  // Also delete associated ProductMedia if it shares the same URL
  await prisma.productMedia.deleteMany({ where: { url: media.url } });

  return prisma.media.delete({ where: { id: media.id } });
}
