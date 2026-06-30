import type { DailyReviewSession, Deck, ExamSession, PracticeState, Question } from "../types";
import { isAnswerCorrect } from "./exam";
import { isAllDailyReviewDeck } from "./appRules";

export type AndroidAnswerLeaveSummary = {
  title: string;
  targetLabel: string;
  answered: number;
  correct: number;
  total: number;
  accuracy: number;
  detail: string;
};

export function buildAndroidAnswerLeaveSummary({
  view,
  activeDeck,
  activePractice,
  activeSession,
  activeReviewSession,
  questionById
}: {
  view: string;
  activeDeck: Deck | null;
  activePractice?: PracticeState;
  activeSession: ExamSession | null;
  activeReviewSession: DailyReviewSession | null;
  questionById: Map<string, Question>;
}): AndroidAnswerLeaveSummary {
  const targetLabel = activeDeck && !isAllDailyReviewDeck(activeDeck) ? "题库工作台" : "题库首页";
  if (view === "practice" && activePractice) {
    const results = activePractice.results ?? {};
    const answered = Object.keys(results).length;
    const correct = Object.values(results).filter(Boolean).length;
    return makeSummary("暂存刷题进度？", targetLabel, answered, correct, activePractice.questionIds.length);
  }
  if (view === "review" && activeReviewSession) {
    const answered = activeReviewSession.items.filter((item) => item.isCorrect !== undefined).length;
    const correct = activeReviewSession.items.filter((item) => item.isCorrect === true).length;
    return makeSummary("暂存复习进度？", targetLabel, answered, correct, activeReviewSession.items.length);
  }
  if (view === "exam" && activeSession) {
    const answeredItems = activeSession.items.filter((item) => item.selectedKeys.length > 0);
    const correct = answeredItems.filter((item) => {
      const question = questionById.get(item.questionId);
      return question ? isAnswerCorrect(question, item.selectedKeys) : false;
    }).length;
    return makeSummary("暂存考试进度？", targetLabel, answeredItems.length, correct, activeSession.items.length);
  }
  return makeSummary("返回上一界面？", targetLabel, 0, 0, 0);
}

export function showAndroidAnswerLeaveConfirm(options: AndroidAnswerLeaveSummary & { onCancel?: () => void; onReturn: () => void }) {
  if (!document.documentElement.classList.contains("native-android")) return;
  document.querySelector(".android-leave-confirm-backdrop")?.remove();

  const backdrop = document.createElement("div");
  backdrop.className = "android-submit-summary-backdrop android-leave-confirm-backdrop";
  const dialog = document.createElement("section");
  dialog.className = "android-submit-summary-dialog android-leave-confirm-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const eyebrow = document.createElement("span");
  eyebrow.className = "android-submit-summary-eyebrow";
  eyebrow.textContent = options.title;
  const score = document.createElement("strong");
  score.className = "android-submit-summary-score";
  score.textContent = `${options.accuracy}%`;
  const grid = document.createElement("div");
  grid.className = "android-submit-summary-grid";
  addMetric(grid, "已刷", `${options.answered}`);
  addMetric(grid, "答对", `${options.correct}`);
  addMetric(grid, "总题", `${options.total}`);
  const wrong = Math.max(0, options.answered - options.correct);
  addMetric(grid, "答错", `${wrong}`);
  const detail = document.createElement("p");
  detail.textContent = options.detail;
  const actions = document.createElement("div");
  actions.className = "android-submit-summary-actions";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.className = "secondary-button wide";
  cancel.textContent = "继续刷题";
  cancel.onclick = () => {
    backdrop.remove();
    options.onCancel?.();
  };
  const confirm = document.createElement("button");
  confirm.type = "button";
  confirm.className = "primary-button wide";
  confirm.textContent = `返回${options.targetLabel}`;
  confirm.onclick = () => {
    backdrop.remove();
    options.onReturn();
  };
  actions.append(cancel, confirm);
  dialog.append(eyebrow, score, grid, detail, actions);
  backdrop.append(dialog);
  document.body.append(backdrop);
}

function makeSummary(title: string, targetLabel: string, answered: number, correct: number, total: number): AndroidAnswerLeaveSummary {
  const accuracy = answered > 0 ? Math.round((correct / answered) * 1000) / 10 : 0;
  return {
    title,
    targetLabel,
    answered,
    correct,
    total,
    accuracy,
    detail: `本次已刷 ${answered} 道，正确率 ${accuracy}%。返回后进度会保留，可稍后继续。`
  };
}

function addMetric(container: HTMLElement, label: string, value: string) {
  const item = document.createElement("span");
  item.innerHTML = `<em>${label}</em><strong>${value}</strong>`;
  container.append(item);
}
