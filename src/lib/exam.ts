import type { ChoiceOption, ExamConfig, ExamItem, Question, QuestionStat } from "../types";

const DISPLAY_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function buildExamItems(questions: Question[], stats: Record<string, QuestionStat>, config: ExamConfig): ExamItem[] {
  const byType = {
    "判断题": config.judgeCount,
    "单选题": config.singleCount,
    "多选题": config.multipleCount
  };
  const selected = new Set<string>();
  const items: ExamItem[] = [];

  Object.entries(byType).forEach(([type, count]) => {
    const pool = questions.filter((question) => {
      if (question.type !== type) return false;
      if (config.tags.length > 0 && !config.tags.some((tag) => question.tags.includes(tag))) return false;
      if (!config.excludeRecent) return true;
      const lastSeenAt = stats[question.id]?.lastSeenAt;
      if (!lastSeenAt) return true;
      return Date.now() - new Date(lastSeenAt).getTime() > 1000 * 60 * 60 * 12;
    });

    weightedShuffle(pool, stats, config.wrongFirst)
      .slice(0, Math.max(0, count))
      .forEach((question) => {
        if (selected.has(question.id)) return;
        selected.add(question.id);
        items.push({
          questionId: question.id,
          optionOrder: buildOptionOrder(question, config.shuffleOptions),
          selectedKeys: []
        });
      });
  });

  return weightedShuffleItems(items, questions, stats, config.wrongFirst);
}

export function isAnswerCorrect(question: Question, selectedKeys: string[]) {
  const expected = [...question.answerKeys].sort().join("");
  const selected = [...selectedKeys].sort().join("");
  return expected === selected;
}

export function optionDisplayKey(index: number) {
  return DISPLAY_KEYS[index] || String(index + 1);
}

export function getOrderedOptions(question: Question, item: ExamItem): ChoiceOption[] {
  const byKey = new Map(question.options.map((option) => [option.key, option]));
  return item.optionOrder.map((key) => byKey.get(key)).filter(Boolean) as ChoiceOption[];
}

function buildOptionOrder(question: Question, shuffle: boolean) {
  const keys = question.options.map((option) => option.key);
  if (question.type === "判断题") return keys;
  return shuffle ? shuffleArray(keys) : keys;
}

function weightedShuffle(questions: Question[], stats: Record<string, QuestionStat>, wrongFirst: boolean) {
  return [...questions].sort((a, b) => scoreQuestion(b, stats[b.id], wrongFirst) - scoreQuestion(a, stats[a.id], wrongFirst));
}

function weightedShuffleItems(items: ExamItem[], questions: Question[], stats: Record<string, QuestionStat>, wrongFirst: boolean) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  return [...items].sort((a, b) => {
    const questionA = byId.get(a.questionId);
    const questionB = byId.get(b.questionId);
    if (!questionA || !questionB) return 0;
    return scoreQuestion(questionB, stats[questionB.id], wrongFirst) - scoreQuestion(questionA, stats[questionA.id], wrongFirst);
  });
}

function scoreQuestion(question: Question, stat?: QuestionStat, wrongFirst = true) {
  const seen = stat?.seen ?? 0;
  const wrong = stat?.wrong ?? 0;
  const streak = stat?.correctStreak ?? 0;
  const daysSinceSeen = stat?.lastSeenAt ? Math.min(60, (Date.now() - new Date(stat.lastSeenAt).getTime()) / 86400000) : 30;
  const typeBalance = question.type === "多选题" ? 0.4 : question.type === "判断题" ? 0.2 : 0.3;
  return Math.random() * 2
    + typeBalance
    + (wrongFirst ? wrong * 4 : 0)
    + daysSinceSeen * 0.08
    - seen * 0.05
    - streak * 0.7;
}

function shuffleArray<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
