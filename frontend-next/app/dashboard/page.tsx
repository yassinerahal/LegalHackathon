"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CreateCaseModal } from "@/components/CreateCaseModal";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getAllUsers, getCases, getClients } from "@/lib/api";
import { AdminUser, CaseEntry, ClientEntry } from "@/lib/types";

export default function DashboardPage() {
  const { token, user } = useAuth();
  const [cases, setCases] = useState<CaseEntry[]>([]);
  const [clients, setClients] = useState<ClientEntry[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setIsLoading(true);
        const [nextCases, nextClients, nextUsers] = await Promise.all([
          getCases(token),
          getClients(token),
          user?.role === "admin" ? getAllUsers(token) : Promise.resolve([])
        ]);
        setCases(nextCases);
        setClients(nextClients);
        setUsers(Array.isArray(nextUsers) ? (nextUsers as AdminUser[]) : []);
      } catch (dashboardError) {
        setError(dashboardError instanceof Error ? dashboardError.message : "Failed to load cases.");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [token, user?.role]);

  const pendingUsers = users.filter((entry) => !entry.is_approved || entry.role === "pending");

  return (
    <ProtectedRoute allowedRoles={["admin", "lawyer", "assistant"]}>
      <section className="dashboard-main">
        {error ? <p className="field-note error">{error}</p> : null}

        <section className="panel">
          <div className="panel-head">
            <h3>Main Menu</h3>
          </div>
          <div className="main-ops-grid">
            <article className="module-card">
              <h4>Add a New Case</h4>
              <p>Create a case with clients, status, notes, and placeholders.</p>
              <div className="hero-case-action">
                {(user?.role === "admin" || user?.role === "lawyer") && (
                  <button type="button" onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
                    New Case
                  </button>
                )}
              </div>
            </article>

            <article className="module-card">
              <h4>Case Overview</h4>
              <p>Review accessible cases, deadlines, owners, and current workload at a glance.</p>
              <div className="hero-case-action" style={{ placeItems: "start" }}>
                <div className="status-inline">
                  <p className="label">Accessible Cases</p>
                  <h2 style={{ margin: "0.3rem 0 0", fontSize: "2rem" }}>{cases.length}</h2>
                  <p className="field-note" style={{ marginTop: "0.45rem" }}>
                    {cases.filter((entry) => Boolean(entry.can_edit)).length} editable for your role
                  </p>
                </div>
              </div>
            </article>

            {user?.role === "admin" ? (
              <article className="module-card">
                <h4>Team & Roles</h4>
                <p>Approve pending registrations and assign the right internal role.</p>
                <div className="admin-main-card-body">
                  <p className="admin-main-count">
                    <strong>{pendingUsers.length}</strong> pending approval
                  </p>
                  <Link href="/admin/users" className="btn-primary" style={{ display: "inline-flex", justifyContent: "center" }}>
                    Manage Roles
                  </Link>
                </div>
              </article>
            ) : null}
          </div>
        </section>

        <section className="grid-2">
          <article className="panel">
            <div className="panel-head">
              <h3>Recent Cases</h3>
              <Link href="/cases" className="btn-ghost">
                View All
              </Link>
            </div>
            <ul className="list">
              {isLoading ? <li>Loading cases...</li> : null}
              {!isLoading &&
                cases.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="case-row-clickable">
                    <Link href={`/cases/${entry.id}`} style={{ display: "contents" }}>
                      <div>
                        <strong>{entry.name}</strong>
                        <p className="meta">
                          {entry.client_name || "Unknown client"} | Deadline: {entry.deadline || "Not set"}
                        </p>
                        <p className="case-comment">{entry.short_description || "No description available."}</p>
                      </div>
                      <div className="case-actions">
                        {entry.is_owner ? <span className="badge success">Owner</span> : null}
                        {entry.is_assigned ? <span className="badge">Assigned</span> : null}
                        <span className="badge">{entry.status || "Active"}</span>
                      </div>
                    </Link>
                  </li>
                ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-head">
              <h3>Recent Clients</h3>
              <Link href="/clients" className="btn-ghost">
                View All
              </Link>
            </div>
            <ul className="list">
              {clients.slice(0, 6).map((client) => (
                <li key={client.id}>
                  <div>
                    <strong>{client.full_name}</strong>
                    <p className="meta">{client.email || client.phone || "No contact details yet"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </section>

        <section className="kpi-grid">
          <article className="card">
            <p className="label">Active Cases</p>
            <h2>{cases.filter((entry) => (entry.status || "").toLowerCase() !== "finished").length}</h2>
          </article>
          <article className="card">
            <p className="label">Clients</p>
            <h2>{clients.length}</h2>
          </article>
          <article className="card">
            <p className="label">Deadlines This Week</p>
            <h2>{cases.filter((entry) => Boolean(entry.deadline)).length}</h2>
          </article>
          <article className="card">
            <p className="label">Editable Cases</p>
            <h2>{cases.filter((entry) => Boolean(entry.can_edit)).length}</h2>
          </article>
        </section>

        {isCreateModalOpen && token ? (
          <CreateCaseModal
            token={token}
            isOpen={isCreateModalOpen}
            clients={clients}
            onClose={() => setIsCreateModalOpen(false)}
            onClientsUpdated={setClients}
            onCaseCreated={(createdCase) => {
              setCases((current) => [
                {
                  ...createdCase,
                  client_name:
                    clients.find((client) => String(client.id) === String(createdCase.client_id))?.full_name || "",
                  is_owner: true,
                  is_assigned: false,
                  can_edit: true
                },
                ...current
              ]);
            }}
          />
        ) : null}
      </section>
    </ProtectedRoute>
  );
}
