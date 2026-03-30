"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { loginRequest } from "@/lib/api";
import { decodeJwtPayload, isTokenExpired } from "@/lib/jwt";
import { AuthResponse, AuthUser } from "@/lib/types";

const AUTH_STORAGE_KEY = "nextact_auth_session";
const JWT_STORAGE_KEY = "nextact_jwt";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (credentials: { identifier: string; password: string }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function persistAuthSession(data: AuthResponse) {
  localStorage.setItem(JWT_STORAGE_KEY, data.token);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data.user));
}

function clearAuthSession() {
  localStorage.removeItem(JWT_STORAGE_KEY);
  localStorage.removeItem(AUTH_STORAGE_KEY);
}

function hydrateUserFromToken(token: string): AuthUser | null {
  const payload = decodeJwtPayload<{
    id?: number;
    user_id?: number;
    email?: string;
    role?: AuthUser["role"];
    is_approved?: boolean;
    client_id?: number | null;
  }>(token);

  if (!payload?.role) {
    return null;
  }

  return {
    id: Number(payload.user_id || payload.id || 0),
    email: payload.email || "",
    role: payload.role,
    is_approved: Boolean(payload.is_approved),
    client_id: payload.client_id ?? null
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(JWT_STORAGE_KEY);
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);

    if (!storedToken || isTokenExpired(storedToken)) {
      clearAuthSession();
      setIsLoading(false);
      return;
    }

    const decodedUser = hydrateUserFromToken(storedToken);
    if (!decodedUser) {
      clearAuthSession();
      setIsLoading(false);
      return;
    }

    setToken(storedToken);
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
      } catch (error) {
        setUser(decodedUser);
      }
    } else {
      setUser(decodedUser);
    }

    setIsLoading(false);
  }, []);

  const login = async (credentials: { identifier: string; password: string }) => {
    const result = await loginRequest(credentials);
    persistAuthSession(result);
    setToken(result.token);
    setUser(result.user);
  };

  const logout = () => {
    clearAuthSession();
    setUser(null);
    setToken(null);
  };

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      logout
    }),
    [user, token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
