import { describe, expect, it } from "vitest";
import type { AppData, Question, QuestionStat, QuestionType } from "../types";
import {
  addFinishedSession,
  buildMistakeConfig,
  buildDailyReviewPlan,
  buildDailyReviewSummary,
  deleteDeckFromData,
  getDailySummaryDateKey,
  getCurrentDailyReviewSession,
  getInitialDailyReviewSession,
  isDailyReviewSessionComplete,
  isAutoHardQuestionLocked,
  isQuestionInHardDeck,
  normalizeDailyReviewSession,
  normalizeAppDataForCurrentRules,
  reconcileMistakePractice,
  recordDailyStudyResult,
  resetDeckProgressForDeck,
  shouldUsePersistentData
} from "./appRules";
import { emptyData } from "./storage";

function makeQuestion(id: string, type: QuestionType = "单选题"): Question {
  return {
    id,
    uid: `测试 #${id}`,
    type,
    stemHtml: "题干",
    stemText: "题干",
    options: [
      { key: "A", html: "A", text: "A" },
      { key: "B", html: "B", text: "B" }
    ],
    answerKeys: ["A"],
    answerText: "A",
    explanationHtml: "A",
    tags: ["测试"],
    source: "测试",
    rawFront: "",
    rawBack: ""
  };
}

function learnedStat(questionId: string, patch: Partial<QuestionStat> = {}): QuestionStat {
  return {
    questionId,
    seen: 1,
    correct: 1,
    wrong: 0,
    correctStreak: 1,
    lastSeenAt: "2026-06-20T10:00:00.000+08:00",
    ...patch
  };
}

describe("date and daily statistics rules", () => {
  it("uses 04:00 as the study-day boundary", () => {
    expect(getDailySummaryDateKey(new Date("2026-06-28T03:59:00+08:00"))).toBe("2026-06-27");
    expect(getDailySummaryDateKey(new Date("2026-06-28T04:00:00+08:00"))).toBe("2026-06-28");
  });

  it("records heatmap/day stats with the same 04:00 boundary", () => {
    const stats = recordDailyStudyResult({}, true, "2026-06-28T02:00:00.000+08:00");
    expect(stats["2026-06-27"]).toMatchObject({ answered: 1, correct: 1, wrong: 0 });
    expect(stats["2026-06-28"]).toBeUndefined();
  });
});

describe("mistake exam rules", () => {
  it("keeps every current mistake question instead of capping by type", () => {
    const questions = [
      ...Array.from({ length: 25 }, (_, index) => makeQuestion(`judge_${index}`, "判断题")),
      ...Array.from({ length: 35 }, (_, index) => makeQuestion(`single_${index}`, "单选题")),
      ...Array.from({ length: 22 }, (_, index) => makeQuestion(`multi_${index}`, "多选题"))
    ];

    const config = buildMistakeConfig(questions, true);

    expect(config.judgeCount).toBe(25);
    expect(config.singleCount).toBe(35);
    expect(config.multipleCount).toBe(22);
  });

  it("preserves unfinished mistake practice position when deck questions still exist", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const practice = {
      deckId: "deck",
      scope: "mistakes" as const,
      questionIds: ["q1", "q2", "q_removed"],
      currentIndex: 1,
      mode: "answer" as const,
      optionOrders: { q1: ["A", "B"], q2: ["B", "A"], q_removed: ["A", "B"] },
      shuffleOptions: true,
      shuffleQuestions: false,
      autoAdvanceCorrect: true,
      answers: { q1: ["A"], q2: ["B"], q_removed: ["A"] },
      results: { q1: true, q_removed: false },
      startedAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:05:00.000Z"
    };

    const reconciled = reconcileMistakePractice(practice, questions);

    expect(reconciled.questionIds).toEqual(["q1", "q2"]);
    expect(reconciled.currentIndex).toBe(1);
    expect(reconciled.answers).toEqual({ q1: ["A"], q2: ["B"] });
    expect(reconciled.results).toEqual({ q1: true });
    expect(reconciled.optionOrders?.q2).toEqual(["B", "A"]);
  });

  it("drops slashed questions when restoring mistake practice", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2")];
    const practice = {
      deckId: "deck",
      scope: "mistakes" as const,
      questionIds: ["q1", "q2"],
      currentIndex: 0,
      mode: "answer" as const,
      answers: { q1: ["B"], q2: ["B"] },
      results: { q1: false, q2: false },
      startedAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:05:00.000Z"
    };

    const reconciled = reconcileMistakePractice(practice, questions, new Set(["q1"]));

    expect(reconciled.questionIds).toEqual(["q2"]);
    expect(reconciled.answers).toEqual({ q2: ["B"] });
    expect(reconciled.results).toEqual({ q2: false });
  });

  it("resumes a pending auto-advanced mistake practice at the next question", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const practice = {
      deckId: "deck",
      scope: "mistakes" as const,
      questionIds: ["q1", "q2", "q3"],
      currentIndex: 0,
      pendingAutoAdvanceIndex: 1,
      mode: "answer" as const,
      answers: { q1: ["A"] },
      results: { q1: true },
      startedAt: "2026-06-28T10:00:00.000Z",
      updatedAt: "2026-06-28T10:05:00.000Z"
    };

    const reconciled = reconcileMistakePractice(practice, questions);

    expect(reconciled.currentIndex).toBe(1);
    expect(reconciled.pendingAutoAdvanceIndex).toBeUndefined();
  });
});

