import { useCallback } from "react";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import { api } from "@/lib/api";
import { usePolling } from "@/hooks/usePolling";
import { msToHuman } from "@/lib/format";

export function LeaderboardPage() {
  const loader = useCallback(() => api.getLeaderboard(20), []);
  const { data, error, loading, reload } = usePolling(loader, 4000, true);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Лидерборд</h1>
            <p className="mt-1 text-sm text-slate-600">Top‑20 обновляется по мере финиша участников (finished/forced_finished).</p>
          </div>
          <button
            onClick={() => void reload()}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {loading ? "Обновляем…" : "Обновить"}
          </button>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">Ошибка: {error instanceof Error ? error.message : String(error)}</Alert>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Участник</th>
                <th className="px-4 py-3">Баллы</th>
                <th className="px-4 py-3">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(data?.top ?? []).map((r) => (
                <tr key={r.rank} className="bg-white">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.rank}</td>
                  <td className="px-4 py-3 text-slate-800">{r.display_name}</td>
                  <td className="px-4 py-3 text-slate-800">{r.score}</td>
                  <td className="px-4 py-3 text-slate-800">{msToHuman(r.total_time_ms)}</td>
                </tr>
              ))}
              {(data?.top?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Пока нет завершённых попыток.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <Alert variant="info">
            <div className="font-medium">Ваш статус: {data?.me_status ?? "—"}</div>
            <div className="mt-1 text-xs">«Моё место» доступно только после завершения попытки.</div>
          </Alert>
        </div>

        {data?.me ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">Моё место</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <div className="text-lg font-semibold text-slate-900">#{data.me.rank}</div>
              <div className="text-sm text-slate-700">{data.me.display_name}</div>
              <div className="text-sm text-slate-700">Баллы: {data.me.score}</div>
              <div className="text-sm text-slate-700">Время: {msToHuman(data.me.total_time_ms)}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 text-xs text-slate-500">Публично отображается только «Фамилия И.О.»</div>
      </Card>
    </div>
  );
}
