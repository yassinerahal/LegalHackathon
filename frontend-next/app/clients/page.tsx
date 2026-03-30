"use client";

import { useEffect, useState } from "react";
import { CreateClientModal } from "@/components/CreateClientModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getClients } from "@/lib/api";
import { ClientEntry } from "@/lib/types";

export default function ClientsPage() {
  const { token, user } = useAuth();
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setClients(await getClients(token));
      } catch (clientsError) {
        setError(clientsError instanceof Error ? clientsError.message : "Failed to load clients.");
      }
    })();
  }, [token]);

  return (
    <ProtectedRoute allowedRoles={["admin", "lawyer", "assistant"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>Clients</h3>
            {(user?.role === "admin" || user?.role === "lawyer" || user?.role === "assistant") && (
              <button type="button" onClick={() => setIsCreateOpen(true)} className="btn-primary">
                Add Client
              </button>
            )}
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          <ul className="list">
            {clients.map((client) => (
              <li key={client.id}>
                <div>
                  <strong>{client.full_name}</strong>
                  <p className="meta">{client.email || client.phone || "No contact details yet"}</p>
                  <p className="case-comment">
                    {[client.address, client.zip_code, client.city, client.state].filter(Boolean).join(", ") ||
                      "No address yet"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {isCreateOpen && token ? (
          <CreateClientModal
            token={token}
            isOpen={isCreateOpen}
            onClose={() => setIsCreateOpen(false)}
            onClientCreated={(client) => {
              setClients((current) => [client, ...current]);
            }}
          />
        ) : null}
      </section>
    </ProtectedRoute>
  );
}
