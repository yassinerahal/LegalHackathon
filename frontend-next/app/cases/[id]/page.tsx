"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DocumentDownloadButton } from "@/components/DocumentDownloadButton";
import { PlaceholderCard } from "@/components/PlaceholderCard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import {
  assignUserToCase,
  createCasePlaceholders,
  getAssignableUsers,
  getCaseAssignments,
  getCaseById,
  getCaseDocuments,
  getCasePlaceholders,
  getClients,
  updateCase
} from "@/lib/api";
import { AdminUser, CaseAssignmentUser, CaseDocument, CaseEntry, CasePlaceholder, ClientEntry } from "@/lib/types";

function canModifyCaseMetadata(userRole?: string, entry?: CaseEntry | null) {
  if (!userRole || !entry) return false;
  if (userRole === "admin") return true;
  if (userRole === "lawyer") return Boolean(entry.can_edit || entry.is_owner || entry.is_assigned);
  return false;
}

function canManageAssignments(userRole?: string, entry?: CaseEntry | null) {
  if (!userRole || !entry) return false;
  return userRole === "admin" || Boolean(entry.is_owner);
}

export default function CaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const caseId = String(params.id || "");
  const { token, user } = useAuth();
  const [entry, setEntry] = useState<CaseEntry | null>(null);
  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [placeholders, setPlaceholders] = useState<CasePlaceholder[]>([]);
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [assignedUsers, setAssignedUsers] = useState<CaseAssignmentUser[]>([]);
  const [assignableUsers, setAssignableUsers] = useState<AdminUser[]>([]);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [newPlaceholderName, setNewPlaceholderName] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editClientId, setEditClientId] = useState("");
  const [editStatus, setEditStatus] = useState("Active");
  const [editDeadline, setEditDeadline] = useState("");
  const [editDescription, setEditDescription] = useState("");

  useEffect(() => {
    if (!token || !caseId) return;

    (async () => {
      try {
        setError(null);
        const [nextEntry, nextDocuments, nextPlaceholders] = await Promise.all([
          getCaseById(caseId, token),
          getCaseDocuments(caseId, token),
          getCasePlaceholders(caseId, token)
        ]);

        setEntry(nextEntry);
        setDocuments(nextDocuments);
        setPlaceholders(nextPlaceholders);

        const optionalResults = await Promise.allSettled([
          getClients(token),
          getCaseAssignments(caseId, token),
          getAssignableUsers(token)
        ]);

        if (optionalResults[0].status === "fulfilled") setClients(optionalResults[0].value);
        if (optionalResults[1].status === "fulfilled") setAssignedUsers(optionalResults[1].value);
        if (optionalResults[2].status === "fulfilled") setAssignableUsers(optionalResults[2].value);
      } catch (pageError) {
        setError(pageError instanceof Error ? pageError.message : "Failed to load case.");
      }
    })();
  }, [caseId, token]);

  useEffect(() => {
    if (!entry) return;
    setEditName(entry.name || "");
    setEditClientId(entry.client_id ? String(entry.client_id) : "");
    setEditStatus(entry.status || "Active");
    setEditDeadline(entry.deadline || "");
    setEditDescription(entry.short_description || "");
  }, [entry]);

  const canUpload = user?.role === "admin" || user?.role === "lawyer" || user?.role === "assistant";
  const canChangeMetadata = canModifyCaseMetadata(user?.role, entry);
  const canAssignUsers = canManageAssignments(user?.role, entry);

  const availableAssignmentOptions = useMemo(() => {
    const assignedIds = new Set(assignedUsers.map((assignedUser) => String(assignedUser.id)));
    const ownerId = entry?.owner_id ? String(entry.owner_id) : "";
    return assignableUsers.filter(
      (candidate) =>
        (candidate.role === "lawyer" || candidate.role === "assistant") &&
        String(candidate.id) !== ownerId &&
        !assignedIds.has(String(candidate.id))
    );
  }, [assignableUsers, assignedUsers, entry?.owner_id]);

  const handleSaveCase = async () => {
    if (!token || !entry) return;

    try {
      setError(null);
      setStatusMessage("Saving case...");
      const updated = await updateCase(
        caseId,
        {
          name: editName.trim(),
          client_id: Number(editClientId),
          status: editStatus,
          deadline: editDeadline || null,
          short_description: editDescription.trim()
        },
        token
      );
      setEntry((current) => ({
        ...current,
        ...updated,
        client_name:
          clients.find((client) => String(client.id) === String(updated.client_id))?.full_name ||
          current?.client_name ||
          ""
      }));
      setIsEditOpen(false);
      setStatusMessage("Case updated.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save case.");
      setStatusMessage(null);
    }
  };

  const handleAssignUser = async () => {
    if (!token || !selectedAssigneeId || !canAssignUsers) return;

    try {
      setError(null);
      setStatusMessage("Assigning user...");
      await assignUserToCase(caseId, Number(selectedAssigneeId), token);
      const refreshedAssignments = await getCaseAssignments(caseId, token);
      setAssignedUsers(refreshedAssignments);
      setSelectedAssigneeId("");
      setStatusMessage("User assigned.");
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to assign user.");
      setStatusMessage(null);
    }
  };

  const handleAddPlaceholder = async () => {
    if (!token || !newPlaceholderName.trim() || !entry || !canUpload) return;

    try {
      setError(null);
      setStatusMessage("Adding placeholder...");
      const created = await createCasePlaceholders(
        caseId,
        [
          {
            name: newPlaceholderName.trim(),
            status: "Pending",
            attached_files: []
          }
        ],
        token
      );

      setPlaceholders((current) => [...current, ...created]);
      setNewPlaceholderName("");
      setStatusMessage("Placeholder added.");
    } catch (placeholderError) {
      setError(placeholderError instanceof Error ? placeholderError.message : "Failed to add placeholder.");
      setStatusMessage(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["admin", "lawyer", "assistant"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>{entry?.name || "Case"}</h3>
            <div className="case-actions">
              <span className="badge">{entry?.status || "Active"}</span>
              {entry ? (
                <button type="button" onClick={() => setIsEditOpen(true)} className="btn-ghost">
                  {canChangeMetadata ? "Edit" : "View"}
                </button>
              ) : null}
            </div>
          </div>
          <p className="meta">
            Client: {entry?.client_name || "Unknown"} | Owner:{" "}
            {entry?.owner_full_name || entry?.owner_username || "Unassigned"}
          </p>
          <p className="case-comment">{entry?.short_description || "No description available."}</p>
          <p className="case-doc-status">Deadline: {entry?.deadline || "Not set"}</p>
        </section>

        {error ? <p className="field-note error">{error}</p> : null}
        {statusMessage ? <p className="field-note success">{statusMessage}</p> : null}

        <section className="grid-2">
          <article className="panel">
            <div className="panel-head">
              <h3>Uploaded Documents</h3>
            </div>
            <div className="uploaded-file-boxes">
              {documents.map((document) => (
                <div key={document.s3_key} className="uploaded-file-box">
                  <strong>{document.original_name}</strong>
                  <span className="field-note">{document.mime_type || "application/octet-stream"}</span>
                  {token ? (
                    <DocumentDownloadButton
                      token={token}
                      s3Key={document.s3_key}
                      fileName={document.original_name}
                      className="btn-ghost"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h3>Required Placeholders</h3>
            </div>
            {canUpload ? (
              <section className="doc-placeholder-section">
                <div className="doc-placeholder-row">
                  <input
                    value={newPlaceholderName}
                    onChange={(event) => setNewPlaceholderName(event.target.value)}
                    placeholder="Example: Signed Power of Attorney"
                  />
                  <select value="Pending" disabled>
                    <option value="Pending">Pending</option>
                  </select>
                  <button type="button" onClick={handleAddPlaceholder} className="btn-ghost">
                    Add
                  </button>
                </div>
              </section>
            ) : null}
            <div className="doc-placeholder-list">
              {placeholders.map((placeholder) => (
                <PlaceholderCard
                  key={placeholder.id}
                  caseId={caseId}
                  placeholder={placeholder}
                  token={token || ""}
                  canUpload={Boolean(canUpload)}
                  onPlaceholderUpdated={(nextPlaceholder) => {
                    setPlaceholders((current) =>
                      current.map((item) => (item.id === nextPlaceholder.id ? nextPlaceholder : item))
                    );
                  }}
                  onDocumentsUpdated={setDocuments}
                />
              ))}
            </div>
          </article>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h3>Case Team Access</h3>
          </div>
          <ul className="list">
            {assignedUsers.map((assignedUser) => (
              <li key={assignedUser.id}>
                <div>
                  <strong>{assignedUser.full_name || assignedUser.username || assignedUser.email}</strong>
                  <p className="meta">{assignedUser.email}</p>
                </div>
                <span className="badge">{assignedUser.role}</span>
              </li>
            ))}
          </ul>

          {canAssignUsers ? (
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
              <select value={selectedAssigneeId} onChange={(event) => setSelectedAssigneeId(event.target.value)}>
                <option value="">Select lawyer or assistant</option>
                {availableAssignmentOptions.map((candidate) => (
                  <option key={candidate.id} value={candidate.id}>
                    {candidate.full_name || candidate.username || candidate.email} ({candidate.role})
                  </option>
                ))}
              </select>
              <button type="button" onClick={handleAssignUser} className="btn-primary">
                Assign to Case
              </button>
            </div>
          ) : null}
        </section>

        {isEditOpen && entry ? (
          <div className="modal-backdrop">
            <div className="modal-surface">
              <div className="modal-form">
                <div className="panel-head">
                  <h3>{canChangeMetadata ? "Edit Case" : "View Case"}</h3>
                  <button type="button" onClick={() => setIsEditOpen(false)} className="btn-ghost">
                    Close
                  </button>
                </div>

                <label htmlFor="editCaseName">Case Name</label>
                <input
                  id="editCaseName"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  readOnly={!canChangeMetadata}
                />

                <label htmlFor="editClientId">Client</label>
                <select
                  id="editClientId"
                  value={editClientId}
                  onChange={(event) => setEditClientId(event.target.value)}
                  disabled={!canChangeMetadata}
                >
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.full_name}
                    </option>
                  ))}
                </select>

                <div className="doc-placeholder-row">
                  <select
                    value={editStatus}
                    onChange={(event) => setEditStatus(event.target.value)}
                    disabled={!canChangeMetadata}
                  >
                    <option value="Active">Active</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Finished">Finished</option>
                  </select>
                  <input
                    type="date"
                    value={editDeadline}
                    onChange={(event) => setEditDeadline(event.target.value)}
                    readOnly={!canChangeMetadata}
                  />
                  <div />
                </div>

                <label htmlFor="editDescription">Short Description</label>
                <textarea
                  id="editDescription"
                  rows={4}
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  readOnly={!canChangeMetadata}
                />

                {canChangeMetadata ? (
                  <div className="modal-actions">
                    <button type="button" onClick={handleSaveCase} className="btn-primary">
                      Save Changes
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </ProtectedRoute>
  );
}
