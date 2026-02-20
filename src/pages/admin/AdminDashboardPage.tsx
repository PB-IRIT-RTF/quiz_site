import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";

export function AdminDashboardPage() {
  const nav = useNavigate();
  const loader = useCallback(() => api.adminStatsSummary(), []);
  const { data, error, loading, reload } = usePolling(loader, 3000, true);

  const logout = async () => {
    await api.adminLogout();
    nav("/admin");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Админ‑дашборд (минимум)</h1>
            <p className="mt-1 text-sm text-slate-600">Здесь будут CRUD квиза/вопросов/медиа и экспорт CSV. Сейчас — только статистика.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void reload()}>
              {loading ? "…" : "Обновить"}
            </Button>
            <Button variant="danger" onClick={() => void logout()}>
              Выйти
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">
              Нет доступа к статистике. Скорее всего, вы не залогинены как админ. ({error instanceof Error ? error.message : String(error)})
            </Alert>
            <div className="mt-3">
              <Button onClick={() => nav("/admin")}>Перейти к логину</Button>
            </div>
          </div>
        ) : null}

        {data ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">registered</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{data.registered}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">started</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{data.started}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">in_progress</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{data.in_progress}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">finished</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{data.finished}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs text-slate-500">forced_finished</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{data.forced_finished}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-5">
          <Alert variant="warning">
            В этом демо CRUD‑редактор не реализован. Под реальный FastAPI бэкенд интерфейс расширяется без смены роутинга.
          </Alert>
        </div>
      </Card>
    </div>
  );
}
