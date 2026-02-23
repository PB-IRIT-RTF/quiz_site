import { API_BASE } from "@/lib/env";
import type { Api } from "@/lib/api/api";
import { ApiError } from "@/lib/api/errors";
import type {
  ActiveQuizResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AnswerCurrentQuestionRequest,
  AnswerCurrentQuestionResponse,
  AttemptStartResponse,
  CurrentQuestionResponse,
  LeaderboardResponse,
  ParticipantRegisterRequest,
  ParticipantRegisterResponse,
  ResultResponse,
  StatsSummaryResponse,
  AdminAttemptAnswerDto,
  AdminAttemptRowDto,
  AdminMediaCreateRequest,
  AdminMediaUpdateRequest,
  AdminOptionCreateRequest,
  AdminOptionUpdateRequest,
  AdminQuestionCreateRequest,
  AdminQuestionDto,
  AdminQuestionUpdateRequest,
  AdminQuizCreateRequest,
  AdminQuizDto,
  AdminQuizUpdateRequest,
  AdminTextRuleCreateRequest,
  AdminTextRuleUpdateRequest,
} from "@/lib/api/types";

function sanitizeErrorText(input: string): string {
  return input
    .replace(/https?:\/\/[^\s)]+/gi, "[hidden]")
    .replace(/\/api\/[^\s)]+/gi, "/api/[hidden]");
}

function sanitizeErrorBody<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeErrorText(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => sanitizeErrorBody(v)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeErrorBody(v);
    }
    return out as T;
  }
  return value;
}

