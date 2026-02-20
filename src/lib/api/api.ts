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

export interface Api {
  health(): Promise<{ ok: true }>;
  getActiveQuiz(): Promise<ActiveQuizResponse>;
  me(): Promise<import("@/lib/api/types").MeResponse>;

  registerParticipant(input: ParticipantRegisterRequest): Promise<ParticipantRegisterResponse>;
  startAttempt(): Promise<AttemptStartResponse>;

  getCurrentQuestion(): Promise<CurrentQuestionResponse>;
  answerCurrentQuestion(input: AnswerCurrentQuestionRequest): Promise<AnswerCurrentQuestionResponse>;
  skipCurrentQuestion(question_id: string): Promise<{ ok: true }>;

  getResult(): Promise<ResultResponse>;
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>;

  // admin (минимум)
  adminLogin(input: AdminLoginRequest): Promise<AdminLoginResponse>;
  adminLogout(): Promise<{ ok: true }>;
  adminStatsSummary(): Promise<StatsSummaryResponse>;
}
