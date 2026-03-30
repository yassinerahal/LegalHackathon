"use client";

import { FormEvent, useMemo, useState } from "react";
import { createCase, createCasePlaceholders, createClient, getClients } from "@/lib/api";
import { CaseEntry, ClientEntry } from "@/lib/types";

type CreateCaseModalProps = {
  token: string;
  isOpen: boolean;
  clients: ClientEntry[];
  onClose: () => void;
  onCaseCreated: (createdCase: CaseEntry) => void;
  onClientsUpdated: (clients: ClientEntry[]) => void;
};

type PlaceholderDraft = {
  id: string;
  name: string;
  status: string;
};

export function CreateCaseModal({
  token,
  isOpen,
  clients,
  onClose,
  onCaseCreated,
  onClientsUpdated
}: CreateCaseModalProps) {
  const [caseName, setCaseName] = useState("");
  const [clientId, setClientId] = useState("");
  const [status, setStatus] = useState("Active");
  const [deadline, setDeadline] = useState("");
  const [description, setDescription] = useState("");
  const [placeholders, setPlaceholders] = useState<PlaceholderDraft[]>([]);
  const [newPlaceholderName, setNewPlaceholderName] = useState("");
  const [showClientForm, setShowClientForm] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [clients]
  );

  if (!isOpen) return null;

  const addPlaceholder = () => {
    if (!newPlaceholderName.trim()) return;
    setPlaceholders((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        name: newPlaceholderName.trim(),
        status: "Pending"
      }
    ]);
    setNewPlaceholderName("");
  };

  const removePlaceholder = (placeholderId: string) => {
    setPlaceholders((current) => current.filter((item) => item.id !== placeholderId));
  };

  const handleCreateClient = async () => {
    if (!clientName.trim()) return;

    const createdClient = await createClient(
      {
        full_name: clientName.trim(),
        email: clientEmail.trim() || undefined,
        phone: clientPhone.trim() || undefined,
        address: clientAddress.trim() || undefined
      },
      token
    );

    const refreshedClients = await getClients(token);
    onClientsUpdated(refreshedClients);
    setClientId(String(createdClient.id));
    setShowClientForm(false);
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!caseName.trim()) {
      setError("Case name is required.");
      return;
    }

    if (!clientId) {
      setError("Please select a client.");
      return;
    }

    try {
      setIsSaving(true);
      const createdCase = await createCase(
        {
          name: caseName.trim(),
          client_id: Number(clientId),
          status,
          deadline: deadline || null,
          short_description: description.trim()
        },
        token
      );

      if (placeholders.length) {
        await createCasePlaceholders(
          String(createdCase.id),
          placeholders.map((placeholder) => ({
            name: placeholder.name,
            status: placeholder.status,
            attached_files: []
          })),
          token
        );
      }

      onCaseCreated(createdCase);
      onClose();
      setCaseName("");
      setClientId("");
      setStatus("Active");
      setDeadline("");
      setDescription("");
      setPlaceholders([]);
      setNewPlaceholderName("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to create case.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-surface">
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="panel-head">
            <h3>Add Case</h3>
            <button type="button" onClick={onClose} className="btn-ghost">
              Close
            </button>
          </div>

          <label htmlFor="caseName">Case Name</label>
          <input id="caseName" value={caseName} onChange={(event) => setCaseName(event.target.value)} />

          <label htmlFor="clientId">Client</label>
          <select id="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)}>
            <option value="">Select a client</option>
            {sortedClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.full_name}
              </option>
            ))}
          </select>

          <button type="button" onClick={() => setShowClientForm((current) => !current)} className="btn-ghost">
            {showClientForm ? "Hide client form" : "Add Client"}
          </button>

          {showClientForm ? (
            <section className="doc-placeholder-section">
              <h4>New Client</h4>
              <label htmlFor="clientFullName">Name</label>
              <input
                id="clientFullName"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
              />

              <label htmlFor="clientAddress">Address</label>
              <input
                id="clientAddress"
                value={clientAddress}
                onChange={(event) => setClientAddress(event.target.value)}
              />

              <label htmlFor="clientEmail">Email</label>
              <input
                id="clientEmail"
                value={clientEmail}
                onChange={(event) => setClientEmail(event.target.value)}
              />

              <label htmlFor="clientPhone">Phone</label>
              <input
                id="clientPhone"
                value={clientPhone}
                onChange={(event) => setClientPhone(event.target.value)}
              />

              <button type="button" onClick={handleCreateClient} className="btn-primary">
                Save Client
              </button>
            </section>
          ) : null}

          <label htmlFor="caseStatus">Case Status</label>
          <select id="caseStatus" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Finished">Finished</option>
          </select>

          <label htmlFor="caseDeadline">Deadline</label>
          <input
            id="caseDeadline"
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />

          <label htmlFor="caseDescription">Short Description</label>
          <textarea
            id="caseDescription"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />

          <section className="doc-placeholder-section">
            <h4>Required Document Placeholders</h4>
            <div className="doc-placeholder-row">
              <input
                value={newPlaceholderName}
                onChange={(event) => setNewPlaceholderName(event.target.value)}
                placeholder="Example: Signed Power of Attorney"
              />
              <select value="Pending" disabled>
                <option value="Pending">Pending</option>
              </select>
              <button type="button" onClick={addPlaceholder} className="btn-ghost">
                Add
              </button>
            </div>
            <ul className="doc-placeholder-list">
              {placeholders.map((placeholder) => (
                <li key={placeholder.id} className="doc-placeholder-item">
                  <div>
                    <p>{placeholder.name}</p>
                    <p className="field-note">{placeholder.status}</p>
                  </div>
                  <button type="button" onClick={() => removePlaceholder(placeholder.id)} className="btn-ghost">
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {error ? <p className="field-note error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? "Saving..." : "Save Case"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
