"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";

interface DownloadCatalogueButtonProps {
  catalogueUrl?: string | null;
  title?: string;
}

export function DownloadCatalogueButton({ catalogueUrl, title = "Product" }: DownloadCatalogueButtonProps) {
  const [downloading, setDownloading] = useState(false);
  const rawUrl = catalogueUrl?.trim();
  if (!rawUrl) return null;

  const url = rawUrl.startsWith("http://") || rawUrl.startsWith("https://") || rawUrl.startsWith("/")
    ? rawUrl
    : `/${rawUrl}`;

  const getPdfFilename = (productTitle: string) => {
    const clean = productTitle
      .replace(/[^a-zA-Z0-9-_\s]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    return `${clean || "Product-Catalogue"}.pdf`;
  };

  const handleDownload = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    const fileName = getPdfFilename(title);
    
    // For same-origin or fetchable URLs, trigger named blob download
    try {
      setDownloading(true);
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      // Fallback: direct download link
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <a
      href={url}
      download={getPdfFilename(title)}
      onClick={handleDownload}
      target="_blank"
      rel="noopener noreferrer"
      title={`Download ${title} Catalogue (PDF)`}
      className="inline-flex items-center gap-1.5 rounded-md border border-[#D1D5DB] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827] hover:border-[#9CA3AF] transition-colors shadow-2xs cursor-pointer"
    >
      {downloading ? (
        <Loader2 size={14} className="text-[#E31E24] animate-spin" />
      ) : (
        <FileText size={14} className="text-[#E31E24]" />
      )}
      <span>{downloading ? "Downloading..." : "Download Catalogue"}</span>
    </a>
  );
}


