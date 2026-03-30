"use client";

import { DragEvent, useMemo, useState } from "react";
import {
  getCaseDocuments,
  linkDocumentToCase,
  linkPlaceholderToDocument,
  uploadFile
} from "@/lib/api";
import { DocumentDownloadButton } from "@/components/DocumentDownloadButton";
import { CaseDocument, CasePlaceholder, PlaceholderFile } from "@/lib/types";

type PlaceholderCardProps = {
  caseId: string;
  placeholder: CasePlaceholder;
  token: string;
  canUpload: boolean;
  onPlaceholderUpdated: (nextPlaceholder: CasePlaceholder) => void;
  onDocumentsUpdated?: (documents: CaseDocument[]) => void;
};

function getFileIcon(name: string) {
  const extension = name.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "PDF";
  if (extension === "doc" || extension === "docx") return "DOC";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(extension || "")) return "IMG";
  return "FILE";
}

export function PlaceholderCard({
  caseId,
  placeholder,
  token,
  canUpload,
  onPlaceholderUpdated,
  onDocumentsUpdated
}: PlaceholderCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const attachedFiles = useMemo(
    () => (Array.isArray(placeholder.attached_files) ? placeholder.attached_files : []),
    [placeholder.attached_files]
  );

  const persistDroppedFiles = async (files: File[]) => {
    if (!canUpload || !files.length) return;

    setIsUploading(true);
    setError(null);

    try {
      let nextPlaceholder = placeholder;

      for (const file of files) {
        const uploadResult = await uploadFile(file, token);
        const linkedDocument = await linkDocumentToCase(
          caseId,
          {
            original_name: file.name,
            s3_key: uploadResult.filePath,
            mime_type: file.type || "application/octet-stream",
            encryption_iv: uploadResult.encryption_iv,
            encryption_tag: uploadResult.encryption_tag
          },
          token
        );

        nextPlaceholder = await linkPlaceholderToDocument(
          caseId,
          placeholder.id,
          {
            original_name: linkedDocument.original_name,
            s3_key: linkedDocument.s3_key,
            mime_type: linkedDocument.mime_type || file.type || "application/octet-stream",
            encryption_iv: linkedDocument.encryption_iv || uploadResult.encryption_iv,
            encryption_tag: linkedDocument.encryption_tag || uploadResult.encryption_tag
          },
          token
        );
      }

      onPlaceholderUpdated(nextPlaceholder);

      if (onDocumentsUpdated) {
        const refreshedDocuments = await getCaseDocuments(caseId, token);
        onDocumentsUpdated(refreshedDocuments);
      }
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Failed to upload files for this placeholder.";
      setError(message);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
    }
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files || []);
    await persistDroppedFiles(droppedFiles);
  };

  return (
    <article className="doc-placeholder-item" style={{ alignItems: "stretch", flexDirection: "column", gap: "0.75rem" }}>
      <div className="case-actions" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0, fontSize: "1rem" }}>{placeholder.name}</h3>
          <p className="field-note">{placeholder.status || "Pending"}</p>
        </div>
        {isUploading ? (
          <span className="badge">Uploading...</span>
        ) : null}
      </div>

      <div
        onDragOver={(event) => {
          if (!canUpload) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`doc-drop-field ${isDragging ? "drag-active" : ""}`}
        style={!canUpload ? { opacity: 0.7 } : undefined}
      >
        {attachedFiles.length === 0 ? (
          <p className="doc-drop-hint">
            {canUpload ? "Drop file(s) here to upload and link them." : "No files linked yet."}
          </p>
        ) : (
          <div className="doc-drop-file-list">
            {attachedFiles.map((file: PlaceholderFile) => (
              <div key={`${file.s3_key}-${file.original_name}`} className="doc-drop-file-item">
                <div className="doc-drop-file-meta">
                  <span className="doc-file-icon">{getFileIcon(file.original_name)}</span>
                  <div>
                    <p className="doc-drop-file-name">{file.original_name}</p>
                    <p className="field-note">{file.mime_type || "application/octet-stream"}</p>
                  </div>
                </div>
                <DocumentDownloadButton
                  token={token}
                  s3Key={file.s3_key}
                  fileName={file.original_name}
                  className="btn-ghost"
                />
              </div>
            ))}
            {canUpload ? <p className="doc-drop-hint">Drop more files here to append them.</p> : null}
          </div>
        )}
      </div>

      {error ? <p className="field-note error">{error}</p> : null}
    </article>
  );
}
