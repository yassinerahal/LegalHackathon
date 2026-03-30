"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
import { getRemoteUserProfile } from "@/lib/api";
import { ClientEntry } from "@/lib/types";

export default function RemoteProfilePage() {
  const { token } = useAuth();
  const [profile, setProfile] = useState<ClientEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    (async () => {
      try {
        setProfile(await getRemoteUserProfile(token));
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : "Failed to load profile.");
      }
    })();
  }, [token]);

  return (
    <ProtectedRoute allowedRoles={["client"]}>
      <section className="dashboard-main">
        <section className="panel">
          <div className="panel-head">
            <h3>Your Profile</h3>
          </div>
          {error ? <p className="field-note error">{error}</p> : null}
          <div className="grid-2">
            <article className="card">
              <p className="label">Full name</p>
              <h2 style={{ fontSize: "1.25rem" }}>{profile?.full_name || "Loading..."}</h2>
            </article>
            <article className="card">
              <p className="label">Email</p>
              <h2 style={{ fontSize: "1.25rem" }}>{profile?.email || "Not set"}</h2>
            </article>
            <article className="card">
              <p className="label">Phone</p>
              <h2 style={{ fontSize: "1.25rem" }}>{profile?.phone || "Not set"}</h2>
            </article>
            <article className="card">
              <p className="label">Address</p>
              <h2 style={{ fontSize: "1.25rem" }}>
                {profile?.address || profile?.city || profile?.state
                  ? `${profile?.address || ""} ${profile?.city || ""} ${profile?.state || ""}`.trim()
                  : "Not set"}
              </h2>
            </article>
          </div>
        </section>
      </section>
    </ProtectedRoute>
  );
}
