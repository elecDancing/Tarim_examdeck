export type QuestionType = "判断题" | "单选题" | "多选题" | "其他";

export type ProficiencyLevel = "已熟练" | "欠熟练" | "学习中" | "未学习";

export type ChoiceOption = {
  key: string;
  html: string;
  text: string;
};

export type Question = {
  id: string;
  uid: string;
  type: QuestionType;
  stemHtml: string;
  stemText: string;
  imageUrls?: string[];
  options: ChoiceOption[];
  answerKeys: string[];
  answerText: string;
  explanationHtml: string;
  tags: string[];
  source: string;
  rawFront: string;
  rawBack: string;
};

export type QuestionStat = {
  questionId: string;
  seen: number;
  correct: number;
  wrong: number;
  correctStreak: number;
  lastSeenAt?: string;
  lastWrongAt?: string;
};

export type DailyStudyStat = {
  date: string;
  answered: number;
  correct: number;
  wrong: number;
};

export type DailyMistakeSummary = {
  date: string;
  generatedAt: string;
  questionIds: string[];
};

export type DailyReviewCompletion = {
  date: string;
  deckId: string;
  completedAt: string;
  finished: number;
  wrong: number;
};

export type Deck = {
  id: string;
  name: string;
  questionIds: string[];
  createdAt: string;
  updatedAt: string;
  isSeed?: boolean;
};

export type ExamConfig = {
  judgeCount: number;
  singleCount: number;
  multipleCount: number;
  wrongFirst: boolean;
  excludeRecent: boolean;
  shuffleOptions: boolean;
  tags: string[];
};

export type ExamItem = {
  questionId: string;
  optionOrder: string[];
  selectedKeys: string[];
  isCorrect?: boolean;
};

export type DailyReviewItem = ExamItem & {
  dueAt: string;
  intervalDays: number;
  overdueDays: number;
};

export type DailyReviewSession = {
  id: string;
  deckId: string;
  startedAt: string;
  updatedAt: string;
  reviewIndex: number;
  items: DailyReviewItem[];
};

export type ExamSession = {
  id: string;
  deckId: string;
  startedAt: string;
  submittedAt?: string;
  config: ExamConfig;
  items: ExamItem[];
  currentIndex?: number;
  durationSeconds?: number;
  score?: number;
};

export type PracticeMode = "answer" | "review";

export type PracticeState = {
  deckId: string;
  scope?: "deck" | "favorites" | "mistakes";
  questionIds: string[];
  currentIndex: number;
  reviewIndex?: number;
  mode?: PracticeMode;
  optionOrders?: Record<string, string[]>;
  shuffleOptions?: boolean;
  shuffleQuestions?: boolean;
  autoAdvanceCorrect?: boolean;
  answers: Record<string, string[]>;
  results?: Record<string, boolean>;
  startedAt: string;
  updatedAt: string;
  submittedAt?: string;
  score?: number;
};

export type ImportReport = {
  totalRows: number;
  imported: number;
  skipped: number;
  images?: number;
  errors: string[];
  skippedRows?: ImportSkippedRow[];
};

export type ImportSkippedRow = {
  rowNumber: number;
  serial?: string;
  source?: string;
  reason: string;
  detail?: string;
};

export type AppData = {
  questions: Question[];
  decks: Deck[];
  stats: Record<string, QuestionStat>;
  dailyStats: Record<string, DailyStudyStat>;
  notes: Record<string, string>;
  favoriteQuestionIds: string[];
  slashedQuestionIds: string[];
  autoHardQuestionIds: string[];
  studyPlanDeckIds: string[];
  sessions: ExamSession[];
  activeSession: ExamSession | null;
  practices: Record<string, PracticeState>;
  dailyReviewSessions: Record<string, DailyReviewSession>;
  dailyReviewSession: DailyReviewSession | null;
  dailyMistakeSummary: DailyMistakeSummary | null;
  dailyReviewCompletion: DailyReviewCompletion | null;
  seedImported: boolean;
};
