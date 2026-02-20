import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { ActiveQuizResponse } from "@/lib/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { isRegistered } from "@/lib/session";

export function LandingPage() {
  const nav = useNavigate();
  const [data, setData] = useState<ActiveQuizResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    api
      .getActiveQuiz()
      .then((d) => mounted && setData(d))
      .catch((e) => mounted && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      mounted = false;
    };
  }, []);

  const stateLabel = useMemo(() => {
    if (!data) return "Загрузка…";
    switch (data.state) {
      case "running":
        return "Квиз идёт";
      case "not_started":
        return "Квиз ещё не начался";
      case "ended":
        return "Квиз завершён";
      case "unpublished":
        return "Квиз не опубликован";
      case "none":
        return "Квиз не найден";
    }
  }, [data]);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Вселенная ИРИТ‑РТФ — квиз</h1>
            <p className="mt-1 text-sm text-slate-600">
              Участник регистрируется и может пройти квиз только один раз. После завершения — итог и место, без
              раскрытия правильных ответов.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!isRegistered() ? (
              <Button onClick={() => nav("/register")}>Регистрация</Button>
            ) : (
              <>
                <Button onClick={() => nav("/start")}>К старту</Button>
                <Button variant="secondary" onClick={() => nav("/leaderboard")}>Лидерборд</Button>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Состояние</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{stateLabel}</div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs text-slate-500">Лидерборд</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">Top‑20 + «моё место» после финиша</div>
          </div>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">Не удалось получить состояние квиза: {error}</Alert>
          </div>
        ) : null}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-slate-900">Как это работает</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Зарегистрируйтесь (ФИО, группа, VK).</li>
          <li>Нажмите «Начать» — создаётся попытка (только одна).</li>
          <li>Отвечайте на вопросы: single/multi/text. Назад нельзя, пропускать можно.</li>
          <li>Если на вопрос есть таймер — по истечению будет авто‑сабмит и переход дальше.</li>
          <li>После завершения — покажем итог и место.</li>
        </ol>

        <div className="mt-4 text-xs text-slate-500">
          Во время квиза не обновляйте страницу без необходимости — прогресс фиксируется на сервере.
        </div>
      </Card>
    </div>
  );
}
