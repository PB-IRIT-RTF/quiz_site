import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { ResultResponse } from "@/lib/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { msToHuman } from "@/lib/format";

export function ResultPage() {
  const nav = useNavigate();
  const [res, setRes] = useState<ResultResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getResult()
      .then(setRes)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  if (error) {
    return <Alert variant="danger">Ошибка: {error}</Alert>;
  }

  if (!res) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>Загрузка…</Card>
      </div>
    );
  }

  const finished = res.status === "finished" || res.status === "forced_finished";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Результат</h1>
        <p className="mt-1 text-sm text-slate-600">
          {finished
            ? "Спасибо за участие! Правильные ответы не отображаются."
            : "Попытка ещё не завершена. Вернитесь к прохождению."}
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Статус</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{res.status}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Баллы</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{res.score}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Время</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {res.total_time_ms == null ? "—" : msToHuman(res.total_time_ms)}
            </div>
          </div>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Место</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{res.place ?? "—"}</div>
          <div className="mt-1 text-xs text-slate-500">Позиция рассчитывается только после завершения попытки.</div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {res.status === "in_progress" ? (
            <Button onClick={() => nav("/play")}>Продолжить</Button>
          ) : (
            <Button onClick={() => nav("/leaderboard")}>Открыть лидерборд</Button>
          )}
          <Button variant="secondary" onClick={() => nav("/")}>На главную</Button>
        </div>
      </Card>
    </div>
  );
}
