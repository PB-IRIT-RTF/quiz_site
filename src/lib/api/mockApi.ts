import type { Api } from "@/lib/api/api";
import { ApiError } from "@/lib/api/errors";
import type {
  ActiveQuizResponse,
  AdminLoginRequest,
  AdminLoginResponse,
  AnswerCurrentQuestionRequest,
  AnswerCurrentQuestionResponse,
  AttemptStartResponse,
  AttemptStatus,
  CurrentQuestionResponse,
  LeaderboardResponse,
  MediaKind,
  ParticipantRegisterRequest,
  ParticipantRegisterResponse,
  QuestionType,
  ResultResponse,
  StatsSummaryResponse,
} from "@/lib/api/types";
import { clamp, toInitialsFio } from "@/lib/format";
import { normalizeSpaces, normalizeVkUrl } from "@/lib/validation";

const LS_DB = "uirit.mockdb.v1";
const LS_PARTICIPANT_ID = "uirit.participant_id";
const LS_ADMIN = "uirit.admin";

type Id = string;

interface MockQuiz {
  id: Id;
  title: string;
  start_at: string;
  end_at: string;
  published: boolean;
}

interface MockQuestionMedia {
  id: Id;
  kind: MediaKind;
  source_type: "upload" | "url";
  url: string;
  mime?: string | null;
  title?: string | null;
  sort_order: number;
}

interface MockOption {
  id: Id;
  text: string;
  is_correct: boolean;
}

interface MockTextRule {
  id: Id;
  match_type: "exact" | "regex";
  pattern: string;
  sort_order: number;
}

interface MockQuestion {
  id: Id;
  quiz_id: Id;
  order: number;
  type: QuestionType;
  text: string;
  points: number;
  time_limit_seconds: number | null;
  options: MockOption[];
  text_rules: MockTextRule[];
  media: MockQuestionMedia[];
}

interface MockParticipant {
  id: Id;
  fio_raw: string;
  fio_norm: string;
  group_raw: string;
  group_norm: string;
  vk_url_raw: string;
  vk_url_norm: string;
  created_at: string;
}

interface MockAttemptAnswer {
  question_id: Id;
  submitted_at: string;
  answer_json: unknown;
  is_correct: boolean;
  awarded_points: number;
  auto_submitted: boolean;
  time_spent_ms: number;
}

interface MockAttempt {
  id: Id;
  quiz_id: Id;
  participant_id: Id;
  status: AttemptStatus;
  started_at: string | null;
  finished_at: string | null;
  score: number;
  total_time_ms: number | null;
  current_question_order: number;
  current_question_started_at: string | null;
  answers: Record<Id, MockAttemptAnswer>;
}

interface MockDb {
  quizzes: MockQuiz[];
  questions: MockQuestion[];
  participants: MockParticipant[];
  attempts: MockAttempt[];
}