function getCookie(name: string): string | null {
  const encoded = encodeURIComponent(name) + "=";
  const parts = document.cookie.split("; ");
  for (const p of parts) {
    if (p.startsWith(encoded)) {
      return decodeURIComponent(p.slice(encoded.length));
    }
  }
  return null;
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const method = (init?.method ?? "GET").toUpperCase();
  const csrf = method === "GET" || method === "HEAD" || method === "OPTIONS" ? null : getCookie("admin_csrf");
  const extraHeaders: Record<string, string> = csrf ? { "X-CSRF-Token": csrf } : {};
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...extraHeaders,
        ...(init?.headers ?? {}),
      },
      ...init,
    });
  } catch (e) {
    // В браузере "Failed to fetch" часто означает: backend не запущен, CORS, mixed-content, неверный URL.
    throw new Error(`Network error: ${sanitizeErrorText(String(e))}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const bodyRaw = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);
  const body = sanitizeErrorBody(bodyRaw);

  if (!res.ok) {
    throw new ApiError(`HTTP ${res.status}`, res.status, body);
  }
  return body as T;
}

export const httpApi: Api = {
  health: () => http("/api/health"),
  getActiveQuiz: () => http<ActiveQuizResponse>("/api/quizzes/active"),
  me: () => http("/api/me"),

  registerParticipant: (input: ParticipantRegisterRequest) =>
    http<ParticipantRegisterResponse>("/api/participants/register", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  startAttempt: () => http<AttemptStartResponse>("/api/attempts/start", { method: "POST" }),

  getCurrentQuestion: () => http<CurrentQuestionResponse>("/api/questions/current"),

  answerCurrentQuestion: (input: AnswerCurrentQuestionRequest) =>
    http<AnswerCurrentQuestionResponse>("/api/questions/current/answer", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  skipCurrentQuestion: (question_id: number) =>
    http("/api/questions/current/skip", {
      method: "POST",
      body: JSON.stringify({ question_id }),
    }),

  getResult: () => http<ResultResponse>("/api/result"),
  getLeaderboard: (limit = 20) => http<LeaderboardResponse>(`/api/leaderboard?limit=${limit}`),

  adminLogin: (input: AdminLoginRequest) =>
    http<AdminLoginResponse>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  adminLogout: () => http("/api/admin/logout", { method: "POST" }),
  adminStatsSummary: () => http<StatsSummaryResponse>("/api/admin/stats/summary"),

  adminListQuizzes: () => http<AdminQuizDto[]>("/api/admin/quizzes"),
  adminCreateQuiz: (input: AdminQuizCreateRequest) =>
    http<AdminQuizDto>("/api/admin/quizzes", { method: "POST", body: JSON.stringify(input) }),
  adminUpdateQuiz: (id: string, input: AdminQuizUpdateRequest) =>
    http<AdminQuizDto>(`/api/admin/quizzes/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  adminDeleteQuiz: (id: string) => http(`/api/admin/quizzes/${id}`, { method: "DELETE" }),
  adminPublishQuiz: (id: string) => http<AdminQuizDto>(`/api/admin/quizzes/${id}/publish`, { method: "POST", body: "{}" }),
  adminUnpublishQuiz: (id: string) => http<AdminQuizDto>(`/api/admin/quizzes/${id}/unpublish`, { method: "POST", body: "{}" }),

  adminListQuestions: (quizId: string) => http<AdminQuestionDto[]>(`/api/admin/quizzes/${quizId}/questions`),
  adminCreateQuestion: (quizId: string, input: AdminQuestionCreateRequest) =>
    http<AdminQuestionDto>(`/api/admin/quizzes/${quizId}/questions`, { method: "POST", body: JSON.stringify(input) }),
  adminUpdateQuestion: (questionId: string, input: AdminQuestionUpdateRequest) =>
    http<AdminQuestionDto>(`/api/admin/questions/${questionId}`, { method: "PATCH", body: JSON.stringify(input) }),
  adminDeleteQuestion: (questionId: string) => http(`/api/admin/questions/${questionId}`, { method: "DELETE" }),

  adminAddOption: (questionId: string, input: AdminOptionCreateRequest) =>
    http<AdminQuestionDto>(`/api/admin/questions/${questionId}/options`, { method: "POST", body: JSON.stringify(input) }),
  adminUpdateOption: (optionId: string, input: AdminOptionUpdateRequest) =>
    http<AdminQuestionDto>(`/api/admin/options/${optionId}`, { method: "PATCH", body: JSON.stringify(input) }),
  adminDeleteOption: (optionId: string) => http<AdminQuestionDto>(`/api/admin/options/${optionId}`, { method: "DELETE" }),

  adminAddTextRule: (questionId: string, input: AdminTextRuleCreateRequest) =>
    http<AdminQuestionDto>(`/api/admin/questions/${questionId}/text-rules`, { method: "POST", body: JSON.stringify(input) }),
  adminUpdateTextRule: (ruleId: string, input: AdminTextRuleUpdateRequest) =>
    http<AdminQuestionDto>(`/api/admin/text-rules/${ruleId}`, { method: "PATCH", body: JSON.stringify(input) }),
  adminDeleteTextRule: (ruleId: string) => http<AdminQuestionDto>(`/api/admin/text-rules/${ruleId}`, { method: "DELETE" }),

  adminAddMedia: (questionId: string, input: AdminMediaCreateRequest) =>
    http<AdminQuestionDto>(`/api/admin/questions/${questionId}/media`, { method: "POST", body: JSON.stringify(input) }),
  adminUpdateMedia: (mediaId: string, input: AdminMediaUpdateRequest) =>
    http<AdminQuestionDto>(`/api/admin/media/${mediaId}`, { method: "PATCH", body: JSON.stringify(input) }),
  adminDeleteMedia: (mediaId: string) => http<AdminQuestionDto>(`/api/admin/media/${mediaId}`, { method: "DELETE" }),

  adminListAttempts: (quizId: string, limit = 50, offset = 0) =>
    http<AdminAttemptRowDto[]>(`/api/admin/quizzes/${quizId}/attempts?limit=${limit}&offset=${offset}`),
  adminAttemptAnswers: (attemptId: string) =>
    http<AdminAttemptAnswerDto[]>(`/api/admin/attempts/${attemptId}/answers`),
  adminExportCsvUrl: (quizId: string) => `${API_BASE}/api/admin/quizzes/${quizId}/export.csv`,
  adminReorderQuestions: (quizId: string, input: { ordered_question_ids: number[] }) =>
    http(`/api/admin/quizzes/${quizId}/questions/reorder`, { method: "POST", body: JSON.stringify(input) }),
};
