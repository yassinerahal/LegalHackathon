"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/api";
import { ClientEntry } from "@/lib/types";

type CreateClientModalProps = {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: (client: ClientEntry) => void;
};

export function CreateClientModal({
  token,
  isOpen,
  onClose,
  onClientCreated
}: CreateClientModalProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Client name is required.");
      return;
    }

    try {
      setIsSaving(true);
      const createdClient = await createClient(
        {
          full_name: fullName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          address: address.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          zip_code: zipCode.trim() || undefined
        },
        token
      );
      onClientCreated(createdClient);
      setFullName("");
      setEmail("");
      setPhone("");
      setAddress("");
      setCity("");
      setState("");
      setZipCode("");
      onClose();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create client.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-surface">
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="panel-head">
            <h3>New Client</h3>
            <button type="button" onClick={onClose} className="btn-ghost">
              Close
            </button>
          </div>

          <label htmlFor="clientFullName">Full name</label>
          <input
            id="clientFullName"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />

          <div className="doc-placeholder-row">
            <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" />
            <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" />
            <div />
          </div>

          <label htmlFor="clientAddress">Address</label>
          <input
            id="clientAddress"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />

          <div className="doc-placeholder-row">
            <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="City" />
            <input value={state} onChange={(event) => setState(event.target.value)} placeholder="State" />
            <input value={zipCode} onChange={(event) => setZipCode(event.target.value)} placeholder="ZIP code" />
          </div>

          {error ? <p className="field-note error">{error}</p> : null}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-ghost">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="btn-primary">
              {isSaving ? "Saving..." : "Save Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
