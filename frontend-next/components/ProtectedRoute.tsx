"use client";

import { ReactNode, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: Array<"admin" | "lawyer" | "assistant" | "client">;
};

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { isLoading, token, user } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!token || !user) {
      router.replace("/login");
      return;
    }

    if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
      router.replace("/dashboard");
    }
  }, [allowedRoles, isLoading, router, token, user]);

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500">Loading session...</div>;
  }

  if (!token || !user) {
    return null;
  }

  if (allowedRoles?.length && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}
