import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Alert } from "@/components/Alert";
import type { LeaderboardRow, LeaderboardResponse } from "@/lib/api/types";

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const total = Math.max(0, ms);
  const s = Math.floor(total / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return m > 0 ? `${m}:${String(ss).padStart(2, "0")}` : `${ss}s`;
}

export function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await api.getLeaderboard(50);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const myRank = useMemo(() => (data?.me ? data.me.rank : null), [data]);

  const rows = useMemo(() => data?.top ?? [], [data]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Таблица лидеров</h1>
          <p className="mt-1 text-sm text-slate-600">Рейтинг по баллам, если баллы равны, то по времени.</p>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : null}

        {!data ? (
          <div className="mt-4">
            <Alert variant="info">Загрузка…</Alert>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-4">
            <Alert variant="info">Пока нет результатов.</Alert>
          </div>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
            <div className="grid grid-cols-[64px_1fr_96px_96px] gap-0 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div>#</div>
              <div>Участник</div>
              <div className="text-right">Баллы</div>
              <div className="text-right">Время</div>
            </div>

            <div className="divide-y divide-slate-200 bg-white">
              {rows.map((r: LeaderboardRow) => {
                const isMe = myRank != null && r.rank === myRank;
                return (
                  <div
                    key={`${r.rank}-${r.display_name}`}
                    className={[
                      "grid grid-cols-[64px_1fr_96px_96px] items-center px-4 py-3 text-sm",
                      isMe ? "bg-slate-50" : "",
                    ].join(" ")}
                  >
                    <div className="text-slate-600">{r.rank}</div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-900">{r.display_name}</div>
                      {isMe ? <div className="mt-1 text-xs text-slate-500">это ты :)</div> : null}
                    </div>
                    <div className="text-right font-semibold text-slate-900">{r.score}</div>
                    <div className="text-right text-slate-700">{fmtMs(r.total_time_ms)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}