function uuid(): string {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function isoToMs(iso: string) {
  return new Date(iso).getTime();
}

function loadDb(): MockDb {
  const raw = localStorage.getItem(LS_DB);
  if (raw) return JSON.parse(raw) as MockDb;

  const now = Date.now();
  const quiz: MockQuiz = {
    id: "1",
    title: "Вселенная ИРИТ-РТФ",
    start_at: new Date(now - 60 * 60 * 1000).toISOString(),
    end_at: new Date(now + 6 * 60 * 60 * 1000).toISOString(),
    published: true,
  };

  const q1: MockQuestion = {
    id: "q1",
    quiz_id: quiz.id,
    order: 1,
    type: "single",
    text: "Какой факультет проводит мероприятие \"Вселенная ИРИТ‑РТФ\"?",
    points: 1,
    time_limit_seconds: 25,
    options: [
      { id: "o1", text: "ИРИТ‑РТФ", is_correct: true },
      { id: "o2", text: "ФТИ", is_correct: false },
      { id: "o3", text: "ФЭЛ", is_correct: false },
    ],
    text_rules: [],
    media: [
      {
        id: "m1",
        kind: "image",
        source_type: "url",
        url: "https://picsum.photos/seed/irit/900/380",
        title: "Баннер (пример)",
        sort_order: 1,
      },
    ],
  };

  const q2: MockQuestion = {
    id: "q2",
    quiz_id: quiz.id,
    order: 2,
    type: "multi",
    text: "Отметьте форматы медиа, которые поддерживаются в вопросах (всё или ничего).",
    points: 2,
    time_limit_seconds: 35,
    options: [
      { id: "o21", text: "Картинки", is_correct: true },
      { id: "o22", text: "Аудио", is_correct: true },
      { id: "o23", text: "Видео", is_correct: true },
      { id: "o24", text: "YouTube", is_correct: false },
    ],
    text_rules: [],
    media: [
      {
        id: "m21",
        kind: "audio",
        source_type: "url",
        url: "https://upload.wikimedia.org/wikipedia/commons/transcoded/4/45/En-us-quiz.ogg/En-us-quiz.ogg.mp3",
        title: "Аудио (пример)",
        sort_order: 1,
      },
    ],
  };

  const q3: MockQuestion = {
    id: "q3",
    quiz_id: quiz.id,
    order: 3,
    type: "text",
    text: "Введите слово: \"ИРИТ\" (проверка exact, без учёта регистра).",
    points: 1,
    time_limit_seconds: null,
    options: [],
    text_rules: [
      { id: "r1", match_type: "exact", pattern: "ирит", sort_order: 1 },
    ],
    media: [
      {
        id: "m31",
        kind: "video",
        source_type: "url",
        url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
        title: "Видео (пример)",
        sort_order: 1,
        mime: "video/mp4",
      },
    ],
  };

  const db: MockDb = {
    quizzes: [quiz],
    questions: [q1, q2, q3],
    participants: [],
    attempts: [],
  };

  localStorage.setItem(LS_DB, JSON.stringify(db));
  return db;
}

function saveDb(db: MockDb) {
  localStorage.setItem(LS_DB, JSON.stringify(db));
}

function getParticipantId(): string | null {
  return localStorage.getItem(LS_PARTICIPANT_ID);
}

function requireParticipantId(): string {
  const id = getParticipantId();
  if (!id) throw new ApiError("Unauthorized", 401, { detail: "participant_not_registered" });
  return id;
}

function computeQuizState(quiz: MockQuiz | null, nowMs: number): ActiveQuizResponse {
  if (!quiz) return { state: "none", now: new Date(nowMs).toISOString(), quiz: null };
  if (!quiz.published) return { state: "unpublished", now: new Date(nowMs).toISOString(), quiz };
  const start = isoToMs(quiz.start_at);
  const end = isoToMs(quiz.end_at);
  if (nowMs < start) return { state: "not_started", now: new Date(nowMs).toISOString(), quiz };
  if (nowMs >= end) return { state: "ended", now: new Date(nowMs).toISOString(), quiz };
  return { state: "running", now: new Date(nowMs).toISOString(), quiz };
}

function getQuiz(db: MockDb): MockQuiz | null {
  return db.quizzes[0] ?? null;
}

function getQuestions(db: MockDb, quizId: string): MockQuestion[] {
  return db.questions.filter((q) => q.quiz_id === quizId).sort((a, b) => a.order - b.order);
}

function findAttempt(db: MockDb, quizId: string, participantId: string): MockAttempt | null {
  return db.attempts.find((a) => a.quiz_id === quizId && a.participant_id === participantId) ?? null;
}

function ensureAttempt(db: MockDb, quizId: string, participantId: string): MockAttempt {
  const attempt = findAttempt(db, quizId, participantId);
  if (!attempt) {
    const created: MockAttempt = {
      id: uuid(),
      quiz_id: quizId,
      participant_id: participantId,
      status: "registered",
      started_at: null,
      finished_at: null,
      score: 0,
      total_time_ms: null,
      current_question_order: 1,
      current_question_started_at: null,
      answers: {},
    };
    db.attempts.push(created);
    return created;
  }
  return attempt;
}

function finishAttempt(attempt: MockAttempt, status: AttemptStatus) {
  if (attempt.status === "finished" || attempt.status === "forced_finished") return;
  attempt.status = status;
  attempt.finished_at = nowIso();
  if (attempt.started_at) {
    attempt.total_time_ms = Math.max(0, isoToMs(attempt.finished_at) - isoToMs(attempt.started_at));
  } else {
    attempt.total_time_ms = 0;
  }
}

function evaluateQuestion(q: MockQuestion, req: AnswerCurrentQuestionRequest) {
  if (q.type === "single") {
    const chosen = new Set(req.option_ids ?? []);
    const correct = q.options.find((o) => o.is_correct)?.id;
    const isCorrect = correct ? chosen.size === 1 && chosen.has(correct) : false;
    return { isCorrect, awarded: isCorrect ? q.points : 0 };
  }
  if (q.type === "multi") {
    const chosen = new Set(req.option_ids ?? []);
    const correct = new Set(q.options.filter((o) => o.is_correct).map((o) => o.id));
    const isCorrect = chosen.size === correct.size && [...correct].every((id) => chosen.has(id));
    return { isCorrect, awarded: isCorrect ? q.points : 0 };
  }
  // text
  const text = (req.text ?? "").trim().toLowerCase();
  let isCorrect = false;
  for (const rule of [...q.text_rules].sort((a, b) => a.sort_order - b.sort_order)) {
    if (rule.match_type === "exact") {
      if (text === rule.pattern) {
        isCorrect = true;
        break;
      }
    } else {
      try {
        const re = new RegExp(rule.pattern);
        if (re.test(text)) {
          isCorrect = true;
          break;
        }
      } catch {
        // ignore invalid regex in mock
      }
    }
  }
  return { isCorrect, awarded: isCorrect ? q.points : 0 };
}

function syncAttemptProgress(db: MockDb, quiz: MockQuiz, attempt: MockAttempt) {
  if (attempt.status !== "in_progress") return;

  const now = Date.now();
  const quizEnd = isoToMs(quiz.end_at);
  if (now >= quizEnd) {
    finishAttempt(attempt, "forced_finished");
    return;
  }

  const questions = getQuestions(db, quiz.id);

  while (true) {
    const q = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!q) {
      finishAttempt(attempt, "finished");
      return;
    }

    if (q.time_limit_seconds == null) return;

    const startedAtIso = attempt.current_question_started_at ?? attempt.started_at;
    if (!startedAtIso) return;

    const elapsed = now - isoToMs(startedAtIso);
    const limitMs = q.time_limit_seconds * 1000;
    if (elapsed < limitMs) return;

    // timeout
    if (!attempt.answers[q.id]) {
      attempt.answers[q.id] = {
        question_id: q.id,
        submitted_at: nowIso(),
        answer_json: { empty: true },
        is_correct: false,
        awarded_points: 0,
        auto_submitted: true,
        time_spent_ms: limitMs,
      };
    }

    attempt.current_question_order += 1;
    attempt.current_question_started_at = nowIso();
    // loop дальше — вдруг следующий вопрос тоже "просрочен" (если кто-то долго не трогал вкладку)
  }
}

