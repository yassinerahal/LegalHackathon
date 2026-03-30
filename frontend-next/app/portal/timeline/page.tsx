"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getRemoteUserTimeline } from "@/lib/api";
import { RemoteTimelineEvent } from "@/lib/types";

export default function RemoteTimelinePage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<RemoteTimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setEvents(await getRemoteUserTimeline(token));
      } catch (timelineError) {
        setError(timelineError instanceof Error ? timelineError.message : "Failed to load timeline.");
      }
    })();
  }, [token]);

  return (
    <ProtectedRoute allowedRoles={["client"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>Timeline</h3>
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          <ul className="list">
            {events.map((event, index) => (
              <li key={`${event.case_id}-${event.kind}-${index}`}>
                <div>
                  <strong>{event.title}</strong>
                  <p className="meta">{event.case_name}</p>
                  <p className="case-comment">{event.description}</p>
                </div>
                <span className="badge">{new Date(event.occurred_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </ProtectedRoute>
  );
}
