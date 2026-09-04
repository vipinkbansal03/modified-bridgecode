"use client";

import { FileText } from "lucide-react";

interface DownloadCatalogueButtonProps {
  catalogueUrl?: string | null;
  title?: string;
}

export function DownloadCatalogueButton({ catalogueUrl, title = "Product" }: DownloadCatalogueButtonProps) {
  const rawUrl = catalogueUrl?.trim();
  if (!rawUrl) return null;

  const url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("/")
    ? rawUrl
    : `/${rawUrl}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`View & Download ${title} Catalogue`}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827] hover:border-[#9CA3AF] transition-colors shadow-2xs cursor-pointer"
    >
      <FileText size={14} className="text-[#E31E24]" />
      <span>Download Catalogue</span>
    </a>
  );
}


