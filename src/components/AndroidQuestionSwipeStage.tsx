import type { ReactNode } from "react";
import { AlertTriangle, NotebookPen, Pencil, Star, Sword } from "lucide-react";
import type { ChoiceOption, ExamItem, PracticeState, Question, QuestionStat } from "../types";
import { isAnswerCorrect, optionDisplayKey } from "../lib/exam";
import { RichText } from "./RichText";

type AndroidQuestionSwipeStageProps = {
  previous?: Question | null;
  next?: Question | null;
  favoriteQuestionSet?: Set<string>;
  slashedQuestionSet?: Set<string>;
  hardQuestionSet?: Set<string>;
  answerItems?: ExamItem[];
  revealAll?: boolean;
  practice?: PracticeState;
  practiceReviewMode?: boolean;
  stats?: Record<string, QuestionStat>;
  notes?: Record<string, string>;
  children: ReactNode;
};

type PreviewSnapshot = {
  optionOrder?: string[];
  selectedKeys: string[];
  reveal: boolean;
  isCorrect: boolean;
  hideSelected?: boolean;
  stat?: QuestionStat;
  note?: string;
};

function getOrderedPreviewOptions(question: Question, optionOrder?: string[]): ChoiceOption[] {
  if (!optionOrder) return question.options;
  const byKey = new Map(question.options.map((option) => [option.key, option]));
  const ordered = optionOrder.map((key) => byKey.get(key)).filter((option): option is ChoiceOption => Boolean(option));
  const orderedKeys = new Set(optionOrder);
  return [...ordered, ...question.options.filter((option) => !orderedKeys.has(option.key))];
}

function PreviewAttemptStats({ stat }: { stat?: QuestionStat }) {
  const seen = stat?.seen ?? 0;
  const rateText = seen > 0 ? `${Math.round(((stat?.correct ?? 0) / seen) * 1000) / 10}%` : "暂无";
  return (
    <span className="answer-stat-line">
      <span className="answer-stat-item">本题已刷 <strong>{seen}</strong> 次</span>
      <span className="answer-stat-item">平均正确率 <strong>{rateText}</strong></span>
      <span className="answer-stat-item">连续正确 <strong>{stat?.correctStreak ?? 0}</strong> 次</span>
    </span>
  );
}

function PreviewQuestionPanel({
  question,
  favoriteQuestionSet,
  slashedQuestionSet,
  hardQuestionSet,
  snapshot
}: {
  question?: Question | null;
  favoriteQuestionSet?: Set<string>;
  slashedQuestionSet?: Set<string>;
  hardQuestionSet?: Set<string>;
  snapshot?: PreviewSnapshot;
}) {
  if (!question) {
    return (
      <article className="question-panel android-question-swipe-preview-card">
        <p className="android-swipe-empty-text">没有更多题目</p>
      </article>
    );
  }

  return (
    <article className="question-panel android-question-swipe-preview-card">
      <div className="question-panel-tools">
        <span className="type-pill">{question.type}</span>
        <div className="question-panel-actions">
          <span className={`favorite-button compact ${favoriteQuestionSet?.has(question.id) ? "active" : ""}`}><Star size={18} /></span>
          <span className={`slashed-button compact ${slashedQuestionSet?.has(question.id) ? "active" : ""}`}><Sword size={18} /></span>
          <span className={`hard-question-button compact ${hardQuestionSet?.has(question.id) ? "active" : ""}`}><AlertTriangle size={18} /></span>
          <span className="mini-edit-button"><Pencil size={16} />Edit</span>
        </div>
      </div>
      <div className="question-text"><RichText text={question.stemText} /></div>
      <div className="option-list">
        {getOrderedPreviewOptions(question, snapshot?.optionOrder).map((option, index) => {
          const selected = !snapshot?.hideSelected && Boolean(snapshot?.selectedKeys.includes(option.key));
          const correct = question.answerKeys.includes(option.key);
          const className = [
            "option-button",
            selected ? "selected" : "",
            snapshot?.reveal && correct ? "correct" : "",
            snapshot?.reveal && selected && !correct ? "wrong" : ""
          ].filter(Boolean).join(" ");
          return (
          <div key={`${question.id}-${option.key}`} className={className}>
            <span className="option-key">{optionDisplayKey(index)}</span>
            <RichText text={option.text} />
          </div>
          );
        })}
      </div>
      {snapshot?.reveal && (
        <div className={snapshot.isCorrect ? "answer-box correct" : "answer-box wrong"}>
          <strong>正确答案：{getOrderedPreviewOptions(question, snapshot.optionOrder).map((option, index) => question.answerKeys.includes(option.key) ? optionDisplayKey(index) : "").filter(Boolean).join("")}</strong>
          {!snapshot.hideSelected && <span>你的答案：{getOrderedPreviewOptions(question, snapshot.optionOrder).map((option, index) => snapshot.selectedKeys.includes(option.key) ? optionDisplayKey(index) : "").filter(Boolean).join("") || "未作答"}</span>}
          <PreviewAttemptStats stat={snapshot.stat} />
        </div>
      )}
      {snapshot?.reveal && (
        <section className="question-note-panel android-question-swipe-note-preview">
          <div className="note-panel-header">
            <label>
              <NotebookPen size={17} />
              笔记
            </label>
            {snapshot.note?.trim() && <span>已记录</span>}
          </div>
          <div className="note-preview note-preview-editable" title="双击编辑笔记">
            {snapshot.note?.trim() ? <RichText text={snapshot.note.trim()} /> : <span className="note-empty-hint">双击添加笔记</span>}
          </div>
        </section>
      )}
    </article>
  );
}

export function AndroidQuestionSwipeStage({ previous, next, favoriteQuestionSet, slashedQuestionSet, hardQuestionSet, answerItems, revealAll = false, practice, practiceReviewMode = false, stats, notes, children }: AndroidQuestionSwipeStageProps) {
  const snapshotFor = (question?: Question | null): PreviewSnapshot | undefined => {
    if (!question) return undefined;
    if (practice) {
      const selectedKeys = practice.answers[question.id] ?? [];
      const result = practice.results?.[question.id];
      const reveal = practiceReviewMode || Boolean(practice.submittedAt) || result !== undefined;
      return { optionOrder: practice.optionOrders?.[question.id], selectedKeys, reveal, hideSelected: practiceReviewMode, isCorrect: practiceReviewMode || (result ?? isAnswerCorrect(question, selectedKeys)), stat: stats?.[question.id], note: notes?.[question.id] ?? "" };
    }
    const item = answerItems?.find((entry) => entry.questionId === question.id);
    const selectedKeys = item?.selectedKeys ?? [];
    const reveal = revealAll || item?.isCorrect !== undefined;
    return { optionOrder: item?.optionOrder, selectedKeys, reveal, isCorrect: item?.isCorrect ?? isAnswerCorrect(question, selectedKeys), stat: stats?.[question.id], note: notes?.[question.id] ?? "" };
  };
  return (
    <div className="android-question-swipe-stage">
      <div className="android-question-swipe-track">
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-prev" aria-hidden="true">
          <PreviewQuestionPanel question={previous} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} snapshot={snapshotFor(previous)} />
        </div>
        <div className="android-question-swipe-page android-question-swipe-current">{children}</div>
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-next" aria-hidden="true">
          <PreviewQuestionPanel question={next} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} snapshot={snapshotFor(next)} />
        </div>
      </div>
    </div>
  );
}
