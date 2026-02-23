import React from "react";
import { Navigate } from "react-router-dom";
import { api } from "@/lib/api";

type Role = "admin" | "participant" | "anonymous";

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<Role | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        setRole((me?.role as Role) ?? "anonymous");
      } catch {
        setRole("anonymous");
      }
    })();
  }, []);

  if (role === null) return null; // можно лоадер
  if (role !== "admin") return <Navigate to="/admin/login" replace />;
  return <>{children}</>;
}