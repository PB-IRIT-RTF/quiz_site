import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { cn } from "@/utils/cn";
import { api } from "@/lib/api";
import type { MeRole } from "@/lib/api/types";

function TopNavLink({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "rounded-lg px-3 py-2 text-sm font-medium transition",
          isActive ? "bg-[#79CBF7] text-[#1f3340]" : "text-[var(--event-ink)] hover:bg-[#dff2fd]"
        )
      }
    >
      {label}
    </NavLink>
  );
}

export function AppLayout() {
  const loc = useLocation();
  const [role, setRole] = useState<MeRole>("anonymous");

  useEffect(() => {
    let mounted = true;

    api
      .me()
      .then((r) => {
        if (mounted) setRole(r.role);
      })
      .catch(() => {
        if (mounted) setRole("anonymous");
      });

    return () => {
      mounted = false;
    };
  }, [loc.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-[var(--event-border)] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="leading-tight">
              <div className="text-sm font-semibold text-black">Вселенная ИРИТ-РТФ</div>
              <div className="text-xs text-[var(--event-ink-soft)]">Квиз-платформа</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <TopNavLink to="/" label="Главная" />
            <TopNavLink to="/leaderboard" label="Лидерборд" />

            {role === "admin" ? <TopNavLink to="/admin" label="Админ" /> : null}

            {role === "anonymous" ? <TopNavLink to="/register" label="Регистрация" /> : null}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-transparent">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-[var(--event-ink-soft)]">
          <div>© {new Date().getFullYear()} «Союз студентов ИРИТ-РТФ»</div>
        </div>
      </footer>
    </div>
  );
}
