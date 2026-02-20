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
  fio: string;
  group: string;
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
