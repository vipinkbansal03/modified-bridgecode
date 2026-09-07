import { adminApi } from "@/services/adminApi";
import { uploadMediaFiles } from "@/utils/uploadMedia";

export interface MediaItem {
  id: string;
  url: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  width?: number | null;
  height?: number | null;
  type: "IMAGE" | "VIDEO" | "DOCUMENT" | "PDF";
  status: string;
  title?: string | null;
  altText?: string | null;
  description?: string | null;
  tags?: string | null;
  createdAt?: string;
  updatedAt?: string;
  entityType?: string | null;
  entityId?: string | null;
  purpose?: string | null;
}

export interface MediaListResponse {
  items: MediaItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const mediaService = {
  async list(params: {
    page?: number;
    limit?: number;
    search?: string;
    type?: "all" | "image" | "document" | "video";
    entityType?: string;
  } = {}): Promise<MediaListResponse> {
    const res = await adminApi.get("/media", { params });
    return {
      items: res.data?.data || [],
      pagination: res.data?.pagination || {
        page: params.page || 1,
        limit: params.limit || 24,
        total: (res.data?.data || []).length,
        totalPages: 1,
      },
    };
  },

  async upload(
    files: File[],
    options?: { entityType?: string; entityId?: string; purpose?: string }
  ) {
    return uploadMediaFiles(files, options);
  },

  async update(
    id: string,
    payload: { title?: string; altText?: string; description?: string; tags?: string }
  ): Promise<MediaItem> {
    const res = await adminApi.put(`/media/${id}`, payload);
    return res.data?.data as MediaItem;
  },

  async remove(id: string) {
    const res = await adminApi.delete(`/media/${id}`);
    return res.data;
  },
};
