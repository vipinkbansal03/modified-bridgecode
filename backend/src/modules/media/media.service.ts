import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";

export async function listMedia(query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const [data, total] = await Promise.all([prisma.media.findMany({ skip, take: limit, orderBy: { createdAt: "desc" } }), prisma.media.count()]);
  return { data, total, page, limit };
}

export async function uploadMedia(files: Express.Multer.File[], folder = "modortho/media") {
  const results = await Promise.all(files.map((f) => uploadFile(f.path, folder)));
  return prisma.$transaction(
    files.map((f, i) => prisma.media.create({
      data: {
      filename: results[i].publicId || f.filename,
      originalName: f.originalname,
      url: results[i].url,
      publicId: results[i].publicId,
      mimeType: f.mimetype,
      size: f.size,
      type: f.mimetype.startsWith("image") ? "IMAGE" as const : f.mimetype.includes("pdf") ? "PDF" as const : "DOCUMENT" as const,
      storageProvider: results[i].storageProvider,
      folder,
      },
    })),
  );
}

export async function deleteMedia(id: string) {
  const media = await prisma.media.findUnique({ where: { id } });
  if (!media) throw new AppError("Media not found.", 404);
  await deleteFile(media.publicId || media.url, media.storageProvider);
  return prisma.media.delete({ where: { id } });
}
