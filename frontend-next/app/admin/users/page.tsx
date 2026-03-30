"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getAllUsers, updateUserRole } from "@/lib/api";
import { AdminUser } from "@/lib/types";

const ROLE_OPTIONS: Array<AdminUser["role"]> = ["lawyer", "assistant", "client", "admin"];

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [draftRoles, setDraftRoles] = useState<Record<number, AdminUser["role"]>>({});
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        const nextUsers = await getAllUsers(token);
        setUsers(nextUsers);
        setDraftRoles(
          Object.fromEntries(
            nextUsers.map((user) => [user.id, user.role === "pending" ? "assistant" : user.role])
          ) as Record<number, AdminUser["role"]>
        );
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load users.");
      }
    })();
  }, [token]);

  const handleSaveRole = async (userId: number) => {
    if (!token) return;

    try {
      setError(null);
      setStatus("Updating role...");
      const nextRole = draftRoles[userId];
      const result = await updateUserRole(userId, nextRole, token);
      setUsers((current) => current.map((user) => (user.id === userId ? result.user : user)));
      setStatus("Role updated successfully.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to update role.");
      setStatus(null);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>Team & Roles</h3>
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          {status ? <p className="field-note success">{status}</p> : null}
          <ul className="list">
            {users.map((user) => (
              <li key={user.id}>
                <div>
                  <strong>{user.full_name || user.username || user.email}</strong>
                  <p className="meta">
                    {user.email} • {user.is_approved ? "Approved" : "Pending approval"}
                  </p>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={draftRoles[user.id] || user.role}
                    onChange={(event) =>
                      setDraftRoles((current) => ({
                        ...current,
                        [user.id]: event.target.value as AdminUser["role"]
                      }))
                    }
                    style={{ minWidth: "160px" }}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => handleSaveRole(user.id)} className="btn-primary">
                    Save Role
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </ProtectedRoute>
  );
}