describe("persistent data selection", () => {
  it("uses persistent data when it contains saved practice progress", () => {
    const current: AppData = {
      ...emptyData,
      questions: [makeQuestion("q1")],
      decks: [{ id: "deck", name: "题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }]
    };
    const stored: AppData = {
      ...current,
      practices: {
        "mistakes:deck": {
          deckId: "deck",
          scope: "mistakes",
          questionIds: ["q1"],
          currentIndex: 0,
          mode: "answer",
          answers: {},
          results: {},
          startedAt: "2026-06-28T10:00:00.000Z",
          updatedAt: "2026-06-28T10:00:00.000Z"
        }
      }
    };

    expect(shouldUsePersistentData(stored, current)).toBe(true);
  });
});

describe("daily review rules", () => {
  it("only schedules learned questions and prioritizes overdue items", () => {
    const questions = [makeQuestion("q1"), makeQuestion("q2"), makeQuestion("q3")];
    const stats = {
      q1: learnedStat("q1", { lastSeenAt: "2026-06-01T10:00:00.000+08:00", wrong: 3, correctStreak: 0 }),
      q2: learnedStat("q2", { lastSeenAt: "2026-06-27T10:00:00.000+08:00" })
    };
    const plan = buildDailyReviewPlan(questions, stats, new Date("2026-06-28T10:00:00+08:00"), 10);
    expect(plan.map((item) => item.questionId)).toEqual(["q1", "q2"]);
    expect(plan.some((item) => item.questionId === "q3")).toBe(false);

    const summary = buildDailyReviewSummary(questions, stats);
    expect(summary.learned).toBe(2);
    expect(summary.totalDue).toBeGreaterThanOrEqual(1);
  });

  it("does not restore a fully judged daily review session", () => {
    const completedSession = {
      id: "review_complete",
      deckId: "deck",
      startedAt: "2026-06-28T10:00:00.000+08:00",
      updatedAt: "2026-06-28T10:05:00.000+08:00",
      reviewIndex: 1,
      items: [
        { questionId: "q1", optionOrder: ["A", "B"], selectedKeys: ["A"], isCorrect: true, dueAt: "2026-06-28T04:00:00.000+08:00", intervalDays: 1, overdueDays: 0 },
        { questionId: "q2", optionOrder: ["A", "B"], selectedKeys: ["B"], isCorrect: false, dueAt: "2026-06-28T04:00:00.000+08:00", intervalDays: 1, overdueDays: 0 }
      ]
    };
    const data: AppData = {
      ...emptyData,
      dailyReviewSessions: { deck: completedSession },
      dailyReviewSession: completedSession
    };

    expect(isDailyReviewSessionComplete(completedSession)).toBe(true);
    expect(normalizeDailyReviewSession(completedSession, 1)).toBeNull();
    expect(getCurrentDailyReviewSession(data, "deck", "2026-06-28")).toBeNull();
    expect(getInitialDailyReviewSession(data, "2026-06-28")).toBeNull();
  });
});

describe("stored data normalization", () => {
  it("dedupes exam sessions and removes orphan questions", () => {
    const q1 = makeQuestion("q1");
    const orphan = makeQuestion("orphan");
    const duplicateSession = {
      id: "exam_same",
      deckId: "deck",
      startedAt: "2026-06-28T10:00:00.000+08:00",
      submittedAt: "2026-06-28T10:10:00.000+08:00",
      config: { judgeCount: 0, singleCount: 1, multipleCount: 0, wrongFirst: true, excludeRecent: false, shuffleOptions: true, tags: [] },
      items: [{ questionId: "q1", optionOrder: ["A", "B"], selectedKeys: ["A"], isCorrect: true }],
      score: 100
    };
    const data: AppData = {
      ...emptyData,
      questions: [q1, orphan],
      decks: [{ id: "deck", name: "测试题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }],
      sessions: [duplicateSession, duplicateSession],
      stats: { orphan: learnedStat("orphan") }
    };
    const normalized = normalizeAppDataForCurrentRules(data);
    expect(normalized.questions.map((question) => question.id)).toEqual(["q1"]);
    expect(normalized.sessions).toHaveLength(1);
    expect(normalized.stats.orphan).toBeUndefined();
  });

  it("keeps finished sessions unique when adding a new result", () => {
    const session = {
      id: "exam_1",
      deckId: "deck",
      startedAt: "2026-06-28T10:00:00.000+08:00",
      submittedAt: "2026-06-28T10:10:00.000+08:00",
      config: { judgeCount: 0, singleCount: 1, multipleCount: 0, wrongFirst: true, excludeRecent: false, shuffleOptions: true, tags: [] },
      items: [{ questionId: "q1", optionOrder: ["A", "B"], selectedKeys: ["A"], isCorrect: true }],
      score: 100
    };
    expect(addFinishedSession([session], session)).toHaveLength(1);
  });

  it("normalizes soft line breaks in existing question text", () => {
    const q1 = {
      ...makeQuestion("q1"),
      stemText: "二次运移不包括单一储层内的运移，只包括\n从这一储层向另一储层的运移。",
      stemHtml: "二次运移不包括单一储层内的运移，只包括<br>从这一储层向另一储层的运移。",
      options: [
        { key: "A", html: "处理方式在同一句内<br>不应另起一行", text: "处理方式在同一句内\n不应另起一行" },
        { key: "B", html: "错", text: "错" }
      ]
    };
    const data: AppData = {
      ...emptyData,
      questions: [q1],
      decks: [{ id: "deck", name: "测试题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }]
    };

    const normalized = normalizeAppDataForCurrentRules(data);

    expect(normalized.questions[0].stemText).toBe("二次运移不包括单一储层内的运移，只包括从这一储层向另一储层的运移。");
    expect(normalized.questions[0].options[0].text).toBe("处理方式在同一句内不应另起一行");
  });

  it("keeps study plan deck ids limited to existing normal decks", () => {
    const q1 = makeQuestion("q1");
    const data: AppData = {
      ...emptyData,
      questions: [q1],
      decks: [
        { id: "deck", name: "测试题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" },
        { id: "deck_hard_low_accuracy", name: "重难题", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }
      ],
      studyPlanDeckIds: ["deck", "deck", "missing", "deck_hard_low_accuracy"]
    };

    const normalized = normalizeAppDataForCurrentRules(data);

    expect(normalized.studyPlanDeckIds).toEqual(["deck"]);
  });
});

describe("hard question deck rules", () => {
  it("locks automatically added hard questions until they meet recovery rules", () => {
    const q1 = makeQuestion("q1");
    const data: AppData = {
      ...emptyData,
      questions: [q1],
      decks: [{ id: "deck", name: "测试题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }],
      stats: { q1: learnedStat("q1", { seen: 2, correct: 0, wrong: 2, correctStreak: 0 }) }
    };

    const locked = normalizeAppDataForCurrentRules(data);
    expect(isQuestionInHardDeck(locked, "q1")).toBe(true);
    expect(locked.autoHardQuestionIds).toEqual(["q1"]);
    expect(isAutoHardQuestionLocked(locked, "q1")).toBe(true);

    const stillLocked = normalizeAppDataForCurrentRules({
      ...locked,
      stats: { q1: learnedStat("q1", { seen: 4, correct: 2, wrong: 2, correctStreak: 1 }) }
    });
    expect(isQuestionInHardDeck(stillLocked, "q1")).toBe(true);
    expect(stillLocked.autoHardQuestionIds).toEqual(["q1"]);
    expect(isAutoHardQuestionLocked(stillLocked, "q1")).toBe(true);

    const recovered = normalizeAppDataForCurrentRules({
      ...stillLocked,
      stats: { q1: learnedStat("q1", { seen: 5, correct: 3, wrong: 2, correctStreak: 2 }) }
    });
    expect(isQuestionInHardDeck(recovered, "q1")).toBe(false);
    expect(recovered.autoHardQuestionIds).toEqual([]);
    expect(isAutoHardQuestionLocked(recovered, "q1")).toBe(false);
  });

  it("does not lock manually added hard questions", () => {
    const q1 = makeQuestion("q1");
    const data: AppData = {
      ...emptyData,
      questions: [q1],
      decks: [
        { id: "deck", name: "测试题库", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" },
        { id: "deck_hard_low_accuracy", name: "重难题", questionIds: ["q1"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }
      ],
      stats: { q1: learnedStat("q1", { seen: 1, correct: 0, wrong: 1, correctStreak: 0 }) }
    };

    const normalized = normalizeAppDataForCurrentRules(data);
    expect(isQuestionInHardDeck(normalized, "q1")).toBe(true);
    expect(normalized.autoHardQuestionIds).toEqual([]);
    expect(isAutoHardQuestionLocked(normalized, "q1")).toBe(false);
  });
});

describe("deck-level destructive actions", () => {
  it("resets progress for one deck without removing questions or favorites", () => {
    const q1 = makeQuestion("q1");
    const q2 = makeQuestion("q2");
    const data: AppData = {
      ...emptyData,
      questions: [q1, q2],
      decks: [{ id: "deck_a", name: "题库A", questionIds: ["q1", "q2"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }],
      stats: { q1: learnedStat("q1"), q2: learnedStat("q2") },
      favoriteQuestionIds: ["q1"],
      slashedQuestionIds: ["q2"],
      practices: {
        deck_a: {
          deckId: "deck_a",
          questionIds: ["q1", "q2"],
          currentIndex: 1,
          answers: { q1: ["A"] },
          startedAt: "2026-06-28T10:00:00.000Z",
          updatedAt: "2026-06-28T10:00:00.000Z"
        }
      },
      dailyReviewSessions: {
        deck_a: {
          id: "review_a",
          deckId: "deck_a",
          startedAt: "2026-06-28T10:00:00.000Z",
          updatedAt: "2026-06-28T10:00:00.000Z",
          reviewIndex: 0,
          items: [{ questionId: "q1", optionOrder: ["A", "B"], selectedKeys: [], dueAt: "2026-06-28T00:00:00.000Z", intervalDays: 1, overdueDays: 0 }]
        }
      }
    };

    const next = resetDeckProgressForDeck(data, "deck_a");

    expect(next.decks).toHaveLength(1);
    expect(next.questions.map((question) => question.id)).toEqual(["q1", "q2"]);
    expect(next.stats).toEqual({});
    expect(next.favoriteQuestionIds).toEqual(["q1"]);
    expect(next.slashedQuestionIds).toEqual([]);
    expect(next.practices.deck_a).toBeUndefined();
    expect(next.dailyReviewSessions.deck_a).toBeUndefined();
  });

  it("deletes a deck and only removes questions no other source deck uses", () => {
    const q1 = makeQuestion("q1");
    const q2 = makeQuestion("q2");
    const data: AppData = {
      ...emptyData,
      questions: [q1, q2],
      decks: [
        { id: "deck_a", name: "题库A", questionIds: ["q1", "q2"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" },
        { id: "deck_b", name: "题库B", questionIds: ["q2"], createdAt: "2026-06-28T00:00:00.000Z", updatedAt: "2026-06-28T00:00:00.000Z" }
      ],
      stats: { q1: learnedStat("q1"), q2: learnedStat("q2") },
      favoriteQuestionIds: ["q1", "q2"],
      slashedQuestionIds: ["q1", "q2"]
    };

    const next = deleteDeckFromData(data, "deck_a");

    expect(next.decks.map((deck) => deck.id)).toEqual(["deck_b"]);
    expect(next.questions.map((question) => question.id)).toEqual(["q2"]);
    expect(Object.keys(next.stats)).toEqual(["q2"]);
    expect(next.favoriteQuestionIds).toEqual(["q2"]);
    expect(next.slashedQuestionIds).toEqual(["q2"]);
  });
});
