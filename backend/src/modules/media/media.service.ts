import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";

export async function listMedia(query: { page?: string; limit?: string; entityType?: string; entityId?: string; purpose?: string; uncategorized?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: any = {};
  
  if (query.uncategorized === "true" || query.entityType === "UNCATEGORIZED") {
    where.entityType = null;
  } else {
    if (query.entityType) where.entityType = query.entityType;
    
    if (query.entityType && query.entityId) {
      where.entityId = query.entityId;
      if (query.purpose) {
        where.purpose = query.purpose;
      }
    } else if (query.entityType && !query.entityId) {
      where.entityId = null;
    }
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

import { generatePresignedUploadUrl } from "./media.aws";
import { v4 as uuidv4 } from "uuid";
import { dispatchMediaProcessingJob } from "./media.worker";

export async function presignUpload(data: {
  filename: string;
  mimeType: string;
  size: number;
  entityType?: string;
  entityId?: string;
  purpose?: string;
}) {
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
      storageProvider: "LOCAL", // Will update to S3 later or keep LOCAL for generic
    },
  });

  const uploadUrl = await generatePresignedUploadUrl(key, data.mimeType);

  return { uploadUrl, mediaId: media.id, key };
}

export async function confirmUpload(mediaId: string) {
  const media = await prisma.media.update({
    where: { id: mediaId },
    data: { status: "UPLOADED" },
  });

  if (media.entityType === "PRODUCT" && media.entityId && media.purpose !== "PACKAGE") {
    const existing = await prisma.productMedia.findFirst({
      where: { productId: media.entityId, url: media.url }
    });
    if (!existing) {
      await prisma.productMedia.create({
        data: {
          productId: media.entityId,
          url: media.url,
          type: media.type,
        }
      });
    }
  }

  dispatchMediaProcessingJob(mediaId);
  return media;
}

export async function uploadMedia(
  files: Express.Multer.File[], 
  folder = "modortho/media",
  entityType?: string,
  entityId?: string,
  purpose?: string
) {
  if (!files || !files.length) return [];
  const results = await Promise.all(files.map((f) => uploadFile(f.path, folder)));
  
  const createdMedia = await prisma.$transaction(
    files.map((f, i) =>
      prisma.media.create({
        data: {
          filename: results[i].publicId || f.filename,
          originalName: f.originalname,
          url: results[i].url,
          publicId: results[i].publicId,
          mimeType: f.mimetype,
          size: f.size,
          type: f.mimetype.startsWith("image")
            ? "IMAGE" as const
            : f.mimetype.includes("pdf")
              ? "PDF" as const
              : "DOCUMENT" as const,
          storageProvider: results[i].storageProvider,
          folder,
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
  
  await deleteFile(media.storageProvider === "LOCAL" ? media.url : media.publicId || media.url, media.storageProvider, media.folder);
  
  // Also delete associated ProductMedia if it shares the same URL
  await prisma.productMedia.deleteMany({ where: { url: media.url } });

  return prisma.media.delete({ where: { id } });
}

export async function deleteMediaByUrl(url: string) {
  if (!url) throw new AppError("Media URL is required.", 400);

  const media = await prisma.media.findFirst({ where: { url } });
  if (!media) return null;

  await deleteFile(media.storageProvider === "LOCAL" ? media.url : media.publicId || media.url, media.storageProvider, media.folder);
  
  // Also delete associated ProductMedia if it shares the same URL
  await prisma.productMedia.deleteMany({ where: { url: media.url } });

  return prisma.media.delete({ where: { id: media.id } });
}
