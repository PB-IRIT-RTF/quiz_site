import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { Input } from "@/components/Input";
import { Textarea } from "@/components/Textarea";
import type {
  AdminAttemptAnswerDto,
  AdminAttemptRowDto,
  AdminQuestionDto,
  AdminQuizDto,
  MediaKind,
  MediaSourceType,
  QuestionType,
} from "@/lib/api/types";

type Tab = "quiz" | "questions" | "results";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// datetime-local (local time) <-> ISO string
function toIsoFromDatetimeLocal(v: string): string {
  return new Date(v).toISOString();
}
function toDatetimeLocalFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtMs(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m}:${pad2(s)}` : `${s}s`;
}

function formatDateTime(isoOrNull: string | null): string {
  if (!isoOrNull) return "—";
  const d = new Date(isoOrNull);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function prettyAnswer(ans: AdminAttemptAnswerDto, optionTextById: Map<string, string>): React.ReactNode {
  const j = ans.answer_json ?? {};
  const optionIds = Array.isArray((j as any).option_ids) ? ((j as any).option_ids as any[]) : [];
  const text = typeof (j as any).text === "string" ? ((j as any).text as string) : null;
  const skipped = Boolean((j as any).skipped);

  return (
    <div className="space-y-2">
      <div className="text-xs text-slate-500">
        Баллы: <span className="text-slate-900">{ans.awarded_points}</span>{" "}
        · Правильно: <span className="text-slate-900">{ans.is_correct ? "да" : "нет"}</span>{" "}
        · Время: <span className="text-slate-900">{fmtMs(ans.time_spent_ms)}</span>
      </div>

      {skipped ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Пропущено
        </div>
      ) : null}

      {text != null ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 whitespace-pre-wrap">
          {text.trim().length ? text : "—"}
        </div>
      ) : null}

      {optionIds.length ? (
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900">
          <div className="text-xs text-slate-500 mb-1">Выбранные варианты:</div>
          <div className="flex flex-wrap gap-2">
            {optionIds.map((x, idx) => (
              <span
                key={`${String(x)}-${idx}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-800"
              >
                {optionTextById.get(String(x)) ?? ("ID " + String(x))}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {!skipped && text == null && optionIds.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Пустой ответ
        </div>
      ) : null}
    </div>
  );
}