function publicQuestionDto(q: MockQuestion) {
  return {
    id: q.id,
    order: q.order,
    type: q.type,
    text: q.text,
    points: q.points,
    time_limit_seconds: q.time_limit_seconds,
    options: q.type === "text" ? undefined : q.options.map((o) => ({ id: o.id, text: o.text })),
    media: [...q.media].sort((a, b) => a.sort_order - b.sort_order),
  };
}

function computeLeaderboard(db: MockDb, quizId: string) {
  const finished = db.attempts
    .filter((a) => a.quiz_id === quizId && (a.status === "finished" || a.status === "forced_finished"))
    .map((a) => {
      const p = db.participants.find((x) => x.id === a.participant_id)!;
      return {
        attempt_id: a.id,
        participant_id: p.id,
        display_name: toInitialsFio(p.fio_norm),
        score: a.score,
        total_time_ms: a.total_time_ms ?? 0,
        finished_at: a.finished_at ?? "",
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.total_time_ms !== b.total_time_ms) return a.total_time_ms - b.total_time_ms;
      return a.finished_at.localeCompare(b.finished_at);
    });

  const rows = finished.map((x, idx) => ({ rank: idx + 1, ...x }));
  return rows;
}

function isAdmin() {
  return localStorage.getItem(LS_ADMIN) === "1";
}

