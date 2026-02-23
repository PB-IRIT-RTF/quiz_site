export type QuizState = "running" | "ended" | "not_started" | "unpublished" | "none";

export type QuestionType = "single" | "multi" | "text";

export type MediaKind = "image" | "audio" | "video" | "embed";
export type MediaSourceType = "upload" | "url";

export interface QuizDto {
  id: string;
  title: string;
  start_at: string; // ISO UTC
  end_at: string; // ISO UTC
  published: boolean;
}

export interface ActiveQuizResponse {
  state: QuizState;
  now: string;
  quiz: QuizDto | null;
}

export type MeRole = "anonymous" | "participant" | "admin";

export interface MeResponse {
  role: MeRole;
  display_name?: string | null;
}

export interface ParticipantRegisterRequest {
  nickname: string;
  vk_url: string;
}

export interface ParticipantRegisterResponse {
  participant_id: string;
}

export type AttemptStatus = "registered" | "in_progress" | "finished" | "forced_finished";

export interface AttemptStartResponse {
  status: AttemptStatus;
}

export interface OptionPublicDto {
  id: string;
  text: string;
}

export interface QuestionMediaDto {
  id: string;
  kind: MediaKind;
  source_type: MediaSourceType;
  url: string;
  mime?: string | null;
  title?: string | null;
  sort_order: number;
}

export interface QuestionPublicDto {
  id: string;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  time_limit_seconds: number | null;
  options?: OptionPublicDto[];
  media: QuestionMediaDto[];
}

export interface CurrentQuestionResponse {
  attempt_status: AttemptStatus;
  question: QuestionPublicDto | null;
  time_left_seconds: number | null;
  progress: {
    current: number;
    total: number;
  };
}

export interface AnswerCurrentQuestionRequest {
  question_id: string;
  type: QuestionType;
  option_ids?: string[];
  text?: string | null;
}

export interface AnswerCurrentQuestionResponse {
  ok: true;
}

export interface ResultResponse {
  status: AttemptStatus;
  score: number;
  place: number | null;
  total_time_ms: number | null;
}

export interface LeaderboardRow {
  rank: number;
  display_name: string;
  score: number;
  total_time_ms: number;
}

export interface LeaderboardResponse {
  top: LeaderboardRow[];
  me: LeaderboardRow | null;
  me_status: AttemptStatus | "not_started";
}

export interface StatsSummaryResponse {
  registered: number;
  started: number;
  in_progress: number;
  finished: number;
  forced_finished: number;
}

export interface AdminLoginRequest {
  password: string;
}

export interface AdminLoginResponse {
  ok: true;
}

// --------------------
// Admin DTO
// --------------------
export interface AdminQuizDto {
  id: string; // или number (лучше), но оставим как у тебя
  title: string;
  start_at: string;
  end_at: string;
  published: boolean;
  created_at: string;
}

export interface AdminQuizCreateRequest {
  title: string;
  start_at: string; // ISO
  end_at: string;   // ISO
  published?: boolean;
}

export interface AdminQuizUpdateRequest {
  title?: string;
  start_at?: string;
  end_at?: string;
  published?: boolean;
}

export interface AdminQuestionOptionDto {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface AdminTextRuleDto {
  id: string;
  match_type: "exact" | "regex";
  pattern: string;
  sort_order: number;
}

export interface AdminQuestionMediaDto {
  id: string;
  kind: MediaKind;
  source_type: MediaSourceType;
  url: string;
  mime?: string | null;
  title?: string | null;
  sort_order: number;
}

export interface AdminQuestionDto {
  id: string;
  quiz_id: string;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  time_limit_seconds: number | null;
  options: AdminQuestionOptionDto[];
  text_rules: AdminTextRuleDto[];
  media: AdminQuestionMediaDto[];
}

export interface AdminQuestionCreateRequest {
  order: number;
  type: QuestionType;
  text: string;
  points?: number;
  time_limit_seconds?: number | null;
}

export interface AdminQuestionUpdateRequest {
  order?: number;
  type?: QuestionType;
  text?: string;
  points?: number;
  time_limit_seconds?: number | null;
}

export interface AdminOptionCreateRequest {
  text: string;
  is_correct?: boolean;
}
export interface AdminOptionUpdateRequest {
  text?: string;
  is_correct?: boolean;
}

export interface AdminTextRuleCreateRequest {
  match_type: "exact" | "regex";
  pattern: string;
  sort_order?: number;
}
export interface AdminTextRuleUpdateRequest {
  match_type?: "exact" | "regex";
  pattern?: string;
  sort_order?: number;
}

export interface AdminMediaCreateRequest {
  kind: MediaKind;
  source_type?: MediaSourceType;
  url: string;
  mime?: string | null;
  title?: string | null;
  sort_order?: number;
}
export interface AdminMediaUpdateRequest {
  kind?: MediaKind;
  source_type?: MediaSourceType;
  url?: string;
  mime?: string | null;
  title?: string | null;
  sort_order?: number;
}

export interface AdminAttemptRowDto {
  id: string;
  participant_id: string;
  fio_norm: string;
  vk_url_norm?: string | null;
  status: AttemptStatus;
  score: number;
  total_time_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface AdminAttemptAnswerDto {
  id: string;
  question_id: string;
  submitted_at: string;
  answer_json: Record<string, unknown>;
  is_correct: boolean;
  awarded_points: number;
  auto_submitted: boolean;
  time_spent_ms: number;
}
