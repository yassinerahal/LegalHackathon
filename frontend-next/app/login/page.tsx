"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, user, token } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && user && token) {
      router.replace("/dashboard");
    }
  }, [isLoading, router, token, user]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    try {
      await login({ identifier, password });
      router.push("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
    }
  };

  return (
    <section className="auth-wrap">
      <div className="panel auth-card">
        <p className="field-note">Secure access</p>
        <h2 style={{ margin: "0.35rem 0 0", fontSize: "2rem" }}>Sign in to NextAct</h2>
        <p className="meta" style={{ marginTop: "0.6rem" }}>
          Use your existing backend account and JWT-based session.
        </p>

        <form onSubmit={handleSubmit} className="modal-form" style={{ marginTop: "1.2rem" }}>
          <div>
            <label htmlFor="identifier">Email</label>
            <input
              id="identifier"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="admin@nextact.local"
            />
          </div>

          <div>
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
            />
          </div>

          {error ? <p className="field-note error">{error}</p> : null}

          <button type="submit" className="btn-primary" style={{ width: "100%" }}>
            Sign In
          </button>
        </form>
      </div>
    </section>
  );
}
