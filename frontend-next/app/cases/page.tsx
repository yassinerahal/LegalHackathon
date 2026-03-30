"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getCases } from "@/lib/api";
import { CaseEntry } from "@/lib/types";

export default function CasesPage() {
  const { token } = useAuth();
  const [cases, setCases] = useState<CaseEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setCases(await getCases(token));
      } catch (casesError) {
        setError(casesError instanceof Error ? casesError.message : "Failed to load cases.");
      }
    })();
  }, [token]);

  return (
    <ProtectedRoute allowedRoles={["admin", "lawyer", "assistant"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>All Cases</h3>
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          <ul className="list">
            {cases.map((entry) => (
              <li key={entry.id} className="case-row-clickable">
                <Link href={`/cases/${entry.id}`} style={{ display: "contents" }}>
                  <div>
                    <strong>{entry.name}</strong>
                    <p className="meta">
                      {entry.client_name || "Unknown client"} • Deadline: {entry.deadline || "Not set"}
                    </p>
                    <p className="case-comment">{entry.short_description || "No description"}</p>
                  </div>
                  <div className="case-actions">
                    {entry.is_owner ? <span className="badge success">Owner</span> : null}
                    {entry.is_assigned ? <span className="badge">Assigned</span> : null}
                    <span className="badge">{entry.status || "Open"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </ProtectedRoute>
  );
}
