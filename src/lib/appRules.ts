import type { AppData, ChoiceOption, DailyMistakeSummary, DailyReviewItem, DailyReviewSession, DailyStudyStat, Deck, ExamConfig, ExamItem, ExamSession, ImportReport, PracticeMode, PracticeState, ProficiencyLevel, Question, QuestionStat, QuestionType } from "../types";
import katex from "katex";
import { mergeQuestions } from "./excelImport";
import { isStoredImageRef } from "./imageStore";
import { normalizeQuestionContentText } from "./textCleanup";

export type DailyReviewSummary = {
  learned: number;
  due: number;
  overdue: number;
  dueToday: number;
  totalDue: number;
  totalOverdue: number;
  capped: boolean;
};

export type ReviewForecastDay = {
  dayOffset: number;
  label: string;
  count: number;
  cumulative: number;
};

type SeedDeckConfig = {
  id: string;
  name: string;
  file: string;
  source?: string;
};

const TYPE_ORDER: QuestionType[] = ["判断题", "单选题", "多选题"];
const PRACTICE_INTERLEAVE_TYPES: QuestionType[] = ["单选题", "判断题", "多选题"];
const PROFICIENCY_LEVELS: ProficiencyLevel[] = ["已熟练", "欠熟练", "学习中", "未学习"];
const PROFICIENCY_CHART_LEVELS: ProficiencyLevel[] = ["未学习", "学习中", "欠熟练", "已熟练"];
const QUICK_EXAM_TOTAL = 100;
const DAILY_REVIEW_LIMIT = 1000;
const MISTAKE_CLEAR_CORRECT_STREAK = 3;
const AUTO_SLASH_CORRECT_STREAK = 5;
const BOOTSTRAP_PROGRESS_MARKER_KEY = "examdeck:bootstrap-progress:2026-06-29-18-25-00";
const ALL_DAILY_REVIEW_DECK_ID = "deck_all_daily_review";
const LIGHT_HYDROCARBON_DECK_ID = "deck_light_hydrocarbon_senior_technician";
const HARD_QUESTION_DECK_ID = "deck_hard_low_accuracy";
const HARD_QUESTION_DECK_NAME = "重难题";
const HARD_QUESTION_RATE_THRESHOLD = 0.5;
const HARD_QUESTION_MIN_ATTEMPTS = 2;
const HARD_QUESTION_RECOVERY_CORRECT_STREAK = 2;
const MANUAL_HARD_QUESTION_BLOCK_RATE_THRESHOLD = 0.75;
const DEFAULT_CONFIG: ExamConfig = {
  judgeCount: 0,
  singleCount: 0,
  multipleCount: 0,
  wrongFirst: true,
  excludeRecent: false,
  shuffleOptions: true,
  tags: []
};
const BUNDLED_SAFETY_IMAGE_PATHS: Record<string, string> = {
  "0010": "/question-images/safety/safety-0010-image-01.png",
  "0011": "/question-images/safety/safety-0011-image-02.png",
  "0015": "/question-images/safety/safety-0015-image-03.png",
  "0148": "/question-images/safety/safety-0148-image-04.png",
  "0192": "/question-images/safety/safety-0192-image-05.png",
  "0220": "/question-images/safety/safety-0220-image-06.png",
  "0242": "/question-images/safety/safety-0242-image-07.png",
  "0593": "/question-images/safety/safety-0593-image-08.png",
  "0594": "/question-images/safety/safety-0594-image-09.png",
  "0598": "/question-images/safety/safety-0598-image-10.png",
  "0599": "/question-images/safety/safety-0599-image-11.png",
  "0602": "/question-images/safety/safety-0602-image-12.png",
  "0603": "/question-images/safety/safety-0603-image-13.png",
  "0605": "/question-images/safety/safety-0605-image-14.png",
  "0606": "/question-images/safety/safety-0606-image-15.png",
  "0608": "/question-images/safety/safety-0608-image-16.png",
  "0609": "/question-images/safety/safety-0609-image-17.png",
  "0611": "/question-images/safety/safety-0611-image-18.png",
  "0614": "/question-images/safety/safety-0614-image-19.png",
  "0615": "/question-images/safety/safety-0615-image-20.png",
  "0849": "/question-images/safety/safety-0849-image-21.png",
  "0861": "/question-images/safety/safety-0861-image-22.png",
  "0871": "/question-images/safety/safety-0871-image-23.png",
  "0877": "/question-images/safety/safety-0877-image-24.png",
  "0881": "/question-images/safety/safety-0881-image-25.png",
  "0917": "/question-images/safety/safety-0917-image-26.png",
  "0986": "/question-images/safety/safety-0986-image-27.png",
  "0993": "/question-images/safety/safety-0993-image-28.png"
};
const SEED_DECKS: SeedDeckConfig[] = [
  { id: "deck_gas_purification_junior", name: "天然气净化工初级工", file: "gas-purification-junior.xlsx" },
  { id: "deck_gas_purification_intermediate", name: "天然气净化工中级工", file: "gas-purification-intermediate.xlsx" },
  { id: "deck_gas_purification_senior", name: "天然气净化工高级工", file: "gas-purification-senior.xlsx" },
  { id: "deck_tech", name: "天然气净化工技师", file: "tech.xlsx", source: "技师题" },
  { id: LIGHT_HYDROCARBON_DECK_ID, name: "轻烃操作工高级工及技师", file: "light-hydrocarbon-senior-technician.xlsx" },
  { id: "deck_oilfield_risk_control", name: "油气田开发危害因素辨识与风险防控", file: "oilfield-risk-control.xlsx" },
  { id: "deck_oil_production_junior", name: "采油工初级", file: "oil-production-junior.xlsx" },
  { id: "deck_oil_production_intermediate", name: "采油工中级", file: "oil-production-intermediate.xlsx" },
  { id: "deck_oil_production_senior", name: "采油工高级", file: "oil-production-senior.xlsx" },
  { id: "deck_oil_production_technician", name: "采油工技师", file: "oil-production-technician.xlsx" },
  { id: "deck_gathering_transportation_junior", name: "集输工初级", file: "gathering-transportation-junior.xlsx" },
  { id: "deck_gathering_transportation_intermediate", name: "集输工中级", file: "gathering-transportation-intermediate.xlsx" },
  { id: "deck_gathering_transportation_senior", name: "集输工高级", file: "gathering-transportation-senior.xlsx" },
  { id: "deck_gathering_transportation_technician", name: "集输工技师", file: "gathering-transportation-technician.xlsx" }
] as const;

export function countByType(questions: Question[]) {
  return TYPE_ORDER.reduce((counts, type) => {
    counts[type] = questions.filter((question) => question.type === type).length;
    return counts;
  }, { "判断题": 0, "单选题": 0, "多选题": 0, "其他": 0 } as Record<QuestionType, number>);
}

export function buildDefaultExamConfig(questions: Question[]): ExamConfig {
  const counts = countByType(questions);
  const typeTargets = ([
    ["判断题", "judgeCount"],
    ["单选题", "singleCount"],
    ["多选题", "multipleCount"]
  ] as const).map(([type, key], index) => ({ type, key, index, available: counts[type] }));
  const availableTotal = typeTargets.reduce((sum, item) => sum + item.available, 0);
  const targetTotal = Math.min(QUICK_EXAM_TOTAL, availableTotal);
  const targets = { judgeCount: 0, singleCount: 0, multipleCount: 0 };

  if (availableTotal > 0) {
    const allocations = typeTargets.map((item) => {
      const exact = item.available / availableTotal * targetTotal;
      const allocated = Math.floor(exact);
      targets[item.key] = allocated;
      return { ...item, remainder: exact - allocated };
    });
    let remaining = targetTotal - Object.values(targets).reduce((sum, value) => sum + value, 0);

    allocations
      .sort((a, b) => b.remainder - a.remainder || a.index - b.index)
      .forEach((item) => {
        if (remaining <= 0 || targets[item.key] >= item.available) return;
        targets[item.key] += 1;
        remaining -= 1;
      });
  }

  return {
    ...DEFAULT_CONFIG,
    judgeCount: targets.judgeCount,
    singleCount: targets.singleCount,
    multipleCount: targets.multipleCount,
    wrongFirst: true,
    shuffleOptions: true,
    excludeRecent: false
  };
}

export function buildQuickExamConfig(questions: Question[]): ExamConfig {
  return buildDefaultExamConfig(questions);
}

export function getProficiency(stat?: QuestionStat, isSlashed = false): ProficiencyLevel {
  if (isSlashed) return "已熟练";
  if (!stat || stat.seen === 0) return "未学习";
  const rate = stat.correct / Math.max(1, stat.seen);
  const recentlyWrong = stat.lastWrongAt && Date.now() - new Date(stat.lastWrongAt).getTime() < 1000 * 60 * 60 * 24 * 7;

  if (stat.seen >= 4 && stat.correctStreak >= 3 && rate >= 0.85) return "已熟练";
  if (stat.seen >= 3 && (rate < 0.65 || stat.correctStreak === 0 || recentlyWrong)) return "欠熟练";
  return "学习中";
}

export function getProficiencyClass(level: ProficiencyLevel) {
  return {
    "已熟练": "mastered",
    "欠熟练": "weak",
    "学习中": "learning",
    "未学习": "new"
  }[level];
}

export function getQuestionImageUrls(question: Question) {
  return question.imageUrls ?? [];
}

export function countProficiency(questions: Question[], stats: Record<string, QuestionStat>, slashedQuestionIds = new Set<string>()) {
  return questions.reduce((counts, question) => {
    const level = getProficiency(stats[question.id], slashedQuestionIds.has(question.id));
    counts[level] += 1;
    return counts;
  }, { "已熟练": 0, "欠熟练": 0, "学习中": 0, "未学习": 0 } as Record<ProficiencyLevel, number>);
}

export function isActiveMistake(stat?: QuestionStat) {
  return (stat?.wrong ?? 0) > 0 && (stat?.correctStreak ?? 0) < MISTAKE_CLEAR_CORRECT_STREAK;
}

export function shouldTriggerMistakeClearAnimation(stat: QuestionStat | undefined, isCorrect: boolean) {
  return isCorrect && isActiveMistake(stat) && (stat?.correctStreak ?? 0) + 1 >= MISTAKE_CLEAR_CORRECT_STREAK;
}

export function shouldTriggerHardQuestionClearAnimation(data: AppData, questionId: string, isCorrect: boolean) {
  if (!isQuestionInHardDeck(data, questionId)) return false;
  if (new Set(data.slashedQuestionIds ?? []).has(questionId)) return false;
  const projectedStat = buildQuestionResultStat(data.stats[questionId], questionId, isCorrect);
  return isRecoveredHardQuestion(projectedStat);
}

export function buildDailySummaryWrongQuestions(questions: Question[], stats: Record<string, QuestionStat>, summaryDateKey: string) {
  return questions
    .filter((question) => {
      const lastWrongAt = stats[question.id]?.lastWrongAt;
      return Boolean(lastWrongAt && getDailySummaryDateKey(new Date(lastWrongAt)) === summaryDateKey);
    })
    .sort((questionA, questionB) => {
      const lastWrongA = stats[questionA.id]?.lastWrongAt;
      const lastWrongB = stats[questionB.id]?.lastWrongAt;
      const wrongA = lastWrongA ? new Date(lastWrongA).getTime() : 0;
      const wrongB = lastWrongB ? new Date(lastWrongB).getTime() : 0;
      return wrongB - wrongA || questionA.uid.localeCompare(questionB.uid, "zh-CN");
    });
}

