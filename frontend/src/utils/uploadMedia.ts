import { adminApi } from "@/services/adminApi";

/**
 * Uploads media files using a dual-mode strategy.
 * If the backend is configured with AWS S3, it uses presigned URLs for direct browser-to-S3 uploads.
 * If the backend is configured with LOCAL/Cloudinary, it falls back to standard FormData POST.
 */
export async function uploadMediaFiles(
  files: File[],
  options?: {
    entityType?: string;
    entityId?: string;
    purpose?: string;
  }
): Promise<{ url: string; mediaId?: string }[]> {
  if (!files || !files.length) return [];

  const { entityType, entityId, purpose } = options || {};
  const results: { url: string; mediaId?: string }[] = [];

  // 1. Check storage configuration
  let storageProvider = "LOCAL";
  try {
    const configRes = await adminApi.get("/media/config");
    storageProvider = configRes.data?.data?.storageProvider || "LOCAL";
  } catch (error) {
    console.warn("Failed to fetch media config, falling back to LOCAL upload", error);
  }

  // 2. Upload via S3 Presigned URLs
  if (storageProvider === "S3") {
    for (const file of files) {
      // Get presigned URL
      const presignRes = await adminApi.post("/media/presign", {
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        entityType,
        entityId,
        purpose,
      });

      const { uploadUrl, mediaId } = presignRes.data.data;

      // Upload directly to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "application/octet-stream" },
      });

      if (!uploadResponse.ok) {
        throw new Error(`S3 Upload Failed for ${file.name}`);
      }

      // Confirm upload with backend
      const confirmRes = await adminApi.post("/media/confirm", { mediaId });
      const confirmedUrl = confirmRes.data?.data?.url;
      if (!confirmedUrl || confirmedUrl.startsWith("temporary/")) {
        throw new Error(`Upload confirmation did not return a final media URL for ${file.name}`);
      }

      results.push({ url: confirmedUrl, mediaId });
    }
  } 
  
  // 3. Fallback: Upload via FormData to Node.js Backend
  else {
    const formData = new FormData();
    if (entityType) formData.append("entityType", entityType);
    if (entityId) formData.append("entityId", entityId);
    if (purpose) formData.append("purpose", purpose);
    
    files.forEach((f) => formData.append("files", f));
    
    const response = await adminApi.post("/media", formData);
    const uploadedData = response.data?.data || [];
    
    if (Array.isArray(uploadedData)) {
      uploadedData.forEach((uploadedFile: any) => {
        results.push({ url: uploadedFile.url, mediaId: uploadedFile.id });
      });
    } else if (uploadedData?.url) {
      results.push({ url: uploadedData.url, mediaId: uploadedData.id });
    }
  }

  return results;
}
