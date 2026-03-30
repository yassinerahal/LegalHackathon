"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function NavigationBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  if (pathname === "/login") {
    return null;
  }

  const navLinks =
    user?.role === "client"
      ? [
          { href: "/portal/profile", label: "Profile" },
          { href: "/portal/cases", label: "My Cases" },
          { href: "/portal/timeline", label: "Timeline" }
        ]
      : [
          { href: "/dashboard", label: "Dashboard" },
          { href: "/cases", label: "Cases" },
          { href: "/clients", label: "Clients" },
          ...(user?.role === "admin" ? [{ href: "/admin/users", label: "Users" }] : [])
        ];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <header className="topbar">
      <Link href={user?.role === "client" ? "/portal/profile" : "/dashboard"} className="brand brand-link">
        <img src="/icons/logo.png" alt="NEXTACT logo" className="brand-logo-image" />
        <div className="brand-copy">
          <h1>NEXTACT</h1>
          <p>{user?.role === "client" ? "Remote access portal" : "Legal operations dashboard"}</p>
        </div>
      </Link>
      <div className="topbar-nav">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${pathname === link.href ? "active" : ""}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="topbar-actions">
        <div className="gtranslate_wrapper" />
        <div className="header-user">
          {user?.full_name || user?.email || "User"}
          <span className="header-user-role">{user?.role || "guest"}</span>
        </div>
        {user?.role !== "client" ? (
          <button type="button" onClick={() => router.push("/dashboard")} className="icon-btn">
            Dashboard
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="icon-btn"
        >
          Logout
        </button>
      </div>
    </header>
  );
}