export function buildReviewDayActivitySummary(stats: Record<string, QuestionStat>, reviewDateKey: string) {
  const touchedStats = Object.values(stats).filter((stat) => (
    stat.lastSeenAt && getDailySummaryDateKey(new Date(stat.lastSeenAt)) === reviewDateKey
  ));
  const wrong = touchedStats.filter((stat) => (
    stat.lastWrongAt && getDailySummaryDateKey(new Date(stat.lastWrongAt)) === reviewDateKey
  )).length;
  return {
    answered: touchedStats.length,
    wrong
  };
}

export function isAllDailyReviewCompleteForToday(data: AppData, slashedQuestionSet: Set<string>) {
  const todayKey = getDailySummaryDateKey(new Date());
  const activeDailySession = getCurrentDailyReviewSession(data, ALL_DAILY_REVIEW_DECK_ID, todayKey);
  if (activeDailySession) return false;

  const allReviewDeck = buildAllDailyReviewDeck(data.decks);
  const reviewQuestions = getDeckQuestions(data.questions, allReviewDeck).filter((question) => !slashedQuestionSet.has(question.id));
  const reviewSummary = buildDailyReviewSummary(reviewQuestions, data.stats);
  if (reviewSummary.due > 0) return false;

  const completion = data.dailyReviewCompletion;
  const hasCompletionRecord = completion?.date === todayKey && completion.deckId === ALL_DAILY_REVIEW_DECK_ID;
  const reviewDayActivity = buildReviewDayActivitySummary(data.stats, todayKey);
  return hasCompletionRecord || reviewDayActivity.answered > 0;
}