export function AdminDashboardPage() {
  const [tab, setTab] = useState<Tab>("quiz");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quizzes, setQuizzes] = useState<AdminQuizDto[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const selectedQuiz = useMemo(
    () => quizzes.find((q) => String(q.id) === String(selectedQuizId)) ?? null,
    [quizzes, selectedQuizId]
  );

  // quiz form
  const [quizTitle, setQuizTitle] = useState("");
  const [quizStartLocal, setQuizStartLocal] = useState("");
  const [quizEndLocal, setQuizEndLocal] = useState("");
  const [quizPublished, setQuizPublished] = useState(false);

  // questions
  const [questions, setQuestions] = useState<AdminQuestionDto[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const selectedQuestion = useMemo(
    () => questions.find((q) => String(q.id) === String(selectedQuestionId)) ?? null,
    [questions, selectedQuestionId]
  );
  const optionTextById = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of questions) {
      for (const o of q.options ?? []) map.set(String(o.id), o.text);
    }
    return map;
  }, [questions]);

  // question editor fields
  const [qType, setQType] = useState<QuestionType>("single");
  const [qText, setQText] = useState("");
  const [qPoints, setQPoints] = useState("1");
  const [qTimeLimit, setQTimeLimit] = useState(""); // empty => null

  // results
  const [attempts, setAttempts] = useState<AdminAttemptRowDto[]>([]);
  const [openAttemptId, setOpenAttemptId] = useState<string | null>(null);
  const [attemptAnswers, setAttemptAnswers] = useState<AdminAttemptAnswerDto[]>([]);

  const safeSetError = (e: unknown) => {
    setError(e instanceof Error ? e.message : String(e));
  };

  const loadQuizzes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListQuizzes();
      setQuizzes(data);
      if (!selectedQuizId && data.length) setSelectedQuizId(String(data[0].id));
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  }, [selectedQuizId]);

  const loadQuestions = useCallback(async (quizId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListQuestions(String(quizId));
      const sorted = data.slice().sort((a, b) => a.order - b.order);
      setQuestions(sorted);
      setSelectedQuestionId(sorted.length ? String(sorted[0].id) : null);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAttempts = useCallback(async (quizId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminListAttempts(String(quizId), 200, 0);
      setAttempts(data);
      setOpenAttemptId(null);
      setAttemptAnswers([]);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAttemptAnswers = useCallback(async (attemptId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.adminAttemptAnswers(String(attemptId));
      setAttemptAnswers(data);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuizzes();
  }, [loadQuizzes]);

  useEffect(() => {
    if (!selectedQuiz) return;
    setQuizTitle(selectedQuiz.title);
    setQuizStartLocal(toDatetimeLocalFromIso(selectedQuiz.start_at));
    setQuizEndLocal(toDatetimeLocalFromIso(selectedQuiz.end_at));
    setQuizPublished(Boolean(selectedQuiz.published));
  }, [selectedQuiz]);

  useEffect(() => {
    if (!selectedQuestion) return;
    setQType(selectedQuestion.type);
    setQText(selectedQuestion.text);
    setQPoints(String(selectedQuestion.points ?? 1));
    setQTimeLimit(selectedQuestion.time_limit_seconds == null ? "" : String(selectedQuestion.time_limit_seconds));
  }, [selectedQuestion]);

  useEffect(() => {
    if (!selectedQuizId) return;
    if (tab === "questions") void loadQuestions(selectedQuizId);
    if (tab === "results") {
      void loadQuestions(selectedQuizId);
      void loadAttempts(selectedQuizId);
    }
  }, [tab, selectedQuizId, loadQuestions, loadAttempts]);

  // -----------------------
  // Quiz actions
  // -----------------------
  const saveQuiz = async () => {
    if (!selectedQuizId) return;
    setLoading(true);
    setError(null);
    try {
      await api.adminUpdateQuiz(String(selectedQuizId), {
        title: quizTitle.trim(),
        start_at: toIsoFromDatetimeLocal(quizStartLocal),
        end_at: toIsoFromDatetimeLocal(quizEndLocal),
        published: quizPublished,
      });
      await loadQuizzes();
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const createQuiz = async () => {
    setLoading(true);
    setError(null);
    try {
      const created = await api.adminCreateQuiz({
        title: quizTitle.trim(),
        start_at: toIsoFromDatetimeLocal(quizStartLocal),
        end_at: toIsoFromDatetimeLocal(quizEndLocal),
        published: quizPublished,
      });
      await loadQuizzes();
      setSelectedQuizId(String(created.id));
      setTab("questions");
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuiz = async () => {
    if (!selectedQuizId) return;
    if (!window.confirm("Удалить квиз?")) return;
    setLoading(true);
    setError(null);
    try {
      await api.adminDeleteQuiz(String(selectedQuizId));
      setSelectedQuizId(null);
      setQuestions([]);
      setSelectedQuestionId(null);
      await loadQuizzes();
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Questions: reorder
  // -----------------------
  const reorderAndPersist = async (next: AdminQuestionDto[]) => {
    if (!selectedQuizId) return;
    setQuestions(next);
    setLoading(true);
    setError(null);
    try {
      await api.adminReorderQuestions?.(String(selectedQuizId), {
        ordered_question_ids: next.map((q) => Number(q.id)),
      } as any);
      // если у тебя нет adminReorderQuestions в api — добавь (ниже скажу как)
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const moveQuestion = async (qid: string, dir: -1 | 1) => {
    const idx = questions.findIndex((q) => String(q.id) === String(qid));
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= questions.length) return;

    const next = questions.slice();
    const tmp = next[idx];
    next[idx] = next[j];
    next[j] = tmp;

    // перезаписываем order (1..n)
    const normalized = next.map((q, i) => ({ ...q, order: i + 1 }));
    await reorderAndPersist(normalized);
  };

  // -----------------------
  // Question actions
  // -----------------------
  const newQuestion = () => {
    setSelectedQuestionId(null);
    setQType("single");
    setQText("");
    setQPoints("1");
    setQTimeLimit("");
  };

  const createQuestion = async () => {
    if (!selectedQuizId) return;
    setLoading(true);
    setError(null);
    try {
      const nextOrder = (questions[questions.length - 1]?.order ?? 0) + 1;
      const created = await api.adminCreateQuestion(String(selectedQuizId), {
        order: nextOrder,
        type: qType,
        text: qText.trim(),
        points: Number(qPoints || "1"),
        time_limit_seconds: qTimeLimit.trim() === "" ? null : Number(qTimeLimit),
      });
      const next = [...questions, created].slice().sort((a, b) => a.order - b.order);
      setQuestions(next);
      setSelectedQuestionId(String(created.id));
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const updateQuestion = async () => {
    if (!selectedQuestionId) return;
    setLoading(true);
    setError(null);
    try {
      const updated = await api.adminUpdateQuestion(String(selectedQuestionId), {
        type: qType,
        text: qText.trim(),
        points: Number(qPoints || "1"),
        time_limit_seconds: qTimeLimit.trim() === "" ? null : Number(qTimeLimit),
      });
      setQuestions((prev) => prev.map((x) => (String(x.id) === String(updated.id) ? updated : x)).sort((a, b) => a.order - b.order));
      setSelectedQuestionId(String(updated.id));
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteQuestion = async () => {
    if (!selectedQuestionId) return;
    if (!window.confirm("Удалить вопрос?")) return;
    setLoading(true);
    setError(null);
    try {
      await api.adminDeleteQuestion(String(selectedQuestionId));
      const next = questions.filter((q) => String(q.id) !== String(selectedQuestionId));
      // normalize order after delete
      const normalized = next.map((q, i) => ({ ...q, order: i + 1 }));
      setSelectedQuestionId(null);
      setQuestions(normalized);

      // persist reorder
      if (selectedQuizId) {
        await api.adminReorderQuestions?.(String(selectedQuizId), {
          ordered_question_ids: normalized.map((q) => Number(q.id)),
        } as any);
      }
      newQuestion();
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  // -----------------------
  // Options / Rules / Media: helpers
  // -----------------------
  const replaceQuestionInList = (q: AdminQuestionDto) => {
    setQuestions((prev) => prev.map((x) => (String(x.id) === String(q.id) ? q : x)).sort((a, b) => a.order - b.order));
  };

  // options
  const [newOptText, setNewOptText] = useState("");
  const [newOptCorrect, setNewOptCorrect] = useState(false);

  const addOption = async () => {
    if (!selectedQuestion) return;
    if (selectedQuestion.type !== "single" && selectedQuestion.type !== "multi") return;
    const text = newOptText.trim();
    if (!text) return;

    setLoading(true);
    setError(null);
    try {
      const q = await api.adminAddOption(String(selectedQuestion.id), { text, is_correct: newOptCorrect });
      replaceQuestionInList(q);
      setSelectedQuestionId(String(q.id));
      setNewOptText("");
      setNewOptCorrect(false);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const saveOption = async (optionId: string, text: string, is_correct: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminUpdateOption(String(optionId), { text: text.trim(), is_correct });
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const removeOption = async (optionId: string) => {
    if (!window.confirm("Удалить вариант?")) return;
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminDeleteOption(String(optionId));
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  // text rules
  const [newRuleType, setNewRuleType] = useState<"exact" | "regex">("exact");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleOrder, setNewRuleOrder] = useState("1");

  const addRule = async () => {
    if (!selectedQuestion || selectedQuestion.type !== "text") return;
    const pattern = newRulePattern.trim();
    if (!pattern) return;

    setLoading(true);
    setError(null);
    try {
      const q = await api.adminAddTextRule(String(selectedQuestion.id), {
        match_type: newRuleType,
        pattern,
        sort_order: Number(newRuleOrder || "1"),
      });
      replaceQuestionInList(q);
      setNewRulePattern("");
      setNewRuleOrder("1");
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const saveRule = async (ruleId: string, match_type: "exact" | "regex", pattern: string, sort_order: number) => {
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminUpdateTextRule(String(ruleId), { match_type, pattern: pattern.trim(), sort_order });
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const removeRule = async (ruleId: string) => {
    if (!window.confirm("Удалить правило?")) return;
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminDeleteTextRule(String(ruleId));
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  // media
  const [newMediaKind, setNewMediaKind] = useState<MediaKind>("image");
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [newMediaTitle, setNewMediaTitle] = useState("");
  const [newMediaMime, setNewMediaMime] = useState("");
  const [newMediaSort, setNewMediaSort] = useState("1");

  const addMedia = async () => {
    if (!selectedQuestion) return;
    const url = newMediaUrl.trim();
    if (!url) return;

    setLoading(true);
    setError(null);
    try {
      const q = await api.adminAddMedia(String(selectedQuestion.id), {
        kind: newMediaKind,
        source_type: "url" as MediaSourceType,
        url,
        title: newMediaTitle.trim() || null,
        mime: newMediaMime.trim() || null,
        sort_order: Number(newMediaSort || "1"),
      });
      replaceQuestionInList(q);
      setNewMediaUrl("");
      setNewMediaTitle("");
      setNewMediaMime("");
      setNewMediaSort("1");
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const saveMedia = async (mediaId: string, url: string, title: string | null, mime: string | null, sort_order: number) => {
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminUpdateMedia(String(mediaId), { url: url.trim(), title, mime, sort_order });
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  const removeMedia = async (mediaId: string) => {
    if (!window.confirm("Удалить медиа?")) return;
    setLoading(true);
    setError(null);
    try {
      const q = await api.adminDeleteMedia(String(mediaId));
      replaceQuestionInList(q);
    } catch (e) {
      safeSetError(e);
    } finally {
      setLoading(false);
    }
  };

  // results
  const openCsv = () => {
    if (!selectedQuizId) return;
    window.open(api.adminExportCsvUrl(String(selectedQuizId)), "_blank");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Админ</h1>
            <p className="mt-1 text-sm text-slate-600">Управление квизом, вопросами и результатами.</p>
          </div>
          <Button variant="danger" onClick={() => void api.adminLogout().then(() => location.assign("/admin/login"))}>
            Выйти
          </Button>
        </div>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">{error}</Alert>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="md:col-span-1">
            <div className="text-sm font-medium text-slate-900 mb-1">Квиз</div>
            <select
              className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
              value={selectedQuizId ?? ""}
              onChange={(e) => setSelectedQuizId(e.target.value || null)}
            >
              {quizzes.length === 0 ? <option value="">Квизов нет</option> : null}
              {quizzes.map((q) => (
                <option key={String(q.id)} value={String(q.id)}>
                  {q.title}
                </option>
              ))}
            </select>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant={tab === "quiz" ? "primary" : "secondary"} onClick={() => setTab("quiz")}>
                Квиз
              </Button>
              <Button variant={tab === "questions" ? "primary" : "secondary"} onClick={() => setTab("questions")} disabled={!selectedQuizId}>
                Вопросы
              </Button>
              <Button variant={tab === "results" ? "primary" : "secondary"} onClick={() => setTab("results")} disabled={!selectedQuizId}>
                Результаты
              </Button>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-slate-700">
                  Статус:{" "}
                  <span className="font-medium text-slate-900">{selectedQuiz?.published ? "опубликован" : "черновик"}</span>
                </div>
                <Button variant="secondary" onClick={() => void loadQuizzes()} disabled={loading}>
                  Перезагрузить список
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* TAB: QUIZ */}
      {tab === "quiz" ? (
        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">Название</label>
              <Input value={quizTitle} onChange={(e) => setQuizTitle(e.target.value)} placeholder="Название квиза" />
            </div>

            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-900">
                <input type="checkbox" checked={quizPublished} onChange={(e) => setQuizPublished(e.target.checked)} />
                Опубликован
              </label>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">Старт</label>
              <Input type="datetime-local" value={quizStartLocal} onChange={(e) => setQuizStartLocal(e.target.value)} />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-900">Финиш</label>
              <Input type="datetime-local" value={quizEndLocal} onChange={(e) => setQuizEndLocal(e.target.value)} />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => void saveQuiz()} disabled={loading || !selectedQuizId || quizTitle.trim().length === 0}>
              Сохранить
            </Button>
            <Button onClick={() => void createQuiz()} variant="secondary" disabled={loading || quizTitle.trim().length === 0}>
              Создать новый квиз
            </Button>
            <Button onClick={() => void deleteQuiz()} variant="danger" disabled={loading || !selectedQuizId}>
              Удалить квиз
            </Button>
          </div>
        </Card>
      ) : null}

      {/* TAB: QUESTIONS */}
      {tab === "questions" ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-900">Вопросы</div>
                <div className="text-sm text-slate-600">Порядок — кнопками вверх/вниз.</div>
              </div>
              <Button variant="secondary" onClick={newQuestion} disabled={loading}>
                + Новый
              </Button>
            </div>

            <div className="mt-4 space-y-2">
              {questions.length === 0 ? <Alert variant="info">Вопросов нет.</Alert> : null}

              {questions.map((q, idx) => {
                const active = String(q.id) === String(selectedQuestionId);
                return (
                  <div
                    key={String(q.id)}
                    className={[
                      "rounded-2xl border p-3",
                      active ? "border-slate-900 bg-slate-50" : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <button className="w-full text-left" onClick={() => setSelectedQuestionId(String(q.id))}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-slate-900">
                            #{q.order} · {q.type}
                          </div>
                          <div className="mt-1 line-clamp-2 text-xs text-slate-600">{q.text}</div>
                        </div>
                        <div className="shrink-0 text-xs text-slate-700">{q.points}p</div>
                      </div>
                    </button>

                    <div className="mt-3 flex gap-2">
                      <Button variant="secondary" onClick={() => void moveQuestion(String(q.id), -1)} disabled={loading || idx === 0}>
                        ↑
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => void moveQuestion(String(q.id), +1)}
                        disabled={loading || idx === questions.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4">
              <Alert variant="info">
                Если при reorder ловишь ошибку — проверь, что на фронте есть метод <code>adminReorderQuestions</code> (см. ниже).
              </Alert>
            </div>
          </Card>

          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {selectedQuestion ? "Редактирование вопроса" : "Новый вопрос"}
                </div>
                <div className="text-sm text-slate-600">Без prompt() — всё через поля.</div>
              </div>
              {selectedQuestion ? (
                <Button variant="danger" onClick={() => void deleteQuestion()} disabled={loading}>
                  Удалить
                </Button>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-900">Тип</label>
                <select
                  className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
                  value={qType}
                  onChange={(e) => setQType(e.target.value as QuestionType)}
                >
                  <option value="single">single</option>
                  <option value="multi">multi</option>
                  <option value="text">text</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-slate-900">Баллы</label>
                <Input value={qPoints} onChange={(e) => setQPoints(e.target.value)} inputMode="numeric" />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-900">Лимит времени (сек)</label>
                <Input value={qTimeLimit} onChange={(e) => setQTimeLimit(e.target.value)} placeholder="пусто = без лимита" />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-sm font-medium text-slate-900">Текст вопроса</label>
                <Textarea value={qText} onChange={(e) => setQText(e.target.value)} rows={4} />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {selectedQuestion ? (
                <Button onClick={() => void updateQuestion()} disabled={loading || qText.trim().length === 0}>
                  Сохранить
                </Button>
              ) : (
                <Button onClick={() => void createQuestion()} disabled={loading || qText.trim().length === 0}>
                  Создать
                </Button>
              )}
            </div>

            {/* Options / Rules / Media */}
            {selectedQuestion ? (
              <div className="mt-8 grid gap-6 lg:grid-cols-3">
                {/* Options */}
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900">Варианты</div>

                  {selectedQuestion.type !== "single" && selectedQuestion.type !== "multi" ? (
                    <Alert variant="info">Для типа {selectedQuestion.type} варианты недоступны.</Alert>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                        <div className="text-xs text-slate-500">Добавить вариант</div>
                        <Input value={newOptText} onChange={(e) => setNewOptText(e.target.value)} placeholder="Текст варианта" />
                        <label className="flex items-center gap-2 text-sm text-slate-900">
                          <input type="checkbox" checked={newOptCorrect} onChange={(e) => setNewOptCorrect(e.target.checked)} />
                          Правильный
                        </label>
                        <Button variant="secondary" onClick={() => void addOption()} disabled={loading || newOptText.trim().length === 0}>
                          Добавить
                        </Button>
                      </div>

                      {selectedQuestion.options.length === 0 ? <Alert variant="warning">Пока нет вариантов.</Alert> : null}

                      <div className="space-y-2">
                        {selectedQuestion.options.map((o) => (
                          <OptionRow
                            key={String(o.id)}
                            initialText={o.text}
                            initialCorrect={o.is_correct}
                            loading={loading}
                            onSave={(text, correct) => void saveOption(String(o.id), text, correct)}
                            onDelete={() => void removeOption(String(o.id))}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Text rules */}
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900">Правила для text</div>

                  {selectedQuestion.type !== "text" ? (
                    <Alert variant="info">Для типа {selectedQuestion.type} правила недоступны.</Alert>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                        <div className="text-xs text-slate-500">Добавить правило</div>
                        <div className="grid grid-cols-2 gap-2">
                          <select
                            className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
                            value={newRuleType}
                            onChange={(e) => setNewRuleType(e.target.value as any)}
                          >
                            <option value="exact">exact</option>
                            <option value="regex">regex</option>
                          </select>
                          <Input value={newRuleOrder} onChange={(e) => setNewRuleOrder(e.target.value)} inputMode="numeric" placeholder="sort" />
                        </div>
                        <Input value={newRulePattern} onChange={(e) => setNewRulePattern(e.target.value)} placeholder="pattern" />
                        <Button variant="secondary" onClick={() => void addRule()} disabled={loading || newRulePattern.trim().length === 0}>
                          Добавить
                        </Button>
                      </div>

                      {selectedQuestion.text_rules.length === 0 ? <Alert variant="warning">Пока нет правил.</Alert> : null}

                      <div className="space-y-2">
                        {selectedQuestion.text_rules
                          .slice()
                          .sort((a, b) => a.sort_order - b.sort_order)
                          .map((r) => (
                            <RuleRow
                              key={String(r.id)}
                              initialType={r.match_type}
                              initialPattern={r.pattern}
                              initialOrder={r.sort_order}
                              loading={loading}
                              onSave={(t, p, o) => void saveRule(String(r.id), t, p, o)}
                              onDelete={() => void removeRule(String(r.id))}
                            />
                          ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Media */}
                <div className="space-y-3">
                  <div className="font-semibold text-slate-900">Медиа</div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
                    <div className="text-xs text-slate-500">Добавить медиа</div>
                    <select
                      className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
                      value={newMediaKind}
                      onChange={(e) => setNewMediaKind(e.target.value as MediaKind)}
                    >
                      <option value="image">image</option>
                      <option value="audio">audio</option>
                      <option value="video">video</option>
                      <option value="embed">embed</option>
                    </select>
                    <Input value={newMediaUrl} onChange={(e) => setNewMediaUrl(e.target.value)} placeholder="URL" />
                    <Input value={newMediaTitle} onChange={(e) => setNewMediaTitle(e.target.value)} placeholder="title (опционально)" />
                    <Input value={newMediaMime} onChange={(e) => setNewMediaMime(e.target.value)} placeholder="mime (опционально)" />
                    <Input value={newMediaSort} onChange={(e) => setNewMediaSort(e.target.value)} inputMode="numeric" placeholder="sort" />
                    <Button variant="secondary" onClick={() => void addMedia()} disabled={loading || newMediaUrl.trim().length === 0}>
                      Добавить
                    </Button>
                  </div>

                  {selectedQuestion.media.length === 0 ? <Alert variant="info">Пока нет медиа.</Alert> : null}

                  <div className="space-y-2">
                    {selectedQuestion.media
                      .slice()
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((m) => (
                        <MediaRow
                          key={String(m.id)}
                          kind={m.kind}
                          source_type={m.source_type}
                          initialUrl={m.url}
                          initialTitle={m.title ?? ""}
                          initialMime={m.mime ?? ""}
                          initialSort={m.sort_order}
                          loading={loading}
                          onSave={(url, title, mime, sort) => void saveMedia(String(m.id), url, title || null, mime || null, sort)}
                          onDelete={() => void removeMedia(String(m.id))}
                        />
                      ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <Alert variant="info">Создай вопрос или выбери существующий слева.</Alert>
              </div>
            )}
          </Card>
        </div>
      ) : null}

      {/* TAB: RESULTS */}
      {tab === "results" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">Результаты</div>
                <div className="text-sm text-slate-600">Таблица попыток. Нажми — увидишь ответы.</div>
              </div>
              <Button variant="secondary" onClick={openCsv} disabled={!selectedQuizId}>
                CSV
              </Button>
            </div>

            <div className="mt-4 overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Участник</th>
                    <th className="px-3 py-2">VK</th>
                    <th className="px-3 py-2">Статус</th>
                    <th className="px-3 py-2">Счёт</th>
                    <th className="px-3 py-2">Время</th>
                  </tr>
                </thead>
                <tbody>
                  {attempts.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-slate-600" colSpan={5}>
                        Нет попыток.
                      </td>
                    </tr>
                  ) : (
                    attempts.map((a) => (
                      <tr
                        key={String(a.id)}
                        className="cursor-pointer border-t border-slate-200 hover:bg-slate-50"
                        onClick={() => {
                          const next = openAttemptId === String(a.id) ? null : String(a.id);
                          setOpenAttemptId(next);
                          setAttemptAnswers([]);
                          if (next) void loadAttemptAnswers(next);
                        }}
                      >
                        <td className="px-3 py-2 font-medium text-slate-900">{a.fio_norm}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {a.vk_url_norm ? (
                            <a
                              href={a.vk_url_norm}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="text-blue-700 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {a.vk_url_norm}
                            </a>
                          ) : (
                            "�"
                          )}
                        </td>
                        <td className="px-3 py-2 text-slate-700">{a.status}</td>
                        <td className="px-3 py-2 text-slate-700">{a.score}</td>
                        <td className="px-3 py-2 text-slate-700">{fmtMs(a.total_time_ms)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <div className="text-lg font-semibold text-slate-900">Ответы</div>
            <div className="text-sm text-slate-600">Отображение сделано “по-человечески”, не JSON-дампом.</div>

            {!openAttemptId ? (
              <div className="mt-4">
                <Alert variant="info">Выбери строку в таблице слева.</Alert>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {attemptAnswers.length === 0 ? (
                  <Alert variant="info">{loading ? "Загрузка…" : "Нет ответов."}</Alert>
                ) : (
                  attemptAnswers.map((ans) => (
                    <div key={String(ans.id)} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="text-sm font-semibold text-slate-900">Вопрос #{ans.question_id}</div>
                      <div className="mt-2">{prettyAnswer(ans, optionTextById)}</div>
                    </div>
                  ))
                )}
              </div>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function OptionRow(props: {
  initialText: string;
  initialCorrect: boolean;
  loading: boolean;
  onSave: (text: string, correct: boolean) => void;
  onDelete: () => void;
}) {
  const [text, setText] = useState(props.initialText);
  const [correct, setCorrect] = useState(props.initialCorrect);

  useEffect(() => setText(props.initialText), [props.initialText]);
  useEffect(() => setCorrect(props.initialCorrect), [props.initialCorrect]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Текст" />
      <label className="flex items-center gap-2 text-sm text-slate-900">
        <input type="checkbox" checked={correct} onChange={(e) => setCorrect(e.target.checked)} />
        Правильный
      </label>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => props.onSave(text, correct)} disabled={props.loading || text.trim().length === 0}>
          Сохранить
        </Button>
        <Button variant="danger" onClick={props.onDelete} disabled={props.loading}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

function RuleRow(props: {
  initialType: "exact" | "regex";
  initialPattern: string;
  initialOrder: number;
  loading: boolean;
  onSave: (t: "exact" | "regex", p: string, o: number) => void;
  onDelete: () => void;
}) {
  const [t, setT] = useState<"exact" | "regex">(props.initialType);
  const [p, setP] = useState(props.initialPattern);
  const [o, setO] = useState(String(props.initialOrder));

  useEffect(() => setT(props.initialType), [props.initialType]);
  useEffect(() => setP(props.initialPattern), [props.initialPattern]);
  useEffect(() => setO(String(props.initialOrder)), [props.initialOrder]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select
          className="h-10 w-full rounded-2xl border border-slate-300 bg-white px-3 text-sm"
          value={t}
          onChange={(e) => setT(e.target.value as any)}
        >
          <option value="exact">exact</option>
          <option value="regex">regex</option>
        </select>
        <Input value={o} onChange={(e) => setO(e.target.value)} inputMode="numeric" placeholder="sort" />
      </div>
      <Input value={p} onChange={(e) => setP(e.target.value)} placeholder="pattern" />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => props.onSave(t, p, Number(o || "1"))}
          disabled={props.loading || p.trim().length === 0}
        >
          Сохранить
        </Button>
        <Button variant="danger" onClick={props.onDelete} disabled={props.loading}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

function MediaRow(props: {
  kind: MediaKind;
  source_type: MediaSourceType;
  initialUrl: string;
  initialTitle: string;
  initialMime: string;
  initialSort: number;
  loading: boolean;
  onSave: (url: string, title: string, mime: string, sort: number) => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState(props.initialUrl);
  const [title, setTitle] = useState(props.initialTitle);
  const [mime, setMime] = useState(props.initialMime);
  const [sort, setSort] = useState(String(props.initialSort));

  useEffect(() => setUrl(props.initialUrl), [props.initialUrl]);
  useEffect(() => setTitle(props.initialTitle), [props.initialTitle]);
  useEffect(() => setMime(props.initialMime), [props.initialMime]);
  useEffect(() => setSort(String(props.initialSort)), [props.initialSort]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="text-xs text-slate-500">
        {props.kind} · {props.source_type}
      </div>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" />
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="title (опционально)" />
      <Input value={mime} onChange={(e) => setMime(e.target.value)} placeholder="mime (опционально)" />
      <Input value={sort} onChange={(e) => setSort(e.target.value)} inputMode="numeric" placeholder="sort" />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => props.onSave(url, title, mime, Number(sort || "1"))}
          disabled={props.loading || url.trim().length === 0}
        >
          Сохранить
        </Button>
        <Button variant="danger" onClick={props.onDelete} disabled={props.loading}>
          Удалить
        </Button>
      </div>
    </div>
  );
}

