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
  skipCurrentQuestion(question_id: number): Promise<{ ok: true }>;

  getResult(): Promise<ResultResponse>;
  getLeaderboard(limit?: number): Promise<LeaderboardResponse>;

  // admin (минимум)
  adminLogin(input: AdminLoginRequest): Promise<AdminLoginResponse>;
  adminLogout(): Promise<{ ok: true }>;
  adminStatsSummary(): Promise<StatsSummaryResponse>;

  // admin (full)
  adminListQuizzes(): Promise<import("@/lib/api/types").AdminQuizDto[]>;
  adminCreateQuiz(input: import("@/lib/api/types").AdminQuizCreateRequest): Promise<import("@/lib/api/types").AdminQuizDto>;
  adminUpdateQuiz(id: string, input: import("@/lib/api/types").AdminQuizUpdateRequest): Promise<import("@/lib/api/types").AdminQuizDto>;
  adminDeleteQuiz(id: string): Promise<{ ok: true }>;
  adminPublishQuiz(id: string): Promise<import("@/lib/api/types").AdminQuizDto>;
  adminUnpublishQuiz(id: string): Promise<import("@/lib/api/types").AdminQuizDto>;

  adminListQuestions(quizId: string): Promise<import("@/lib/api/types").AdminQuestionDto[]>;
  adminCreateQuestion(quizId: string, input: import("@/lib/api/types").AdminQuestionCreateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminUpdateQuestion(questionId: string, input: import("@/lib/api/types").AdminQuestionUpdateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminDeleteQuestion(questionId: string): Promise<{ ok: true }>;

  adminAddOption(questionId: string, input: import("@/lib/api/types").AdminOptionCreateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminUpdateOption(optionId: string, input: import("@/lib/api/types").AdminOptionUpdateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminDeleteOption(optionId: string): Promise<import("@/lib/api/types").AdminQuestionDto>;

  adminAddTextRule(questionId: string, input: import("@/lib/api/types").AdminTextRuleCreateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminUpdateTextRule(ruleId: string, input: import("@/lib/api/types").AdminTextRuleUpdateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminDeleteTextRule(ruleId: string): Promise<import("@/lib/api/types").AdminQuestionDto>;

  adminAddMedia(questionId: string, input: import("@/lib/api/types").AdminMediaCreateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminUpdateMedia(mediaId: string, input: import("@/lib/api/types").AdminMediaUpdateRequest): Promise<import("@/lib/api/types").AdminQuestionDto>;
  adminDeleteMedia(mediaId: string): Promise<import("@/lib/api/types").AdminQuestionDto>;

  adminListAttempts(quizId: string, limit?: number, offset?: number): Promise<import("@/lib/api/types").AdminAttemptRowDto[]>;
  adminAttemptAnswers(attemptId: string): Promise<import("@/lib/api/types").AdminAttemptAnswerDto[]>;
  adminExportCsvUrl(quizId: string): string;

  adminReorderQuestions(quizId: string, input: { ordered_question_ids: number[] }): Promise<{ ok: true }>;
}
