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
          isActive ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="leading-tight">
              <div className="text-sm font-semibold text-slate-900">Вселенная ИРИТ‑РТФ</div>
              <div className="text-xs text-slate-500">Квиз‑платформа</div>
            </div>
          </div>

          <nav className="flex items-center gap-2">
            <TopNavLink to="/" label="Главная" />
            <TopNavLink to="/leaderboard" label="Лидерборд" />
            {role === "admin" ? (
              <>
                <TopNavLink to="/admin" label="Админ" />
                <TopNavLink to="/admin/dashboard" label="Дашборд" />
              </>
            ) : (
              <TopNavLink to="/register" label="Регистрация" />
            )}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} «Вселенная ИРИТ‑РТФ»</div>
          <div className="mt-1">Во время мероприятия не обновляйте страницу без необходимости — прогресс хранится на сервере.</div>
        </div>
      </footer>
    </div>
  );
}