export function searchQuestions(questions: Question[], rawQuery: string, limit: number) {
  const terms = getSearchTerms(rawQuery);
  if (terms.length === 0) return [];

  return questions
    .map((question) => ({ question, score: scoreQuestionMatch(question, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.question.uid.localeCompare(b.question.uid, "zh-CN"))
    .slice(0, limit)
    .map((item) => item.question);
}

export function getSearchTerms(rawQuery: string) {
  return normalizeSearchText(rawQuery).split(" ").filter(Boolean);
}

export function buildHighlightRegex(terms: string[]) {
  const normalized = [...new Set(terms.map((term) => term.trim()).filter(Boolean))]
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  if (normalized.length === 0) return null;
  return new RegExp(`(${normalized.join("|")})`, "gi");
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function groupQuestionsByType(questions: Question[]) {
  return ([...TYPE_ORDER, "其他"] as QuestionType[])
    .map((type) => ({ type, questions: questions.filter((question) => question.type === type) }))
    .filter((group) => group.questions.length > 0);
}

export function scoreQuestionMatch(question: Question, terms: string[]) {
  const fields = [
    { text: question.stemText, weight: 3200 },
    { text: question.options.map((option) => option.text).join(" "), weight: 1800 }
  ];

  return terms.reduce((total, term) => {
    const termScore = Math.max(...fields.map((field) => scoreSearchField(field.text, term, field.weight)));
    return termScore > 0 && total >= 0 ? total + termScore : -1;
  }, 0);
}

export function scoreSearchField(value: string, term: string, weight: number) {
  const text = normalizeSearchText(value);
  if (!text || !term) return 0;
  const exactIndex = text.indexOf(term);
  if (exactIndex >= 0) {
    const earlyBonus = Math.max(0, 2400 - exactIndex * 35);
    const startBonus = exactIndex === 0 ? 900 : 0;
    const densityBonus = Math.round((term.length / Math.max(term.length, text.length)) * 500);
    return weight + earlyBonus + startBonus + term.length * 90 + densityBonus;
  }
  if (!canUseOrderedFuzzy(term)) return 0;
  const fuzzyScore = orderedMatchScore(text, term);
  return fuzzyScore ? Math.round((weight * fuzzyScore) / 560) : 0;
}

export function canUseOrderedFuzzy(term: string) {
  return term.length >= 3 && /^[\u4e00-\u9fff]+$/.test(term);
}

export function orderedMatchScore(text: string, term: string) {
  let cursor = -1;
  let gap = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  for (const char of term) {
    const nextIndex = text.indexOf(char, cursor + 1);
    if (nextIndex < 0) return 0;
    if (firstIndex < 0) firstIndex = nextIndex;
    lastIndex = nextIndex;
    gap += nextIndex - cursor - 1;
    cursor = nextIndex;
  }
  const span = lastIndex - firstIndex + 1;
  const density = term.length / Math.max(term.length, span);
  if (density < 0.58) return 0;
  return Math.max(24, 260 - gap * 18 + term.length * 12);
}

export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDeckNamesByQuestionId(decks: Deck[]) {
  const names = new Map<string, string[]>();
  decks.forEach((deck) => {
    deck.questionIds.forEach((questionId) => {
      const existing = names.get(questionId) ?? [];
      names.set(questionId, [...existing, deck.name]);
    });
  });
  return names;
}

export function getQuestionDeckNames(questionId: string, decks: Deck[]) {
  return decks.filter((deck) => deck.questionIds.includes(questionId)).map((deck) => deck.name);
}

export function buildProficiencyPieStyle(counts: Record<ProficiencyLevel, number>, total: number, levels = PROFICIENCY_LEVELS) {
  if (total === 0) return { background: "#e9eef2" };
  let cursor = 0;
  const stops = levels
    .filter((level) => counts[level] > 0)
    .map((level) => {
    const start = cursor;
    cursor += (counts[level] / total) * 100;
    return `${getProficiencyChartColor(level)} ${start}% ${cursor}%`;
  });
  return { background: stops.length ? `conic-gradient(${stops.join(", ")})` : "#e9eef2" };
}

export function buildPieSegments(counts: Record<ProficiencyLevel, number>, total: number, levels: ProficiencyLevel[]) {
  if (total === 0) return [];
  let startAngle = 0;
  return levels
    .filter((level) => counts[level] > 0)
    .map((level) => {
      const count = counts[level];
      const angle = (count / total) * 360;
      const endAngle = startAngle + angle;
      const segment = {
        level,
        count,
        color: getProficiencyChartColor(level),
        path: describePieSlice(50, 50, 45, startAngle, endAngle),
        full: angle >= 359.99
      };
      startAngle = endAngle;
      return segment;
    });
}

export function describePieSlice(cx: number, cy: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, radius, startAngle);
  const end = polarToCartesian(cx, cy, radius, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`,
    "Z"
  ].join(" ");
}

export function polarToCartesian(cx: number, cy: number, radius: number, angleInDegrees: number) {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians)
  };
}

export function getProficiencyChartColor(level: ProficiencyLevel) {
  return {
    "未学习": "#5aaed6",
    "学习中": "#ff8a1c",
    "欠熟练": "#56c76e",
    "已熟练": "#00a651"
  }[level];
}

export function formatPercent(count: number, total: number) {
  if (total === 0 || count === 0) return "0%";
  const value = Math.round((count / total) * 1000) / 10;
  return `${value}%`;
}

export function buildDailyReviewSummary(questions: Question[], stats: Record<string, QuestionStat>): DailyReviewSummary {
  const learned = questions.filter((question) => isLearnedQuestion(stats[question.id])).length;
  const allDueItems = buildDailyReviewCandidates(questions, stats);
  const plan = allDueItems.slice(0, DAILY_REVIEW_LIMIT);
  const overdue = plan.filter((item) => item.overdueDays > 0).length;
  const totalOverdue = allDueItems.filter((item) => item.overdueDays > 0).length;
  return {
    learned,
    due: plan.length,
    overdue,
    dueToday: plan.length - overdue,
    totalDue: allDueItems.length,
    totalOverdue,
    capped: allDueItems.length > DAILY_REVIEW_LIMIT
  };
}

export function buildDailyReviewPlan(questions: Question[], stats: Record<string, QuestionStat>, now = new Date(), limit = DAILY_REVIEW_LIMIT): DailyReviewItem[] {
  return buildDailyReviewCandidates(questions, stats, now).slice(0, Math.max(0, limit));
}

export function buildDailyReviewCandidates(questions: Question[], stats: Record<string, QuestionStat>, now = new Date()): DailyReviewItem[] {
  const todayStart = startOfReviewDay(now);
  return questions
    .map((question) => {
      const stat = stats[question.id];
      if (!isLearnedQuestion(stat)) return null;
      const intervalDays = getReviewIntervalDays(stat);
      const dueDate = getReviewDueDate(stat);
      if (dueDate.getTime() > todayStart.getTime()) return null;
      const overdueDays = Math.max(0, differenceInReviewDays(todayStart, dueDate));
      const reviewItem: DailyReviewItem = {
        questionId: question.id,
        optionOrder: question.options.map((option) => option.key),
        selectedKeys: [],
        dueAt: dueDate.toISOString(),
        intervalDays,
        overdueDays
      };
      return reviewItem;
    })
    .filter((item): item is DailyReviewItem => Boolean(item))
    .sort((a, b) => compareDailyReviewNeed(a, b, stats));
}

export function compareDailyReviewNeed(a: DailyReviewItem, b: DailyReviewItem, stats: Record<string, QuestionStat>) {
  const statA = stats[a.questionId];
  const statB = stats[b.questionId];
  const rateA = statA?.seen ? statA.correct / statA.seen : 0;
  const rateB = statB?.seen ? statB.correct / statB.seen : 0;
  return b.overdueDays - a.overdueDays
    || (statB?.wrong ?? 0) - (statA?.wrong ?? 0)
    || rateA - rateB
    || (statA?.correctStreak ?? 0) - (statB?.correctStreak ?? 0)
    || parseStatDate(statB?.lastWrongAt).getTime() - parseStatDate(statA?.lastWrongAt).getTime()
    || parseStatDate(statA?.lastSeenAt).getTime() - parseStatDate(statB?.lastSeenAt).getTime();
}

export function buildReviewForecast(questions: Question[], stats: Record<string, QuestionStat>, dayCount: number): ReviewForecastDay[] {
  const todayStart = startOfReviewDay(new Date());
  const counts = Array.from({ length: dayCount }, () => 0);

  questions.forEach((question) => {
    const stat = stats[question.id];
    if (!isLearnedQuestion(stat)) return;
    const dueDate = getReviewDueDate(stat);
    const offset = Math.max(0, differenceInReviewDays(dueDate, todayStart));
    if (offset < dayCount) {
      counts[offset] += 1;
    }
  });

  let cumulative = 0;
  return counts.map((count, dayOffset) => {
    cumulative += count;
    return {
      dayOffset,
      label: formatForecastDayLabel(dayOffset),
      count,
      cumulative
    };
  });
}

export function buildReviewForecastQuestionGroups(questions: Question[], stats: Record<string, QuestionStat>, dayCount: number) {
  const todayStart = startOfReviewDay(new Date());
  const groups = new Map<number, Question[]>();

  questions.forEach((question) => {
    const stat = stats[question.id];
    if (!isLearnedQuestion(stat)) return;
    const dueDate = getReviewDueDate(stat);
    const offset = Math.max(0, differenceInReviewDays(dueDate, todayStart));
    if (offset >= dayCount) return;
    groups.set(offset, [...(groups.get(offset) ?? []), question]);
  });

  return groups;
}

export function buildForecastCumulativePoints(forecast: ReviewForecastDay[], cumulativeMax: number) {
  if (forecast.length === 0) return "";
  return forecast
    .map((day, index) => {
      const x = forecast.length === 1 ? 0 : (index / (forecast.length - 1)) * 100;
      const y = 100 - (day.cumulative / cumulativeMax) * 100;
      return `${x.toFixed(2)},${Math.max(0, Math.min(100, y)).toFixed(2)}`;
    })
    .join(" ");
}

export function formatForecastDayLabel(dayOffset: number) {
  if (dayOffset === 0) return "今天";
  if (dayOffset === 1) return "明天";
  return `${dayOffset} 天后`;
}

export function isLearnedQuestion(stat?: QuestionStat) {
  return Boolean(stat && stat.seen > 0);
}

export function getReviewIntervalDays(stat: QuestionStat) {
  if (stat.seen <= 1) return 1;
  if (stat.correctStreak === 0) return 1;

  const intervals = [1, 2, 4, 7, 15, 30, 60, 120, 240, 365];
  const streakIndex = Math.min(stat.correctStreak, intervals.length - 1);
  const rate = stat.correct / Math.max(1, stat.seen);
  let interval = intervals[streakIndex];

  if (rate < 0.6) interval = Math.max(1, Math.round(interval * 0.5));
  if (rate >= 0.9 && stat.correctStreak >= 3) interval = Math.round(interval * 1.25);
  if (stat.wrong >= stat.correct) interval = Math.min(interval, 3);
  if (stat.lastWrongAt && stat.correctStreak <= 1) interval = Math.min(interval, 2);

  return Math.max(1, interval);
}

export function getReviewDueDate(stat: QuestionStat) {
  const lastSeenAt = parseStatDate(stat.lastSeenAt);
  return addLocalDays(startOfReviewDay(lastSeenAt), getReviewIntervalDays(stat));
}

export function parseStatDate(value?: string) {
  if (!value) return new Date(0);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfReviewDay(date: Date) {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - 4);
  return new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate(), 4, 0, 0, 0);
}

export function addLocalDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function differenceInLocalDays(later: Date, earlier: Date) {
  return Math.floor((startOfLocalDay(later).getTime() - startOfLocalDay(earlier).getTime()) / 86_400_000);
}

export function differenceInReviewDays(later: Date, earlier: Date) {
  return Math.floor((startOfReviewDay(later).getTime() - startOfReviewDay(earlier).getTime()) / 86_400_000);
}

export function isDailyReviewSessionCurrent(session: DailyReviewSession, dateKey: string) {
  return getDailySummaryDateKey(new Date(session.startedAt)) === dateKey;
}

export function isHardQuestionDeck(deck: Deck | null | undefined) {
  return deck?.id === HARD_QUESTION_DECK_ID;
}

export function isAllDailyReviewDeck(deck: Deck | null | undefined) {
  return deck?.id === ALL_DAILY_REVIEW_DECK_ID;
}

export function buildAllDailyReviewDeck(decks: Deck[]): Deck {
  const questionIds = decks
    .filter((deck) => !isHardQuestionDeck(deck) && !isAllDailyReviewDeck(deck))
    .flatMap((deck) => deck.questionIds);
  const uniqueQuestionIds = [...new Set(questionIds)];
  const updatedAt = decks
    .map((deck) => parseStatDate(deck.updatedAt).getTime())
    .filter((time) => time > 0)
    .sort((a, b) => b - a)[0];
  const timestamp = updatedAt ? new Date(updatedAt).toISOString() : new Date(0).toISOString();
  return {
    id: ALL_DAILY_REVIEW_DECK_ID,
    name: "全题库每日复习",
    questionIds: uniqueQuestionIds,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function getDeckQuestions(questions: Question[], deck: Deck | null) {
  if (!deck) return [];
  const byId = new Map(questions.map((question) => [question.id, question]));
  return deck.questionIds.map((id) => byId.get(id)).filter(Boolean) as Question[];
}

export function parseProgressBackup(raw: string): AppData {
  const parsed = JSON.parse(raw) as unknown;
  const payload = isRecord(parsed) && isRecord(parsed.data) ? parsed.data : parsed;
  if (!isRecord(payload)) {
    throw new Error("学习进度文件格式不正确");
  }
  if (!Array.isArray(payload.questions) || !Array.isArray(payload.decks)) {
    throw new Error("学习进度文件缺少题库数据");
  }

  return {
    questions: payload.questions as Question[],
    decks: payload.decks as Deck[],
    stats: isRecord(payload.stats) ? payload.stats as Record<string, QuestionStat> : {},
    dailyStats: isRecord(payload.dailyStats) ? payload.dailyStats as AppData["dailyStats"] : {},
    notes: isRecord(payload.notes) ? payload.notes as Record<string, string> : {},
    favoriteQuestionIds: Array.isArray(payload.favoriteQuestionIds) ? payload.favoriteQuestionIds as string[] : [],
    slashedQuestionIds: Array.isArray(payload.slashedQuestionIds) ? payload.slashedQuestionIds as string[] : [],
    autoHardQuestionIds: Array.isArray(payload.autoHardQuestionIds) ? payload.autoHardQuestionIds as string[] : [],
    studyPlanDeckIds: Array.isArray(payload.studyPlanDeckIds) ? payload.studyPlanDeckIds as string[] : [],
    sessions: Array.isArray(payload.sessions) ? payload.sessions as ExamSession[] : [],
    activeSession: isRecord(payload.activeSession) ? payload.activeSession as ExamSession : null,
    practices: isRecord(payload.practices) ? payload.practices as Record<string, PracticeState> : {},
    dailyReviewSessions: isRecord(payload.dailyReviewSessions) ? payload.dailyReviewSessions as Record<string, DailyReviewSession> : {},
    dailyReviewSession: isRecord(payload.dailyReviewSession) ? payload.dailyReviewSession as DailyReviewSession : null,
    dailyMistakeSummary: isRecord(payload.dailyMistakeSummary) ? payload.dailyMistakeSummary as DailyMistakeSummary : null,
    dailyReviewCompletion: isRecord(payload.dailyReviewCompletion) ? payload.dailyReviewCompletion as AppData["dailyReviewCompletion"] : null,
    seedImported: typeof payload.seedImported === "boolean" ? payload.seedImported : false
  };
}

export function hasBootstrapProgressImportMarker() {
  try {
    return localStorage.getItem(BOOTSTRAP_PROGRESS_MARKER_KEY) === "1";
  } catch {
    return false;
  }
}

export function markBootstrapProgressImported() {
  try {
    localStorage.setItem(BOOTSTRAP_PROGRESS_MARKER_KEY, "1");
  } catch {
    // localStorage 不可写时不影响题库导入。
  }
}

export function shouldImportBootstrapProgress(current: AppData, bootstrap: AppData) {
  if (bootstrap.questions.length === 0 || bootstrap.decks.length === 0) return false;
  if (current.questions.length === 0 || current.decks.length === 0) return true;
  if (current.questions.length < bootstrap.questions.length) return true;
  if (current.decks.length < bootstrap.decks.length) return true;
  const currentStatsCount = Object.keys(current.stats ?? {}).length;
  const bootstrapStatsCount = Object.keys(bootstrap.stats ?? {}).length;
  return current.questions.length === bootstrap.questions.length && currentStatsCount < bootstrapStatsCount;
}

export function shouldUsePersistentData(stored: AppData, current: AppData) {
  if (stored.questions.length === 0 && stored.decks.length === 0) return false;
  if (stored.activeSession && !current.activeSession) return true;
  if (current.questions.length === 0 && current.decks.length === 0) return true;
  if (stored.questions.length > current.questions.length) return true;
  if (stored.decks.length > current.decks.length) return true;
  if (Object.keys(stored.practices ?? {}).length > Object.keys(current.practices ?? {}).length) return true;
  if (Object.keys(stored.dailyReviewSessions ?? {}).length > Object.keys(current.dailyReviewSessions ?? {}).length) return true;
  return Object.keys(stored.stats ?? {}).length > Object.keys(current.stats ?? {}).length;
}

export function getTimeGreeting(date: Date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  if (minutes >= 6 * 60 && minutes < 10 * 60 + 30) return "烤包子时间到了，别学了吃一点吧";
  if (minutes >= 10 * 60 + 30 && minutes < 14 * 60) return "抓饭时间到了，别学了吃一点吧";
  if (minutes >= 14 * 60 && minutes < 17 * 60) return "拉条子时间到了，别学了吃一点吧";
  if (minutes >= 17 * 60 && minutes < 21 * 60) return "大盘鸡时间到了，别学了吃一点吧";
  return "馕坑肉时间到了，别学了吃一点吧";
}

export function formatSidebarSubtitle(subtitle: string) {
  const parts = subtitle.split("，").map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [subtitle];
}

export function migrateBundledQuestionImages(data: AppData): AppData {
  let changed = false;
  const questions = data.questions.map((question) => {
    const imageUrls = question.imageUrls ?? [];
    if (imageUrls.length === 0 || !imageUrls.some(isStoredImageRef)) return question;
    const imagePath = getBundledSafetyImagePath(question);
    if (!imagePath) return question;
    changed = true;
    return {
      ...question,
      imageUrls: imageUrls.map((url) => (isStoredImageRef(url) ? imagePath : url))
    };
  });
  return changed ? { ...data, questions } : data;
}

export function normalizeQuestionTextFields(data: AppData): AppData {
  let changed = false;
  const questions = data.questions.map((question) => {
    const stemText = normalizeQuestionContentText(question.stemText);
    const answerText = normalizeQuestionContentText(question.answerText);
    const options = question.options.map((option) => {
      const text = normalizeQuestionContentText(option.text);
      if (text === option.text) return option;
      changed = true;
      return {
        ...option,
        text,
        html: escapeEditableHtml(text).replace(/\n/g, "<br>")
      };
    });
    const shouldUpdateQuestion = stemText !== question.stemText || answerText !== question.answerText || options.some((option, index) => option !== question.options[index]);

    if (!shouldUpdateQuestion) return question;
    changed = true;
    return {
      ...question,
      stemText,
      stemHtml: escapeEditableHtml(stemText).replace(/\n/g, "<br>"),
      options,
      answerText,
      explanationHtml: escapeEditableHtml(answerText).replace(/\n/g, "<br>")
    };
  });

  return changed ? { ...data, questions } : data;
}

export function normalizeAppDataForCurrentRules(data: AppData): AppData {
  const sessions = dedupeExamSessionsForApp(data.sessions ?? []);
  const dailyReviewSession = data.dailyReviewSession ?? null;
  const sourceDailyReviewSessions = data.dailyReviewSessions ?? {};
  const dailyReviewSessions = dailyReviewSession && sourceDailyReviewSessions[dailyReviewSession.deckId] !== dailyReviewSession
    ? { ...sourceDailyReviewSessions, [dailyReviewSession.deckId]: dailyReviewSession }
    : sourceDailyReviewSessions;
  const baseData = sessions === data.sessions
    && dailyReviewSessions === data.dailyReviewSessions
    && dailyReviewSession === data.dailyReviewSession
    ? data
    : { ...data, sessions, dailyReviewSessions, dailyReviewSession };
  return garbageCollectUnreferencedQuestions(syncHardQuestionDeckForCurrentRules(migrateBundledQuestionImages(normalizeQuestionTextFields(normalizeStudyPlanDeckIds(pruneSlashedFromHardQuestionDeck(baseData))))));
}

export function normalizeStudyPlanDeckIds(data: AppData): AppData {
  const selectableDeckIds = new Set(data.decks.filter((deck) => !isHardQuestionDeck(deck) && !isAllDailyReviewDeck(deck)).map((deck) => deck.id));
  const studyPlanDeckIds = uniqueIds((data.studyPlanDeckIds ?? []).filter((deckId) => selectableDeckIds.has(deckId)));
  return areQuestionIdListsEqual(data.studyPlanDeckIds ?? [], studyPlanDeckIds) ? data : { ...data, studyPlanDeckIds };
}

export function getBundledSafetyImagePath(question: Question) {
  const number = question.uid.match(/#(\d{4})/)?.[1];
  if (!number) return null;
  return BUNDLED_SAFETY_IMAGE_PATHS[number] ?? null;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function normalizeDailyReviewSession(session: DailyReviewSession | null, reviewIndex: number) {
  if (!session) return null;
  if (session.items.length === 0 || isDailyReviewSessionComplete(session)) return null;
  const maxIndex = Math.max(0, session.items.length - 1);
  const nextReviewIndex = Math.max(0, Math.min(maxIndex, reviewIndex));
  return session.reviewIndex === nextReviewIndex ? session : { ...session, reviewIndex: nextReviewIndex };
}

export function getCurrentDailyReviewSession(data: AppData, deckId: string, dateKey: string) {
  const session = data.dailyReviewSessions?.[deckId]
    ?? (data.dailyReviewSession?.deckId === deckId ? data.dailyReviewSession : null);
  return session && isDailyReviewSessionCurrent(session, dateKey) && !isDailyReviewSessionComplete(session) ? session : null;
}

export function getInitialDailyReviewSession(data: AppData, dateKey: string) {
  const sessions = [
    ...Object.values(data.dailyReviewSessions ?? {}),
    ...(data.dailyReviewSession ? [data.dailyReviewSession] : [])
  ];
  return sessions.find((session) => isDailyReviewSessionCurrent(session, dateKey) && !isDailyReviewSessionComplete(session)) ?? null;
}

export function removeDailyReviewSessionFromData(data: AppData, deckId: string): AppData {
  const nextSessions = { ...(data.dailyReviewSessions ?? {}) };
  delete nextSessions[deckId];
  return {
    ...data,
    dailyReviewSessions: nextSessions,
    dailyReviewSession: data.dailyReviewSession?.deckId === deckId ? null : data.dailyReviewSession
  };
}

export function isDailyReviewSessionComplete(session: DailyReviewSession) {
  return session.items.length > 0 && session.items.every((item) => item.isCorrect !== undefined);
}

export function getStoredSessionIndex(session: ExamSession | null | undefined) {
  if (!session || session.items.length === 0) return 0;
  const maxIndex = Math.max(0, session.items.length - 1);
  return Math.max(0, Math.min(maxIndex, Number(session.currentIndex ?? 0) || 0));
}

export function normalizeActiveExamSession(session: ExamSession | null, currentIndex: number) {
  if (!session || session.submittedAt || session.items.length === 0) return null;
  const maxIndex = Math.max(0, session.items.length - 1);
  const nextCurrentIndex = Math.max(0, Math.min(maxIndex, currentIndex));
  return session.currentIndex === nextCurrentIndex ? session : { ...session, currentIndex: nextCurrentIndex };
}

export function getRestorableActiveSession(session: ExamSession | null | undefined, data: AppData) {
  if (!session || session.submittedAt || session.items.length === 0) return null;
  if (!data.decks.some((deck) => deck.id === session.deckId)) return null;
  const questionIds = new Set(data.questions.map((question) => question.id));
  const hasMissingQuestion = session.items.some((item) => !questionIds.has(item.questionId));
  if (hasMissingQuestion) return null;
  return {
    ...session,
    currentIndex: getStoredSessionIndex(session)
  };
}

export function buildDailyReviewFinishPromptKey(session: DailyReviewSession) {
  return [
    session.id,
    session.items.length,
    session.items.map((item) => `${item.questionId}:${item.isCorrect === undefined ? "pending" : item.isCorrect ? "right" : "wrong"}`).join("|")
  ].join("::");
}

export function areDailyReviewSessionsEqual(a: DailyReviewSession | null | undefined, b: DailyReviewSession | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

export function areExamSessionsEqual(a: ExamSession | null | undefined, b: ExamSession | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

export function areDailyMistakeSummariesEqual(a: DailyMistakeSummary | null | undefined, b: DailyMistakeSummary | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b);
}

export function extractProgressBackupImages(raw: string) {
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed) || !Array.isArray(parsed.images)) return [];
  return parsed.images
    .filter((item): item is { id: string; mimeType: string; updatedAt?: string; base64: string } => (
      isRecord(item)
      && typeof item.id === "string"
      && typeof item.base64 === "string"
      && (typeof item.mimeType === "string" || item.mimeType === undefined)
    ))
    .map((item) => ({
      id: item.id,
      mimeType: item.mimeType || "application/octet-stream",
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : undefined,
      base64: item.base64
    }));
}

export function addFinishedSession(sessions: ExamSession[], session: ExamSession) {
  return [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 100);
}

export function dedupeExamSessionsForApp(sessions: ExamSession[]) {
  const byId = new Map<string, ExamSession>();
  sessions.forEach((session) => {
    if (!session.id) return;
    const previous = byId.get(session.id);
    if (!previous) {
      byId.set(session.id, session);
      return;
    }
    const previousTime = previous.submittedAt ? new Date(previous.submittedAt).getTime() : 0;
    const nextTime = session.submittedAt ? new Date(session.submittedAt).getTime() : 0;
    if (nextTime >= previousTime) byId.set(session.id, session);
  });
  const deduped = [...byId.values()].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTime - aTime;
  }).slice(0, 100);
  return deduped.length === sessions.length && deduped.every((session, index) => session === sessions[index])
    ? sessions
    : deduped;
}

export function upsertDeck(data: AppData, deckId: string, name: string, questions: Question[], isSeed = false): AppData {
  const now = new Date().toISOString();
  const existingDeck = data.decks.find((deck) => deck.id === deckId);
  const replacements = buildImportedQuestionIdReplacements(data, existingDeck, questions);
  const migratedData = applyQuestionIdReplacements(data, replacements);
  const migratedExistingDeck = migratedData.decks.find((deck) => deck.id === deckId);
  const nextDeck: Deck = {
    id: deckId,
    name,
    questionIds: questions.map((question) => question.id),
    createdAt: migratedExistingDeck?.createdAt ?? now,
    updatedAt: now,
    isSeed
  };
  const nextPractices = { ...migratedData.practices };
  if (migratedExistingDeck) delete nextPractices[deckId];
  return garbageCollectUnreferencedQuestions({
    ...migratedData,
    questions: mergeQuestions(migratedData.questions, questions),
    decks: migratedExistingDeck
      ? migratedData.decks.map((deck) => deck.id === deckId ? nextDeck : deck)
      : [nextDeck, ...migratedData.decks],
    practices: nextPractices
  });
}

export function buildImportedQuestionIdReplacements(data: AppData, existingDeck: Deck | undefined, incomingQuestions: Question[]) {
  const replacements = new Map<string, string>();
  if (!existingDeck) return replacements;
  const questionById = new Map(data.questions.map((question) => [question.id, question]));
  const existingByImportKey = new Map<string, Question>();
  existingDeck.questionIds.forEach((questionId) => {
    const question = questionById.get(questionId);
    if (!question) return;
    existingByImportKey.set(buildQuestionImportKey(question), question);
  });
  incomingQuestions.forEach((question) => {
    const existing = existingByImportKey.get(buildQuestionImportKey(question));
    if (existing && existing.id !== question.id) replacements.set(existing.id, question.id);
  });
  return replacements;
}

export function buildQuestionImportKey(question: Question) {
  return `${question.uid}|${question.type}`;
}

export function applyQuestionIdReplacements(data: AppData, replacements: Map<string, string>): AppData {
  if (replacements.size === 0) return data;
  const replaceId = (questionId: string) => replacements.get(questionId) ?? questionId;
  const replaceIds = (questionIds: string[]) => uniqueIds(questionIds.map(replaceId));
  const nextStats: AppData["stats"] = {};
  Object.entries(data.stats ?? {}).forEach(([questionId, stat]) => {
    const nextId = replaceId(questionId);
    const previous = nextStats[nextId];
    nextStats[nextId] = previous ? mergeQuestionStats(previous, { ...stat, questionId: nextId }) : { ...stat, questionId: nextId };
  });
  const nextNotes: AppData["notes"] = {};
  Object.entries(data.notes ?? {}).forEach(([questionId, note]) => {
    const nextId = replaceId(questionId);
    nextNotes[nextId] = nextNotes[nextId] ? nextNotes[nextId] : note;
  });
  return {
    ...data,
    questions: data.questions.map((question) => ({ ...question, id: replaceId(question.id) })),
    decks: data.decks.map((deck) => ({ ...deck, questionIds: replaceIds(deck.questionIds) })),
    stats: nextStats,
    notes: nextNotes,
    favoriteQuestionIds: replaceIds(data.favoriteQuestionIds ?? []),
    slashedQuestionIds: replaceIds(data.slashedQuestionIds ?? []),
    autoHardQuestionIds: replaceIds(data.autoHardQuestionIds ?? []),
    sessions: data.sessions.map((session) => replaceQuestionIdsInExamSession(session, replaceId)),
    activeSession: data.activeSession ? replaceQuestionIdsInExamSession(data.activeSession, replaceId) : null,
    practices: Object.fromEntries(Object.entries(data.practices ?? {}).map(([key, practice]) => [key, replaceQuestionIdsInPractice(practice, replaceId)])),
    dailyReviewSessions: Object.fromEntries(Object.entries(data.dailyReviewSessions ?? {}).map(([key, session]) => [key, replaceQuestionIdsInDailyReviewSession(session, replaceId)])),
    dailyReviewSession: data.dailyReviewSession ? replaceQuestionIdsInDailyReviewSession(data.dailyReviewSession, replaceId) : null,
    dailyMistakeSummary: data.dailyMistakeSummary ? { ...data.dailyMistakeSummary, questionIds: replaceIds(data.dailyMistakeSummary.questionIds) } : null
  };
}

export function mergeBootstrapDataWithCurrentProgress(current: AppData, bootstrap: AppData): AppData {
  const replacements = buildQuestionIdReplacementsByImportKey(current.questions, bootstrap.questions);
  const migratedCurrent = applyQuestionIdReplacements(current, replacements);
  const bootstrapQuestionIds = new Set(bootstrap.questions.map((question) => question.id));
  const keepIds = (questionIds: string[]) => uniqueIds(questionIds.filter((questionId) => bootstrapQuestionIds.has(questionId)));
  const keepRecord = <T,>(record: Record<string, T> | undefined) => Object.fromEntries(
    Object.entries(record ?? {}).filter(([questionId]) => bootstrapQuestionIds.has(questionId))
  );
  const mergeStatsRecords = (left: AppData["stats"], right: AppData["stats"]) => {
    const next: AppData["stats"] = { ...left };
    Object.entries(right).forEach(([questionId, stat]) => {
      next[questionId] = next[questionId] ? mergeQuestionStats(next[questionId], stat) : stat;
    });
    return next;
  };
  const migratedHardDeck = migratedCurrent.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  const bootstrapHardDeck = bootstrap.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  const hardQuestionIds = keepIds([
    ...(bootstrapHardDeck?.questionIds ?? []),
    ...(migratedHardDeck?.questionIds ?? [])
  ]);
  const hardDeck = migratedHardDeck
    ? {
      ...migratedHardDeck,
      questionIds: hardQuestionIds,
      isSeed: false
    }
    : bootstrapHardDeck
      ? {
        ...bootstrapHardDeck,
        questionIds: hardQuestionIds,
        isSeed: false
      }
    : null;
  const decks = hardDeck && hardDeck.questionIds.length > 0
    ? [...bootstrap.decks.filter((deck) => deck.id !== HARD_QUESTION_DECK_ID), hardDeck]
    : bootstrap.decks.filter((deck) => deck.id !== HARD_QUESTION_DECK_ID);
  const bootstrapStats = keepRecord(bootstrap.stats) as AppData["stats"];
  const currentStats = keepRecord(migratedCurrent.stats) as AppData["stats"];
  const bootstrapNotes = keepRecord(bootstrap.notes);
  const currentNotes = keepRecord(migratedCurrent.notes);

  return normalizeAppDataForCurrentRules({
    ...bootstrap,
    decks,
    stats: mergeStatsRecords(bootstrapStats, currentStats),
    dailyStats: { ...(bootstrap.dailyStats ?? {}), ...(migratedCurrent.dailyStats ?? {}) },
    notes: { ...bootstrapNotes, ...currentNotes },
    favoriteQuestionIds: keepIds([...(bootstrap.favoriteQuestionIds ?? []), ...(migratedCurrent.favoriteQuestionIds ?? [])]),
    slashedQuestionIds: keepIds([...(bootstrap.slashedQuestionIds ?? []), ...(migratedCurrent.slashedQuestionIds ?? [])]),
    autoHardQuestionIds: keepIds([...(bootstrap.autoHardQuestionIds ?? []), ...(migratedCurrent.autoHardQuestionIds ?? [])]),
    studyPlanDeckIds: uniqueIds(migratedCurrent.studyPlanDeckIds ?? []).filter((deckId) => decks.some((deck) => deck.id === deckId)),
    sessions: migratedCurrent.sessions ?? [],
    activeSession: migratedCurrent.activeSession,
    practices: migratedCurrent.practices ?? {},
    dailyReviewSessions: migratedCurrent.dailyReviewSessions ?? {},
    dailyReviewSession: migratedCurrent.dailyReviewSession,
    dailyMistakeSummary: migratedCurrent.dailyMistakeSummary
      ? { ...migratedCurrent.dailyMistakeSummary, questionIds: keepIds(migratedCurrent.dailyMistakeSummary.questionIds) }
      : null,
    dailyReviewCompletion: migratedCurrent.dailyReviewCompletion ?? null,
    seedImported: true
  });
}

export function buildQuestionIdReplacementsByImportKey(existingQuestions: Question[], incomingQuestions: Question[]) {
  const existingByImportKey = new Map(existingQuestions.map((question) => [buildQuestionImportKey(question), question]));
  const replacements = new Map<string, string>();
  incomingQuestions.forEach((question) => {
    const existing = existingByImportKey.get(buildQuestionImportKey(question));
    if (existing && existing.id !== question.id) replacements.set(existing.id, question.id);
  });
  return replacements;
}

export function replaceQuestionIdsInExamSession(session: ExamSession, replaceId: (questionId: string) => string): ExamSession {
  return {
    ...session,
    items: session.items.map((item) => ({ ...item, questionId: replaceId(item.questionId) }))
  };
}

export function replaceQuestionIdsInDailyReviewSession(session: DailyReviewSession, replaceId: (questionId: string) => string): DailyReviewSession {
  return {
    ...session,
    items: session.items.map((item) => ({ ...item, questionId: replaceId(item.questionId) }))
  };
}

export function replaceQuestionIdsInPractice(practice: PracticeState, replaceId: (questionId: string) => string): PracticeState {
  const replaceRecord = <T,>(record: Record<string, T> | undefined) => {
    if (!record) return record;
    const next: Record<string, T> = {};
    Object.entries(record).forEach(([questionId, value]) => {
      next[replaceId(questionId)] = value;
    });
    return next;
  };
  return {
    ...practice,
    questionIds: uniqueIds(practice.questionIds.map(replaceId)),
    optionOrders: replaceRecord(practice.optionOrders),
    answers: replaceRecord(practice.answers) ?? {},
    results: replaceRecord(practice.results)
  };
}

export function mergeQuestionStats(a: QuestionStat, b: QuestionStat): QuestionStat {
  const lastSeenAt = latestIso(a.lastSeenAt, b.lastSeenAt);
  const lastWrongAt = latestIso(a.lastWrongAt, b.lastWrongAt);
  return {
    ...a,
    questionId: b.questionId,
    seen: (a.seen ?? 0) + (b.seen ?? 0),
    correct: (a.correct ?? 0) + (b.correct ?? 0),
    wrong: (a.wrong ?? 0) + (b.wrong ?? 0),
    correctStreak: Math.max(a.correctStreak ?? 0, b.correctStreak ?? 0),
    lastSeenAt,
    lastWrongAt
  };
}

export function latestIso(a?: string, b?: string) {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

export function garbageCollectUnreferencedQuestions(data: AppData): AppData {
  const referencedQuestionIds = new Set(data.decks.flatMap((deck) => deck.questionIds));
  const filterRecord = <T,>(record: Record<string, T>) => Object.fromEntries(
    Object.entries(record).filter(([questionId]) => referencedQuestionIds.has(questionId))
  ) as Record<string, T>;
  const questions = data.questions.filter((question) => referencedQuestionIds.has(question.id));
  const stats = filterRecord(data.stats ?? {});
  const notes = filterRecord(data.notes ?? {});
  const favoriteQuestionIds = (data.favoriteQuestionIds ?? []).filter((questionId) => referencedQuestionIds.has(questionId));
  const slashedQuestionIds = (data.slashedQuestionIds ?? []).filter((questionId) => referencedQuestionIds.has(questionId));
  const autoHardQuestionIds = (data.autoHardQuestionIds ?? []).filter((questionId) => referencedQuestionIds.has(questionId));
  if (
    areSameQuestionList(data.questions, questions)
    && areSameRecord(data.stats ?? {}, stats)
    && areSameRecord(data.notes ?? {}, notes)
    && areQuestionIdListsEqual(data.favoriteQuestionIds ?? [], favoriteQuestionIds)
    && areQuestionIdListsEqual(data.slashedQuestionIds ?? [], slashedQuestionIds)
    && areQuestionIdListsEqual(data.autoHardQuestionIds ?? [], autoHardQuestionIds)
  ) {
    return data;
  }
  return {
    ...data,
    questions,
    stats,
    notes,
    favoriteQuestionIds,
    slashedQuestionIds,
    autoHardQuestionIds
  };
}

export function uniqueIds(questionIds: string[]) {
  return [...new Set(questionIds)];
}

export function resetDeckProgressForDeck(data: AppData, deckId: string): AppData {
  const deck = data.decks.find((item) => item.id === deckId);
  if (!deck) return data;
  const targetQuestionIds = new Set(deck.questionIds);
  const nextStats = omitQuestionRecord(data.stats ?? {}, targetQuestionIds);
  const nextPractices = Object.fromEntries(
    Object.entries(data.practices ?? {}).filter(([, practice]) => practice.deckId !== deckId)
  );
  const nextDailyReviewSessions = pruneDailyReviewSessions(data.dailyReviewSessions ?? {}, targetQuestionIds, deckId);
  const nextDailyReviewSession = pruneDailyReviewSession(data.dailyReviewSession, targetQuestionIds, deckId);
  const nextDailyMistakeSummary = pruneDailyMistakeSummary(data.dailyMistakeSummary, targetQuestionIds);

  return normalizeAppDataForCurrentRules({
    ...data,
    stats: nextStats,
    slashedQuestionIds: (data.slashedQuestionIds ?? []).filter((questionId) => !targetQuestionIds.has(questionId)),
    autoHardQuestionIds: (data.autoHardQuestionIds ?? []).filter((questionId) => !targetQuestionIds.has(questionId)),
    sessions: (data.sessions ?? []).filter((session) => session.deckId !== deckId),
    activeSession: data.activeSession?.deckId === deckId ? null : data.activeSession,
    practices: nextPractices,
    dailyReviewSessions: nextDailyReviewSessions,
    dailyReviewSession: nextDailyReviewSession,
    dailyMistakeSummary: nextDailyMistakeSummary,
    dailyReviewCompletion: data.dailyReviewCompletion?.deckId === deckId ? null : data.dailyReviewCompletion
  });
}

export function deleteDeckFromData(data: AppData, deckId: string): AppData {
  const deck = data.decks.find((item) => item.id === deckId);
  if (!deck) return data;
  const targetQuestionIds = new Set(deck.questionIds);
  const decksWithoutTarget = data.decks.filter((item) => item.id !== deckId);
  const remainingSourceQuestionIds = new Set(
    decksWithoutTarget
      .filter((item) => !isHardQuestionDeck(item))
      .flatMap((item) => item.questionIds)
  );
  const deletedQuestionIds = new Set(
    [...targetQuestionIds].filter((questionId) => !remainingSourceQuestionIds.has(questionId))
  );
  const nextDecks = decksWithoutTarget
    .map((item) => {
      if (!isHardQuestionDeck(item)) return item;
      return {
        ...item,
        questionIds: item.questionIds.filter((questionId) => !deletedQuestionIds.has(questionId)),
        updatedAt: new Date().toISOString()
      };
    })
    .filter((item) => !isHardQuestionDeck(item) || item.questionIds.length > 0);
  const nextPractices = Object.fromEntries(
    Object.entries(data.practices ?? {}).filter(([, practice]) => practice.deckId !== deckId)
  );
  const nextDailyReviewSessions = pruneDailyReviewSessions(data.dailyReviewSessions ?? {}, deletedQuestionIds, deckId);
  const nextDailyReviewSession = pruneDailyReviewSession(data.dailyReviewSession, deletedQuestionIds, deckId);
  const nextDailyMistakeSummary = pruneDailyMistakeSummary(data.dailyMistakeSummary, deletedQuestionIds);

  return normalizeAppDataForCurrentRules(garbageCollectUnreferencedQuestions({
    ...data,
    decks: nextDecks,
    autoHardQuestionIds: (data.autoHardQuestionIds ?? []).filter((questionId) => !deletedQuestionIds.has(questionId)),
    sessions: (data.sessions ?? []).filter((session) => session.deckId !== deckId),
    activeSession: data.activeSession?.deckId === deckId ? null : data.activeSession,
    practices: nextPractices,
    dailyReviewSessions: nextDailyReviewSessions,
    dailyReviewSession: nextDailyReviewSession,
    dailyMistakeSummary: nextDailyMistakeSummary,
    dailyReviewCompletion: data.dailyReviewCompletion?.deckId === deckId ? null : data.dailyReviewCompletion
  }));
}

function omitQuestionRecord<T>(record: Record<string, T>, questionIds: Set<string>) {
  return Object.fromEntries(Object.entries(record).filter(([questionId]) => !questionIds.has(questionId))) as Record<string, T>;
}

function pruneDailyReviewSessions(sessions: Record<string, DailyReviewSession>, questionIds: Set<string>, deckId: string) {
  return Object.fromEntries(
    Object.entries(sessions)
      .map(([key, session]) => [key, pruneDailyReviewSession(session, questionIds, deckId)] as const)
      .filter((entry): entry is readonly [string, DailyReviewSession] => Boolean(entry[1]))
  );
}

function pruneDailyReviewSession(session: DailyReviewSession | null | undefined, questionIds: Set<string>, deckId: string) {
  if (!session || session.deckId === deckId) return null;
  if (questionIds.size === 0) return session;
  const items = session.items.filter((item) => !questionIds.has(item.questionId));
  if (items.length === 0) return null;
  if (items.length === session.items.length) return session;
  return {
    ...session,
    items,
    reviewIndex: Math.max(0, Math.min(items.length - 1, session.reviewIndex)),
    updatedAt: new Date().toISOString()
  };
}

function pruneDailyMistakeSummary(summary: DailyMistakeSummary | null, questionIds: Set<string>) {
  if (!summary || questionIds.size === 0) return summary;
  const retainedQuestionIds = summary.questionIds.filter((questionId) => !questionIds.has(questionId));
  return retainedQuestionIds.length === summary.questionIds.length
    ? summary
    : { ...summary, questionIds: retainedQuestionIds };
}

export function removeQuestionFromHardDeck(data: AppData, questionId: string): AppData {
  const existingDeck = data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  const autoHardQuestionIds = (data.autoHardQuestionIds ?? []).filter((id) => id !== questionId);
  if (!existingDeck || !existingDeck.questionIds.includes(questionId)) {
    return areQuestionIdListsEqual(data.autoHardQuestionIds ?? [], autoHardQuestionIds) ? data : { ...data, autoHardQuestionIds };
  }
  const nextDeck = {
    ...existingDeck,
    questionIds: existingDeck.questionIds.filter((id) => id !== questionId),
    updatedAt: new Date().toISOString()
  };
  return {
    ...data,
    autoHardQuestionIds,
    decks: data.decks.map((deck) => deck.id === HARD_QUESTION_DECK_ID ? nextDeck : deck)
  };
}

export function addQuestionToHardDeck(data: AppData, questionId: string, source: "manual" | "auto" = "manual"): AppData {
  const autoHardQuestionIds = source === "auto" ? uniqueIds([...(data.autoHardQuestionIds ?? []), questionId]) : data.autoHardQuestionIds ?? [];
  if (isQuestionInHardDeck(data, questionId)) {
    return areQuestionIdListsEqual(data.autoHardQuestionIds ?? [], autoHardQuestionIds) ? data : { ...data, autoHardQuestionIds };
  }
  const questionById = new Map(data.questions.map((question) => [question.id, question]));
  const targetQuestion = questionById.get(questionId);
  if (!targetQuestion) return data;
  const existingDeck = data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  const existingQuestions = existingDeck
    ? existingDeck.questionIds.map((id) => questionById.get(id)).filter(Boolean) as Question[]
    : [];
  return upsertDeck({ ...data, autoHardQuestionIds }, HARD_QUESTION_DECK_ID, HARD_QUESTION_DECK_NAME, [...existingQuestions, targetQuestion]);
}

export function isQuestionInHardDeck(data: AppData, questionId: string) {
  return Boolean(data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID)?.questionIds.includes(questionId));
}

export function pruneSlashedFromHardQuestionDeck(data: AppData): AppData {
  const existingDeck = data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  if (!existingDeck) return data;
  const slashed = new Set(data.slashedQuestionIds ?? []);
  if (slashed.size === 0) return data;
  const nextIds = existingDeck.questionIds.filter((questionId) => !slashed.has(questionId));
  const autoHardQuestionIds = (data.autoHardQuestionIds ?? []).filter((questionId) => !slashed.has(questionId));
  if (nextIds.length === existingDeck.questionIds.length) return data;
  const nextDeck = {
    ...existingDeck,
    questionIds: nextIds,
    updatedAt: new Date().toISOString()
  };
  return {
    ...data,
    autoHardQuestionIds,
    decks: data.decks.map((deck) => deck.id === HARD_QUESTION_DECK_ID ? nextDeck : deck)
  };
}

export function syncHardQuestionDeckForCurrentRules(data: AppData): AppData {
  const existingDeck = data.decks.find((deck) => deck.id === HARD_QUESTION_DECK_ID);
  const existingHardQuestionIds = new Set(existingDeck?.questionIds ?? []);
  const slashedQuestionIds = new Set(data.slashedQuestionIds ?? []);
  const previousAutoHardQuestionIds = new Set(data.autoHardQuestionIds ?? []);
  const nextAutoHardQuestionIds = new Set<string>();
  data.questions.forEach((question) => {
    const stat = data.stats[question.id];
    if (slashedQuestionIds.has(question.id) || isRecoveredHardQuestion(stat)) return;
    if (previousAutoHardQuestionIds.has(question.id) || isLowAccuracyHardQuestion(stat, false)) nextAutoHardQuestionIds.add(question.id);
  });
  const hardQuestions = buildHardQuestionDeckQuestions(
    data.questions,
    data.stats,
    slashedQuestionIds,
    new Set([...existingHardQuestionIds, ...nextAutoHardQuestionIds])
  );
  const nextQuestionIds = hardQuestions.map((question) => question.id);
  const autoHardQuestionIds = nextQuestionIds.filter((questionId) => nextAutoHardQuestionIds.has(questionId));
  const dataWithAuto = areQuestionIdListsEqual(data.autoHardQuestionIds ?? [], autoHardQuestionIds) ? data : { ...data, autoHardQuestionIds };
  if (!existingDeck && hardQuestions.length === 0) return dataWithAuto;
  if (existingDeck && areQuestionIdListsEqual(existingDeck.questionIds, nextQuestionIds)) return dataWithAuto;
  return upsertDeck(dataWithAuto, HARD_QUESTION_DECK_ID, HARD_QUESTION_DECK_NAME, hardQuestions);
}

export function areQuestionIdListsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index]);
}

function areSameQuestionList(left: Question[], right: Question[]) {
  return left.length === right.length && left.every((question, index) => question === right[index]);
}

function areSameRecord<T>(left: Record<string, T>, right: Record<string, T>) {
  const leftEntries = Object.entries(left);
  if (leftEntries.length !== Object.keys(right).length) return false;
  return leftEntries.every(([key, value]) => right[key] === value);
}

export function areSeedDecksImported(data: AppData) {
  const byId = new Map(data.decks.map((deck) => [deck.id, deck]));
  return SEED_DECKS.every((seed) => (byId.get(seed.id)?.questionIds.length ?? 0) > 0)
    && isLightHydrocarbonSeedCurrent(data, byId.get(LIGHT_HYDROCARBON_DECK_ID) ?? null);
}

export function isLightHydrocarbonSeedCurrent(data: AppData, deck: Deck | null) {
  if (!deck || deck.questionIds.length === 0) return false;
  const residuePattern = /轻烃装置操作工（下册）|理论知识练习题|>>/;
  const questions = getDeckQuestions(data.questions, deck);
  return !questions.some((question) => (
    residuePattern.test(question.stemText)
    || residuePattern.test(question.answerText)
    || question.options.some((option) => residuePattern.test(option.text))
  ));
}

export function orderSeedDecks(data: AppData): AppData {
  const seedOrder = new Map(SEED_DECKS.map((seed, index) => [seed.id, index]));
  return {
    ...data,
    decks: [...data.decks].sort((a, b) => {
      const orderA = seedOrder.get(a.id);
      const orderB = seedOrder.get(b.id);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return 0;
    })
  };
}

export function mergeImportReports(items: { label: string; report: ImportReport }[]): ImportReport {
  return items.reduce<ImportReport>((merged, item) => ({
    totalRows: merged.totalRows + item.report.totalRows,
    imported: merged.imported + item.report.imported,
    skipped: merged.skipped + item.report.skipped,
    images: (merged.images ?? 0) + (item.report.images ?? 0),
    errors: [
      ...merged.errors,
      ...item.report.errors.map((error) => `${item.label}：${error}`)
    ],
    skippedRows: [
      ...(merged.skippedRows ?? []),
      ...(item.report.skippedRows ?? []).map((row) => ({ ...row, source: item.label }))
    ]
  }), { totalRows: 0, imported: 0, skipped: 0, images: 0, errors: [], skippedRows: [] });
}

export function buildDeckId(name: string) {
  let hash = 5381;
  for (let index = 0; index < name.length; index += 1) {
    hash = (hash * 33) ^ name.charCodeAt(index);
  }
  return `deck_${(hash >>> 0).toString(36)}`;
}

export function buildStatSummary(data: AppData, questions: Question[]) {
  const ids = new Set(questions.map((question) => question.id));
  const stats = Object.values(data.stats).filter((stat) => ids.has(stat.questionId));
  const correct = stats.reduce((sum, stat) => sum + stat.correct, 0);
  const wrong = stats.reduce((sum, stat) => sum + stat.wrong, 0);
  const seen = stats.reduce((sum, stat) => sum + stat.seen, 0);
  return {
    correct,
    wrong,
    seen,
    touched: stats.filter((stat) => stat.seen > 0).length,
    streaking: stats.filter((stat) => stat.correctStreak > 0).length,
    rate: correct + wrong ? Math.round((correct / (correct + wrong)) * 1000) / 10 : 0
  };
}

export function buildLowAccuracyQuestions(questions: Question[], stats: Record<string, QuestionStat>, slashedQuestionIds = new Set<string>()) {
  return questions
    .filter((question) => isLowAccuracyHardQuestion(stats[question.id], slashedQuestionIds.has(question.id)))
    .sort((questionA, questionB) => sortHardQuestions(questionA, questionB, stats));
}

export function buildHardQuestionDeckQuestions(
  questions: Question[],
  stats: Record<string, QuestionStat>,
  slashedQuestionIds = new Set<string>(),
  existingHardQuestionIds = new Set<string>()
) {
  return questions
    .filter((question) => {
      const isSlashed = slashedQuestionIds.has(question.id);
      if (isSlashed) return false;
      if (isLowAccuracyHardQuestion(stats[question.id], false)) return true;
      return existingHardQuestionIds.has(question.id) && !isRecoveredHardQuestion(stats[question.id]);
    })
    .sort((questionA, questionB) => sortHardQuestions(questionA, questionB, stats));
}

export function sortHardQuestions(questionA: Question, questionB: Question, stats: Record<string, QuestionStat>) {
  const statA = stats[questionA.id];
  const statB = stats[questionB.id];
  const rateA = getQuestionCorrectRate(statA) ?? 1;
  const rateB = getQuestionCorrectRate(statB) ?? 1;
  return rateA - rateB
    || (statB?.wrong ?? 0) - (statA?.wrong ?? 0)
    || (statB?.seen ?? 0) - (statA?.seen ?? 0)
    || questionA.uid.localeCompare(questionB.uid, "zh-CN");
}

export function isLowAccuracyHardQuestion(stat?: QuestionStat, isSlashed = false) {
  if (isSlashed) return false;
  const rate = getQuestionCorrectRate(stat);
  const attempts = getQuestionAttemptCount(stat);
  return rate !== null
    && attempts >= HARD_QUESTION_MIN_ATTEMPTS
    && rate < HARD_QUESTION_RATE_THRESHOLD;
}

export function isRecoveredHardQuestion(stat?: QuestionStat) {
  const rate = getQuestionCorrectRate(stat);
  return rate !== null
    && rate >= HARD_QUESTION_RATE_THRESHOLD
    && (stat?.correctStreak ?? 0) >= HARD_QUESTION_RECOVERY_CORRECT_STREAK;
}

export function isManualHardQuestionAddBlocked(stat?: QuestionStat) {
  const attempts = getQuestionAttemptCount(stat);
  if (attempts <= 1) return false;
  const rate = getQuestionCorrectRate(stat);
  return rate !== null && rate > MANUAL_HARD_QUESTION_BLOCK_RATE_THRESHOLD;
}

export function isAutoHardQuestionLocked(data: AppData, questionId: string) {
  if (!isQuestionInHardDeck(data, questionId)) return false;
  const stat = data.stats[questionId];
  if (new Set(data.slashedQuestionIds ?? []).has(questionId) || isRecoveredHardQuestion(stat)) return false;
  return new Set(data.autoHardQuestionIds ?? []).has(questionId) || isLowAccuracyHardQuestion(stat, false);
}

export function getQuestionCorrectRate(stat?: QuestionStat) {
  const attempts = getQuestionAttemptCount(stat);
  if (attempts <= 0) return null;
  return (stat?.correct ?? 0) / attempts;
}

export function getQuestionAttemptCount(stat?: QuestionStat) {
  return (stat?.correct ?? 0) + (stat?.wrong ?? 0);
}

export function applySessionStats(stats: AppData["stats"], session: ExamSession) {
  let next = { ...stats };
  const timestamp = session.submittedAt || new Date().toISOString();
  session.items.forEach((item) => {
    next = recordQuestionResult(next, item.questionId, Boolean(item.isCorrect), timestamp);
  });
  return next;
}

export function applySessionQuestionResults(data: AppData, session: ExamSession) {
  let next = data;
  const timestamp = session.submittedAt || new Date().toISOString();
  session.items.forEach((item) => {
    next = recordQuestionResultInData(next, item.questionId, Boolean(item.isCorrect), timestamp);
  });
  return next;
}

export function applySessionDailyStats(dailyStats: AppData["dailyStats"], session: ExamSession) {
  let next = { ...dailyStats };
  const timestamp = session.submittedAt || new Date().toISOString();
  session.items.forEach((item) => {
    next = recordDailyStudyResult(next, Boolean(item.isCorrect), timestamp);
  });
  return next;
}

export function recordQuestionResult(stats: AppData["stats"], questionId: string, isCorrect: boolean, timestamp: string) {
  return recordQuestionResultWithStat(stats, questionId, isCorrect, timestamp).stats;
}

export function buildQuestionResultStat(stat: QuestionStat | undefined, questionId: string, isCorrect: boolean, timestamp?: string) {
  const previous = stat ?? { questionId, seen: 0, correct: 0, wrong: 0, correctStreak: 0 };
  return {
    ...previous,
    seen: previous.seen + 1,
    correct: previous.correct + (isCorrect ? 1 : 0),
    wrong: previous.wrong + (isCorrect ? 0 : 1),
    correctStreak: isCorrect ? previous.correctStreak + 1 : 0,
    lastSeenAt: timestamp ?? previous.lastSeenAt,
    lastWrongAt: isCorrect ? previous.lastWrongAt : timestamp ?? previous.lastWrongAt
  };
}

export function recordQuestionResultWithStat(stats: AppData["stats"], questionId: string, isCorrect: boolean, timestamp: string) {
  const nextStat = buildQuestionResultStat(stats[questionId], questionId, isCorrect, timestamp);
  return {
    stats: {
      ...stats,
      [questionId]: nextStat
    },
    stat: nextStat
  };
}

export function recordQuestionResultInData(data: AppData, questionId: string, isCorrect: boolean, timestamp: string) {
  const wasAutoHardQuestion = isAutoHardQuestionLocked(data, questionId);
  const result = recordQuestionResultWithStat(data.stats, questionId, isCorrect, timestamp);
  const slashed = new Set(data.slashedQuestionIds ?? []);
  let nextData: AppData = {
    ...data,
    stats: result.stats
  };
  if (isCorrect && result.stat.correctStreak >= AUTO_SLASH_CORRECT_STREAK) {
    slashed.add(questionId);
  }
  if (slashed.has(questionId) || isRecoveredHardQuestion(result.stat)) {
    nextData = removeQuestionFromHardDeck(nextData, questionId);
  } else if (wasAutoHardQuestion || isLowAccuracyHardQuestion(result.stat, false)) {
    nextData = addQuestionToHardDeck(nextData, questionId, "auto");
  }
  return {
    ...nextData,
    slashedQuestionIds: [...slashed]
  };
}

export function recordDailyStudyResult(dailyStats: AppData["dailyStats"], isCorrect: boolean, timestamp: string) {
  const date = getDailySummaryDateKey(new Date(timestamp));
  const previous = dailyStats[date] ?? createEmptyDailyStat(date);
  return {
    ...dailyStats,
    [date]: {
      ...previous,
      answered: previous.answered + 1,
      correct: previous.correct + (isCorrect ? 1 : 0),
      wrong: previous.wrong + (isCorrect ? 0 : 1)
    }
  };
}

export function createEmptyDailyStat(date: string): DailyStudyStat {
  return { date, answered: 0, correct: 0, wrong: 0 };
}

export function buildStudyHeatmap(dailyStats: Record<string, DailyStudyStat>, year: number) {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  const todayKey = getDailySummaryDateKey(new Date());
  const daysInYear = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const days = Array.from({ length: daysInYear }, (_, index) => {
    const date = new Date(year, 0, index + 1);
    const dateKey = getDailySummaryDateKey(date);
    const stat = dailyStats[dateKey] ?? createEmptyDailyStat(dateKey);
    const weekday = date.getDay();
    const weekIndex = Math.floor((start.getDay() + index) / 7);
    return {
      date: dateKey,
      stat,
      weekday,
      weekIndex,
      level: getActivityLevel(stat.answered),
      isToday: dateKey === todayKey
    };
  });

  return {
    days,
    weekCount: Math.ceil((start.getDay() + daysInYear) / 7)
  };
}

export function getActivityLevel(answered: number) {
  if (answered <= 0) return 0;
  if (answered >= 800) return 5;
  if (answered >= 600) return 4;
  if (answered >= 400) return 3;
  if (answered >= 200) return 2;
  return 1;
}

export function getLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getDailySummaryDateKey(date: Date) {
  const shifted = new Date(date);
  shifted.setHours(shifted.getHours() - 4);
  return getLocalDateKey(shifted);
}

export function getNextDailySummaryResetAt(date: Date) {
  const nextReset = new Date(date);
  nextReset.setHours(4, 0, 0, 0);
  if (date.getTime() >= nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  return nextReset;
}

export function formatStudyDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${Number(month)}月${Number(day)}日`;
}

export function parseRichText(text: string) {
  const parts: Array<{ kind: "text"; value: string } | { kind: "formula"; html: string; displayMode: boolean }> = [];
  let cursor = 0;

  while (cursor < text.length) {
    const delimiterIndex = findNextFormulaDelimiter(text, cursor);
    if (delimiterIndex < 0) {
      parts.push({ kind: "text", value: text.slice(cursor) });
      break;
    }

    if (delimiterIndex > cursor) {
      parts.push({ kind: "text", value: text.slice(cursor, delimiterIndex) });
    }

    const isBlock = text.startsWith("$$", delimiterIndex);
    const delimiter = isBlock ? "$$" : "$";
    const formulaStart = delimiterIndex + delimiter.length;
    const formulaEnd = findClosingFormulaDelimiter(text, formulaStart, delimiter);

    if (formulaEnd < 0) {
      parts.push({ kind: "text", value: text.slice(delimiterIndex) });
      break;
    }

    const formula = text.slice(formulaStart, formulaEnd).trim();
    if (!formula) {
      parts.push({ kind: "text", value: text.slice(delimiterIndex, formulaEnd + delimiter.length) });
      cursor = formulaEnd + delimiter.length;
      continue;
    }

    try {
      parts.push({
        kind: "formula",
        html: katex.renderToString(formula, {
          displayMode: isBlock,
          throwOnError: false,
          strict: false,
          trust: false
        }),
        displayMode: isBlock
      });
    } catch {
      parts.push({ kind: "text", value: text.slice(delimiterIndex, formulaEnd + delimiter.length) });
    }

    cursor = formulaEnd + delimiter.length;
  }

  return parts.length > 0 ? parts : [{ kind: "text" as const, value: "" }];
}

export function findNextFormulaDelimiter(text: string, startIndex: number) {
  for (let index = startIndex; index < text.length; index += 1) {
    if (text[index] !== "$" || isEscapedDollar(text, index)) continue;
    return index;
  }
  return -1;
}

export function findClosingFormulaDelimiter(text: string, startIndex: number, delimiter: "$" | "$$") {
  for (let index = startIndex; index < text.length; index += 1) {
    if (delimiter === "$$" && text.startsWith("$$", index) && !isEscapedDollar(text, index)) return index;
    if (delimiter === "$" && text[index] === "$" && !isEscapedDollar(text, index)) return index;
  }
  return -1;
}

export function isEscapedDollar(text: string, index: number) {
  let slashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }
  return slashCount % 2 === 1;
}

export function parseEditableAnswerKeys(value: string, options: ChoiceOption[]) {
  const normalized = value.trim().toUpperCase();
  const compact = normalized.replace(/[\s,，、;；/]/g, "");
  const optionKeys = new Set(options.map((option) => option.key));

  if (/^(对|正确|TRUE|√|✓)$/i.test(value.trim())) {
    return findEditableJudgementOption(options, true);
  }
  if (/^(错|错误|FALSE|×|✕|X)$/i.test(value.trim())) {
    return findEditableJudgementOption(options, false);
  }

  return compact
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((key, index, list) => optionKeys.has(key) && list.indexOf(key) === index);
}

export function findEditableJudgementOption(options: ChoiceOption[], expectedTrue: boolean) {
  const matcher = expectedTrue ? /(对|正确|TRUE|√|✓)/i : /(错|错误|FALSE|×|✕|X)/i;
  const match = options.find((option) => matcher.test(option.text));
  if (match) return [match.key];
  const fallbackKey = expectedTrue ? "A" : "B";
  return options.some((option) => option.key === fallbackKey) ? [fallbackKey] : [];
}

export function buildEditedQuestionTags(tags: string[], type: QuestionType) {
  return [...new Set([...tags.filter((tag) => !(TYPE_ORDER as readonly string[]).includes(tag)), type])];
}

export function escapeEditableHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
}

export function buildPracticeOptionOrders(questions: Question[], shuffleOptions: boolean) {
  return questions.reduce<Record<string, string[]>>((orders, question) => {
    orders[question.id] = buildQuestionOptionOrder(question, shuffleOptions);
    return orders;
  }, {});
}

export function buildDailyReviewSessionItems(items: DailyReviewItem[], questionById: Map<string, Question>, shuffleOptions: boolean) {
  return items.map((item) => {
    const question = questionById.get(item.questionId);
    if (!question) return item;
    return {
      ...item,
      optionOrder: buildQuestionOptionOrder(question, shuffleOptions)
    };
  });
}

export function buildQuestionOptionOrder(question: Question, shuffleOptions: boolean) {
  const keys = question.options.map((option) => option.key);
  return question.type === "判断题" || !shuffleOptions ? keys : shufflePracticeKeys(keys);
}

export function getFavoritePracticeKey(deckId: string) {
  return `favorites:${deckId}`;
}

export function getMistakePracticeKey(deckId: string) {
  return `mistakes:${deckId}`;
}

export function buildMistakePractice(deckId: string, questions: Question[], shuffleOptions: boolean, autoAdvanceCorrect: boolean, nowIso = new Date().toISOString()): PracticeState {
  return {
    deckId,
    scope: "mistakes",
    questionIds: questions.map((question) => question.id),
    currentIndex: 0,
    mode: "answer",
    optionOrders: buildPracticeOptionOrders(questions, shuffleOptions),
    shuffleOptions,
    shuffleQuestions: false,
    autoAdvanceCorrect,
    answers: {},
    results: {},
    startedAt: nowIso,
    updatedAt: nowIso
  };
}

export function getPracticeWrongQuestionIds(practice: PracticeState, excludedQuestionIds = new Set<string>()) {
  const results = practice.results ?? {};
  return practice.questionIds.filter((questionId) => results[questionId] === false && !excludedQuestionIds.has(questionId));
}

export function reconcileMistakePractice(practice: PracticeState, deckQuestions: Question[], excludedQuestionIds = new Set<string>()): PracticeState {
  const questionIdsInDeck = new Set(deckQuestions.map((question) => question.id));
  const resolvedPractice = applyPendingPracticeAutoAdvance(practice);
  const questionIds = resolvedPractice.questionIds.filter((questionId) => questionIdsInDeck.has(questionId) && !excludedQuestionIds.has(questionId));
  const generatedOrders = buildPracticeOptionOrders(
    deckQuestions.filter((question) => questionIds.includes(question.id)),
    Boolean(resolvedPractice.shuffleOptions)
  );
  const optionOrders = Object.fromEntries(questionIds.map((questionId) => [
    questionId,
    resolvedPractice.optionOrders?.[questionId] ?? generatedOrders[questionId] ?? []
  ]));
  const answers = Object.fromEntries(Object.entries(resolvedPractice.answers).filter(([questionId]) => questionIds.includes(questionId)));
  const results = Object.fromEntries(Object.entries(resolvedPractice.results ?? {}).filter(([questionId]) => questionIds.includes(questionId)));
  const currentQuestionId = resolvedPractice.questionIds[resolvedPractice.currentIndex];
  const retainedCurrentIndex = currentQuestionId ? questionIds.indexOf(currentQuestionId) : -1;
  const currentIndex = retainedCurrentIndex >= 0
    ? retainedCurrentIndex
    : Math.max(0, Math.min(questionIds.length - 1, resolvedPractice.currentIndex));

  return {
    ...resolvedPractice,
    scope: "mistakes",
    questionIds,
    currentIndex,
    pendingAutoAdvanceIndex: undefined,
    mode: "answer",
    optionOrders,
    answers,
    results,
    updatedAt: new Date().toISOString()
  };
}

export function reconcileFavoritePractice(practice: PracticeState, questions: Question[]): PracticeState {
  const resolvedPractice = applyPendingPracticeAutoAdvance(practice);
  const currentIds = new Set(questions.map((question) => question.id));
  const retainedIds = resolvedPractice.questionIds.filter((questionId) => currentIds.has(questionId));
  const retainedSet = new Set(retainedIds);
  const questionIds = [
    ...retainedIds,
    ...questions.map((question) => question.id).filter((questionId) => !retainedSet.has(questionId))
  ];
  const generatedOrders = buildPracticeOptionOrders(questions, Boolean(resolvedPractice.shuffleOptions));
  const optionOrders = Object.fromEntries(questionIds.map((questionId) => [
    questionId,
    resolvedPractice.optionOrders?.[questionId] ?? generatedOrders[questionId] ?? []
  ]));
  const answers = Object.fromEntries(Object.entries(resolvedPractice.answers).filter(([questionId]) => currentIds.has(questionId)));
  const results = Object.fromEntries(Object.entries(resolvedPractice.results ?? {}).filter(([questionId]) => currentIds.has(questionId)));
  const currentQuestionId = resolvedPractice.questionIds[resolvedPractice.currentIndex];
  const retainedCurrentIndex = currentQuestionId ? questionIds.indexOf(currentQuestionId) : -1;
  const currentIndex = retainedCurrentIndex >= 0
    ? retainedCurrentIndex
    : Math.max(0, Math.min(questionIds.length - 1, resolvedPractice.currentIndex));

  return {
    ...resolvedPractice,
    scope: "favorites",
    questionIds,
    currentIndex,
    pendingAutoAdvanceIndex: undefined,
    reviewIndex: resolvedPractice.reviewIndex === undefined
      ? undefined
      : Math.max(0, Math.min(questionIds.length - 1, resolvedPractice.reviewIndex)),
    optionOrders,
    answers,
    results,
    updatedAt: new Date().toISOString()
  };
}

export function applyPendingPracticeAutoAdvance(practice: PracticeState): PracticeState {
  if (practice.pendingAutoAdvanceIndex === undefined || practice.questionIds.length === 0) return practice;
  return {
    ...practice,
    currentIndex: Math.max(0, Math.min(practice.questionIds.length - 1, practice.pendingAutoAdvanceIndex)),
    pendingAutoAdvanceIndex: undefined,
    updatedAt: new Date().toISOString()
  };
}

export function buildPracticeQuestionIds(questions: Question[], shuffleQuestions: boolean, slashedQuestionIds = new Set<string>()) {
  const pendingQuestions = questions.filter((question) => !slashedQuestionIds.has(question.id));
  const slashedQuestions = questions.filter((question) => slashedQuestionIds.has(question.id));
  const pendingIds = shuffleQuestions
    ? buildInterleavedPracticeQuestionIds(pendingQuestions)
    : pendingQuestions.map((question) => question.id);

  return [...pendingIds, ...slashedQuestions.map((question) => question.id)];
}

export function buildInterleavedPracticeQuestionIds(questions: Question[]) {
  const groups = new Map<QuestionType, Question[]>(
    PRACTICE_INTERLEAVE_TYPES.map((type) => [type, shufflePracticeItems(questions.filter((question) => question.type === type))])
  );
  const otherQuestions = shufflePracticeItems(
    questions.filter((question) => !PRACTICE_INTERLEAVE_TYPES.includes(question.type))
  );
  const orderedIds: string[] = [];
  let lastType: QuestionType | null = null;

  while (true) {
    const availableTypes = PRACTICE_INTERLEAVE_TYPES.filter((type) => (groups.get(type)?.length ?? 0) > 0);
    if (availableTypes.length === 0) break;

    const preferredTypes = availableTypes.filter((type) => type !== lastType);
    const [nextType] = (preferredTypes.length > 0 ? preferredTypes : availableTypes)
      .sort((typeA, typeB) => {
        const remainingDiff = (groups.get(typeB)?.length ?? 0) - (groups.get(typeA)?.length ?? 0);
        if (remainingDiff !== 0) return remainingDiff;
        return PRACTICE_INTERLEAVE_TYPES.indexOf(typeA) - PRACTICE_INTERLEAVE_TYPES.indexOf(typeB);
      });
    const nextQuestion = groups.get(nextType)?.shift();
    if (!nextQuestion) break;
    orderedIds.push(nextQuestion.id);
    lastType = nextType;
  }

  return [...orderedIds, ...otherQuestions.map((question) => question.id)];
}

export function buildSlashedPracticeAnswers(questions: Question[], slashedQuestionIds: Set<string>) {
  return questions.reduce<Record<string, string[]>>((answers, question) => {
    if (slashedQuestionIds.has(question.id)) {
      answers[question.id] = [...question.answerKeys];
    }
    return answers;
  }, {});
}

export function buildSlashedPracticeResults(questions: Question[], slashedQuestionIds: Set<string>) {
  return questions.reduce<Record<string, boolean>>((results, question) => {
    if (slashedQuestionIds.has(question.id)) {
      results[question.id] = true;
    }
    return results;
  }, {});
}

export function getPracticeOrderedOptions(question: Question, practice?: PracticeState): ChoiceOption[] {
  const order = practice?.optionOrders?.[question.id];
  if (!order) return question.options;

  const byKey = new Map(question.options.map((option) => [option.key, option]));
  const ordered = order.map((key) => byKey.get(key)).filter((option): option is ChoiceOption => Boolean(option));
  const orderedKeys = new Set(order);
  const missingOptions = question.options.filter((option) => !orderedKeys.has(option.key));
  return [...ordered, ...missingOptions];
}

export function shufflePracticeKeys(keys: string[]) {
  return shufflePracticeItems(keys);
}

export function shufflePracticeItems<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function getPracticeMode(practice: PracticeState): PracticeMode {
  return practice.mode ?? "answer";
}

export function getPracticeActiveIndex(practice: PracticeState) {
  const index = getPracticeMode(practice) === "review" ? practice.reviewIndex ?? practice.currentIndex : practice.currentIndex;
  return Math.max(0, Math.min(practice.questionIds.length - 1, index));
}

export function getPracticeReviewProgress(practice: PracticeState) {
  if (practice.reviewIndex === undefined) return 0;
  return Math.max(0, Math.min(practice.questionIds.length, practice.reviewIndex + 1));
}

export function getPracticePendingIndices(practice: PracticeState) {
  const results = practice.results ?? {};
  return practice.questionIds.reduce<number[]>((indices, questionId, index) => {
    if (results[questionId] === undefined) indices.push(index);
    return indices;
  }, []);
}

export function getPracticeUnansweredIndices(practice: PracticeState) {
  return practice.questionIds.reduce<number[]>((indices, questionId, index) => {
    if ((practice.answers[questionId] ?? []).length === 0) indices.push(index);
    return indices;
  }, []);
}

export function formatQuestionIndexList(indices: number[], maxCount = 30) {
  const visible = indices.slice(0, maxCount).map((index) => String(index + 1));
  const suffix = indices.length > maxCount ? ` 等 ${indices.length} 道` : "";
  return `${visible.join("、")}${suffix}`;
}

export function buildMistakeConfig(questions: Question[], shuffleOptions: boolean): ExamConfig {
  const counts = countByType(questions);
  return {
    ...DEFAULT_CONFIG,
    judgeCount: counts["判断题"],
    singleCount: counts["单选题"],
    multipleCount: counts["多选题"],
    wrongFirst: true,
    shuffleOptions
  };
}
