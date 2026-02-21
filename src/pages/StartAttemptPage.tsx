import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import type { AttemptStatus } from "@/lib/api/types";

export function StartAttemptPage() {
  const nav = useNavigate();
  const [status, setStatus] = useState<AttemptStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    // Попытка: если уже in_progress/finished — сразу поведём дальше
    api
      .getCurrentQuestion()
      .then((r) => {
        setStatus(r.attempt_status);
        if (r.attempt_status === "in_progress") nav("/play", { replace: true });
        if (r.attempt_status === "finished" || r.attempt_status === "forced_finished") nav("/result", { replace: true });
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) {
          nav("/register", { replace: true });
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
      });
  }, [nav]);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await api.startAttempt();
      setStatus(res.status);
      if (res.status === "in_progress") nav("/play");
      else nav("/result");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        nav("/register", { replace: true });
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Старт квиза</h1>
        <p className="mt-1 text-sm text-slate-600">Перед началом убедитесь, что у вас стабильный интернет.</p>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <div>• Пройти квиз можно только один раз.</div>
          <div>• Назад возвращаться нельзя, пропускать можно.</div>
          <div>• Таймер (если задан) — серверный. При истечении будет авто‑сабмит и переход дальше.</div>
        </div>

        {status === "registered" ? (
          <div className="mt-4">
            <Alert variant="warning">Вы зарегистрированы, но попытка ещё не начата.</Alert>
          </div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">Ошибка: {error}</Alert>
          </div>
        ) : null}

        <div className="mt-5 flex gap-2">
          <Button onClick={start} disabled={starting}>
            {starting ? "Запускаем…" : "Начать"}
          </Button>
          <Button variant="secondary" onClick={() => nav("/leaderboard")}>Лидерборд</Button>
        </div>

        <div className="mt-4 text-xs text-slate-500">Если вкладка будет закрыта — прогресс сохранится на сервере.</div>
      </Card>
    </div>
  );
}
