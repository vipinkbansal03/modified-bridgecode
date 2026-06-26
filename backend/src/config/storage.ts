import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import path from "path";
import { StorageProvider } from "@prisma/client";
import { logger } from "./logger";

// ─── Cloudinary config ───────────────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export type UploadResult = {
  url: string;
  publicId: string | null;
  storageProvider: StorageProvider;
};

export const activeProvider = (): StorageProvider => {
  return (process.env.STORAGE_PROVIDER || "local").toUpperCase() === "CLOUDINARY"
    ? StorageProvider.CLOUDINARY
    : StorageProvider.LOCAL;
};

/**
 * Upload a file using the configured storage provider.
 * @param localFilePath - The temp file path from multer
 * @param folder - Subdirectory / Cloudinary folder
 */
export async function uploadFile(localFilePath: string, folder = "modortho"): Promise<UploadResult> {
  const provider = activeProvider();

  if (provider === StorageProvider.CLOUDINARY) {
    const result: UploadApiResponse = await cloudinary.uploader.upload(localFilePath, {
      folder,
      resource_type: "auto",
    });
    // Clean up temp file after Cloudinary upload
    fs.unlinkSync(localFilePath);
    return { url: result.secure_url, publicId: result.public_id, storageProvider: StorageProvider.CLOUDINARY };
  }

  // Local storage: move file from temp to uploads dir
  const uploadDir = path.join(process.cwd(), process.env.LOCAL_UPLOAD_PATH || "uploads", folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
  const filename = path.basename(localFilePath);
  const destPath = path.join(uploadDir, filename);
  fs.renameSync(localFilePath, destPath);
  const relativeUrl = `/uploads/${folder}/${filename}`;
  return { url: relativeUrl, publicId: filename, storageProvider: StorageProvider.LOCAL };
}

/**
 * Delete a file from the configured storage provider.
 */
export async function deleteFile(publicId: string, provider: StorageProvider, folder?: string | null): Promise<void> {
  try {
    if (provider === StorageProvider.CLOUDINARY) {
      await cloudinary.uploader.destroy(publicId);
    } else {
      const uploadRoot = path.resolve(process.cwd(), process.env.LOCAL_UPLOAD_PATH || "uploads");
      const normalizedFolder = folder ? folder.replace(/^[/\\]+|[/\\]+$/g, "") : "";
      let relativePath = publicId.startsWith("/uploads/")
        ? publicId.replace(/^\/uploads\//, "")
        : publicId.replace(/^[/\\]+/, "");

      if (normalizedFolder && !relativePath.startsWith(`${normalizedFolder}/`) && !relativePath.startsWith(`${normalizedFolder}\\`)) {
        relativePath = path.join(normalizedFolder, relativePath);
      }

      const filePath = path.resolve(uploadRoot, relativePath);
      if (!filePath.startsWith(uploadRoot)) {
        throw new Error(`Refusing to delete file outside uploads root: ${filePath}`);
      }
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  } catch (err) {
    logger.error(`Failed to delete file [${publicId}]:`, err);
  }
}
