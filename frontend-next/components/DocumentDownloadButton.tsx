"use client";

import { useState } from "react";
import { downloadDocument } from "@/lib/api";

type DocumentDownloadButtonProps = {
  token: string;
  s3Key: string;
  fileName: string;
  className?: string;
};

export function DocumentDownloadButton({
  token,
  s3Key,
  fileName,
  className
}: DocumentDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      const blob = await downloadDocument({ s3Key, fileName }, token);
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error("Failed to download document:", error);
      window.alert(error instanceof Error ? error.message : "Failed to download document.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={isDownloading}
      className={
        className ||
        "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-60"
      }
    >
      {isDownloading ? "Downloading..." : "Download"}
    </button>
  );
}
