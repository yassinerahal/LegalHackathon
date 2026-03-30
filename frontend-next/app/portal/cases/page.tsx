"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getRemoteUserCases } from "@/lib/api";
import { CaseEntry } from "@/lib/types";

export default function RemoteCasesPage() {
  const { token } = useAuth();
  const [cases, setCases] = useState<CaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setCases(await getRemoteUserCases(token));
      } catch (casesError) {
        setError(casesError instanceof Error ? casesError.message : "Failed to load cases.");
      }
    })();
  }, [token]);

  return (
    <ProtectedRoute allowedRoles={["client"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>My Cases</h3>
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          <ul className="list">
            {cases.map((entry) => (
              <li key={entry.id}>
                <div>
                  <strong>{entry.name}</strong>
                  <p className="meta">Deadline: {entry.deadline || "Not set"}</p>
                  <p className="case-comment">{entry.short_description || "No description"}</p>
                </div>
                <span className="badge">{entry.status || "Open"}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </ProtectedRoute>
  );
}
