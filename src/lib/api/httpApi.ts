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
} from "@/lib/api/types";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json().catch(() => null) : await res.text().catch(() => null);

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

  skipCurrentQuestion: (question_id: string) =>
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
};
