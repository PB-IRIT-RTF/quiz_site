import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import type { AnswerCurrentQuestionRequest, CurrentQuestionResponse, QuestionPublicDto } from "@/lib/api/types";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Textarea } from "@/components/Textarea";
import { MediaGallery } from "@/components/MediaGallery";
import { useInterval } from "@/hooks/useInterval";
import { clamp } from "@/lib/format";

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>
          Вопрос {current} / {total}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full bg-slate-900" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function PlayPage() {
  const nav = useNavigate();
  const [resp, setResp] = useState<CurrentQuestionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // локальное состояние ответа
  const [single, setSingle] = useState<string | null>(null);
  const [multi, setMulti] = useState<Set<string>>(new Set());
  const [text, setText] = useState<string>("");

  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const lastQuestionIdRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const r = await api.getCurrentQuestion();
    setResp(r);
    setTimeLeft(r.time_left_seconds);

    if (r.attempt_status === "registered") {
      nav("/start", { replace: true });
      return;
    }

    if (r.attempt_status === "finished" || r.attempt_status === "forced_finished") {
      nav("/result", { replace: true });
      return;
    }

    const qid = r.question?.id ?? null;
    if (qid && lastQuestionIdRef.current !== qid) {
      // новый вопрос — сброс локального ответа
      lastQuestionIdRef.current = qid;
      setSingle(null);
      setMulti(new Set());
      setText("");
    }
  }, [nav]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [load]);

  // серверный таймер: синхронизируемся каждую секунду; если timeLeft == 0 -> отправляем текущий ответ (или пустой)
  useInterval(() => {
    setTimeLeft((prev) => {
      if (prev == null) return null;
      return clamp(prev - 1, 0, prev);
    });
  }, 1000);

  // периодическая сверка с сервером (и автопереход на следующий вопрос после таймаута)
  useInterval(() => {
    load().catch(() => {
      // игнорируем кратковременные ошибки
    });
  }, 1500);

  const q = resp?.question ?? null;

  const canSubmit = useMemo(() => {
    if (!q) return false;
    if (q.type === "single") return true; // можно и пустое, если пользователь не выбрал
    if (q.type === "multi") return true;
    return true;
  }, [q]);

  const buildAnswer = (q: QuestionPublicDto): AnswerCurrentQuestionRequest => {
    if (q.type === "single") {
      return { question_id: q.id, type: q.type, option_ids: single ? [single] : [] };
    }
    if (q.type === "multi") {
      return { question_id: q.id, type: q.type, option_ids: [...multi] };
    }
    return { question_id: q.id, type: q.type, text };
  };

  const submit = async () => {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      await api.answerCurrentQuestion(buildAnswer(q));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // при 409/устаревшем вопросе просто перезагрузимся
      await load().catch(() => null);
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (!q) return;
    setBusy(true);
    setError(null);
    try {
      await api.skipCurrentQuestion(q.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await load().catch(() => null);
    } finally {
      setBusy(false);
    }
  };

  // авто-сабмит при достижении 0 на клиенте (дублирует серверную логику, но улучшает UX)
  useEffect(() => {
    if (!q) return;
    if (q.time_limit_seconds == null) return;
    if (timeLeft !== 0) return;
    if (busy) return;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, q?.id]);

  if (!resp) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>Загрузка…</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <ProgressBar current={resp.progress.current} total={resp.progress.total} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs text-slate-500">Таймер</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {q?.time_limit_seconds == null ? "без лимита" : `${timeLeft ?? q?.time_limit_seconds}s`}
            </div>
          </div>
        </div>
      </Card>

      {error ? (
        <Alert variant="danger">Ошибка: {error}</Alert>
      ) : null}

      {!q ? (
        <Card>
          <div className="text-sm text-slate-700">Вопросов нет или попытка завершена.</div>
          <div className="mt-4">
            <Button onClick={() => nav("/result")}>К результатам</Button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="space-y-4">
            <div>
              <div className="text-xs text-slate-500">Вопрос #{q.order}</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{q.text}</div>
            </div>

            <MediaGallery media={q.media} />

            <div className="space-y-2">
              {q.type === "single" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50">
                      <input
                        type="radio"
                        name={`q-${q.id}`}
                        className="mt-1"
                        checked={single === o.id}
                        onChange={() => setSingle(o.id)}
                      />
                      <div className="text-sm text-slate-800">{o.text}</div>
                    </label>
                  ))}
                </div>
              ) : null}

              {q.type === "multi" && q.options ? (
                <div className="space-y-2">
                  {q.options.map((o) => {
                    const checked = multi.has(o.id);
                    return (
                      <label key={o.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-3 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={checked}
                          onChange={() => {
                            setMulti((prev) => {
                              const next = new Set(prev);
                              if (next.has(o.id)) next.delete(o.id);
                              else next.add(o.id);
                              return next;
                            });
                          }}
                        />
                        <div className="text-sm text-slate-800">{o.text}</div>
                      </label>
                    );
                  })}
                </div>
              ) : null}

              {q.type === "text" ? (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-900">Ответ</div>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Введите ответ…" />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={submit} disabled={!canSubmit || busy}>
                {busy ? "Отправляем…" : "Ответить"}
              </Button>
              <Button variant="secondary" onClick={skip} disabled={busy}>
                Пропустить
              </Button>
              <Button variant="ghost" onClick={() => nav("/leaderboard")} disabled={busy}>
                Лидерборд
              </Button>
            </div>

            <div className="text-xs text-slate-500">Назад нельзя. Пропуск не даёт баллов.</div>
          </Card>
        </>
      )}
    </div>
  );
}