export const mockApi: Api = {
  async health() {
    return { ok: true };
  },

  async getActiveQuiz() {
    const db = loadDb();
    const quiz = getQuiz(db);
    return computeQuizState(quiz, Date.now());
  },

  async me() {
    const participantId = getParticipantId();
    if (isAdmin()) return { role: "admin" as const, display_name: null };
    if (participantId) {
      const db = loadDb();
      const p = db.participants.find((x) => x.id === participantId);
      return { role: "participant" as const, display_name: p ? toInitialsFio(p.fio_norm) : null };
    }
    return { role: "anonymous" as const, display_name: null };
  },

  async registerParticipant(input: ParticipantRegisterRequest): Promise<ParticipantRegisterResponse> {
    const db = loadDb();

    const nickname = normalizeSpaces(input.nickname);
    if (!nickname) throw new ApiError("Bad Request", 400, { detail: "nickname required" });
    const fio_norm = nickname;
    const group_norm = "";
    const vk_norm = normalizeVkUrl(input.vk_url);
    if (!vk_norm) throw new ApiError("Bad Request", 400, { field: "vk_url", detail: "invalid" });

    // unique (fio_norm + group_norm)
    const existing = db.participants.find((p) => p.fio_norm === fio_norm && p.group_norm === group_norm);
    const p =
      existing ??
      ({
        id: uuid(),
        fio_raw: nickname,
        fio_norm,
        group_raw: "",
        group_norm,
        vk_url_raw: input.vk_url,
        vk_url_norm: vk_norm,
        created_at: nowIso(),
      } satisfies MockParticipant);

    if (!existing) db.participants.push(p);

    localStorage.setItem(LS_PARTICIPANT_ID, p.id);

    saveDb(db);
    return { participant_id: p.id };
  },

  async startAttempt(): Promise<AttemptStartResponse> {
    const db = loadDb();
    const quiz = getQuiz(db);
    const quizState = computeQuizState(quiz, Date.now());
    if (!quiz || quizState.state !== "running") throw new ApiError("Quiz not available", 409, quizState);

    const participantId = requireParticipantId();
    const attempt = ensureAttempt(db, quiz.id, participantId);

    if (attempt.status === "finished" || attempt.status === "forced_finished") {
      saveDb(db);
      return { status: attempt.status };
    }

    if (attempt.status === "registered") {
      attempt.status = "in_progress";
      attempt.started_at = nowIso();
      attempt.current_question_order = 1;
      attempt.current_question_started_at = attempt.started_at;
    }

    saveDb(db);
    return { status: attempt.status };
  },

  async getCurrentQuestion(): Promise<CurrentQuestionResponse> {
    const db = loadDb();
    const quiz = getQuiz(db);
    const quizState = computeQuizState(quiz, Date.now());
    if (!quiz || (quizState.state !== "running" && quizState.state !== "ended")) {
      throw new ApiError("Quiz not available", 409, quizState);
    }

    const participantId = requireParticipantId();
    const attempt = ensureAttempt(db, quiz.id, participantId);

    if (attempt.status === "registered") {
      saveDb(db);
      return {
        attempt_status: attempt.status,
        question: null,
        time_left_seconds: null,
        progress: { current: 0, total: getQuestions(db, quiz.id).length },
      };
    }

    if (attempt.status === "in_progress") syncAttemptProgress(db, quiz, attempt);

    if (attempt.status === "finished" || attempt.status === "forced_finished") {
      saveDb(db);
      return {
        attempt_status: attempt.status,
        question: null,
        time_left_seconds: null,
        progress: { current: getQuestions(db, quiz.id).length, total: getQuestions(db, quiz.id).length },
      };
    }

    const questions = getQuestions(db, quiz.id);
    const q = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!q) {
      finishAttempt(attempt, "finished");
      saveDb(db);
      return {
        attempt_status: attempt.status,
        question: null,
        time_left_seconds: null,
        progress: { current: questions.length, total: questions.length },
      };
    }

    let timeLeft: number | null = null;
    if (q.time_limit_seconds != null) {
      const startedAtIso = attempt.current_question_started_at ?? attempt.started_at;
      if (startedAtIso) {
        const elapsed = Date.now() - isoToMs(startedAtIso);
        timeLeft = clamp(q.time_limit_seconds - Math.floor(elapsed / 1000), 0, q.time_limit_seconds);
      } else {
        timeLeft = q.time_limit_seconds;
      }
    }

    saveDb(db);
    return {
      attempt_status: attempt.status,
      question: publicQuestionDto(q),
      time_left_seconds: timeLeft,
      progress: { current: q.order, total: questions.length },
    };
  },

  async answerCurrentQuestion(input: AnswerCurrentQuestionRequest): Promise<AnswerCurrentQuestionResponse> {
    const db = loadDb();
    const quiz = getQuiz(db);
    if (!quiz) throw new ApiError("No quiz", 404, null);

    const participantId = requireParticipantId();
    const attempt = ensureAttempt(db, quiz.id, participantId);
    if (attempt.status !== "in_progress") throw new ApiError("Not in progress", 409, { status: attempt.status });

    syncAttemptProgress(db, quiz, attempt);
    if (attempt.status !== "in_progress") {
      saveDb(db);
      throw new ApiError("Not in progress", 409, { status: attempt.status });
    }

    const questions = getQuestions(db, quiz.id);
    const current = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!current) {
      finishAttempt(attempt, "finished");
      saveDb(db);
      return { ok: true };
    }

    if (input.question_id !== current.id) {
      saveDb(db);
      throw new ApiError("Question outdated", 409, { detail: "outdated_question" });
    }

    const startedAtIso = attempt.current_question_started_at ?? attempt.started_at ?? nowIso();
    const spentMs = Math.max(0, Date.now() - isoToMs(startedAtIso));

    const verdict = evaluateQuestion(current, input);
    attempt.answers[current.id] = {
      question_id: current.id,
      submitted_at: nowIso(),
      answer_json:
        current.type === "text"
          ? { text: input.text ?? "" }
          : current.type === "single"
            ? { option_id: (input.option_ids ?? [])[0] ?? null }
            : { option_ids: input.option_ids ?? [] },
      is_correct: verdict.isCorrect,
      awarded_points: verdict.awarded,
      auto_submitted: false,
      time_spent_ms: spentMs,
    };

    // пересчёт score (простая сумма)
    attempt.score = Object.values(attempt.answers).reduce((acc, a) => acc + a.awarded_points, 0);

    attempt.current_question_order += 1;
    attempt.current_question_started_at = nowIso();

    // может завершиться
    const next = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!next) finishAttempt(attempt, "finished");

    saveDb(db);
    return { ok: true };
  },

  async skipCurrentQuestion(question_id: number) {
    const db = loadDb();
    const quiz = getQuiz(db);
    if (!quiz) throw new ApiError("No quiz", 404, null);

    const participantId = requireParticipantId();
    const attempt = ensureAttempt(db, quiz.id, participantId);
    if (attempt.status !== "in_progress") throw new ApiError("Not in progress", 409, { status: attempt.status });

    syncAttemptProgress(db, quiz, attempt);
    if (attempt.status !== "in_progress") {
      saveDb(db);
      throw new ApiError("Not in progress", 409, { status: attempt.status });
    }

    const questions = getQuestions(db, quiz.id);
    const current = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!current) {
      finishAttempt(attempt, "finished");
      saveDb(db);
      return { ok: true };
    }

    if (question_id !== current.id) {
      saveDb(db);
      throw new ApiError("Question outdated", 409, { detail: "outdated_question" });
    }

    const startedAtIso = attempt.current_question_started_at ?? attempt.started_at ?? nowIso();
    const spentMs = Math.max(0, Date.now() - isoToMs(startedAtIso));

    if (!attempt.answers[current.id]) {
      attempt.answers[current.id] = {
        question_id: current.id,
        submitted_at: nowIso(),
        answer_json: { skipped: true },
        is_correct: false,
        awarded_points: 0,
        auto_submitted: false,
        time_spent_ms: spentMs,
      };
    }

    attempt.current_question_order += 1;
    attempt.current_question_started_at = nowIso();

    const next = questions.find((x) => x.order === attempt.current_question_order) ?? null;
    if (!next) finishAttempt(attempt, "finished");

    saveDb(db);
    return { ok: true };
  },

  async getResult(): Promise<ResultResponse> {
    const db = loadDb();
    const quiz = getQuiz(db);
    if (!quiz) throw new ApiError("No quiz", 404, null);

    const participantId = requireParticipantId();
    const attempt = findAttempt(db, quiz.id, participantId);
    if (!attempt) {
      return { status: "registered", score: 0, place: null, total_time_ms: null };
    }

    if (attempt.status === "in_progress") syncAttemptProgress(db, quiz, attempt);

    const leaderboard = computeLeaderboard(db, quiz.id);
    const myRow = leaderboard.find((r) => r.participant_id === participantId) ?? null;

    saveDb(db);
    return {
      status: attempt.status,
      score: attempt.score,
      place: myRow ? myRow.rank : null,
      total_time_ms: attempt.total_time_ms,
    };
  },

  async getLeaderboard(limit = 20): Promise<LeaderboardResponse> {
    const db = loadDb();
    const quiz = getQuiz(db);
    if (!quiz) return { top: [], me: null, me_status: "not_started" };

    const participantId = getParticipantId();

    const rows = computeLeaderboard(db, quiz.id);
    const top = rows.slice(0, limit).map((r) => ({
      rank: r.rank,
      display_name: r.display_name,
      score: r.score,
      total_time_ms: r.total_time_ms,
    }));

    const attempt = participantId ? findAttempt(db, quiz.id, participantId) : null;
    const me_status = attempt ? attempt.status : "not_started";
    const meRow = participantId ? rows.find((r) => r.participant_id === participantId) ?? null : null;
    const me = meRow
      ? { rank: meRow.rank, display_name: meRow.display_name, score: meRow.score, total_time_ms: meRow.total_time_ms }
      : null;

    return { top, me, me_status };
  },

  async adminLogin(input: AdminLoginRequest): Promise<AdminLoginResponse> {
    // mock пароль
    if (input.password !== "admin") throw new ApiError("Forbidden", 403, { detail: "bad_password" });
    localStorage.setItem(LS_ADMIN, "1");
    return { ok: true };
  },

  async adminLogout() {
    localStorage.removeItem(LS_ADMIN);
    return { ok: true };
  },

  async adminStatsSummary(): Promise<StatsSummaryResponse> {
    if (!isAdmin()) throw new ApiError("Forbidden", 403, { detail: "admin_required" });
    const db = loadDb();
    const quiz = getQuiz(db);
    if (!quiz) return { registered: 0, started: 0, in_progress: 0, finished: 0, forced_finished: 0 };

    const attempts = db.attempts.filter((a) => a.quiz_id === quiz.id);
    return {
      registered: attempts.filter((a) => a.status === "registered").length,
      started: attempts.filter((a) => a.status !== "registered").length,
      in_progress: attempts.filter((a) => a.status === "in_progress").length,
      finished: attempts.filter((a) => a.status === "finished").length,
      forced_finished: attempts.filter((a) => a.status === "forced_finished").length,
    };
  },
};
