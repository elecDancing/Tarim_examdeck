import type { ReactNode } from "react";
import { AlertTriangle, Pencil, Star, Sword } from "lucide-react";
import type { Question } from "../types";

type AndroidQuestionSwipeStageProps = {
  previous?: Question | null;
  next?: Question | null;
  favoriteQuestionSet?: Set<string>;
  slashedQuestionSet?: Set<string>;
  hardQuestionSet?: Set<string>;
  children: ReactNode;
};

function PreviewQuestionPanel({
  question,
  favoriteQuestionSet,
  slashedQuestionSet,
  hardQuestionSet
}: {
  question?: Question | null;
  favoriteQuestionSet?: Set<string>;
  slashedQuestionSet?: Set<string>;
  hardQuestionSet?: Set<string>;
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
      <div className="question-text">{question.stemText}</div>
      <div className="option-list">
        {question.options.map((option, index) => (
          <div key={`${question.id}-${option.key}`} className="option-button">
            <span className="option-key">{String.fromCharCode(65 + index)}</span>
            <span>{option.text}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AndroidQuestionSwipeStage({ previous, next, favoriteQuestionSet, slashedQuestionSet, hardQuestionSet, children }: AndroidQuestionSwipeStageProps) {
  return (
    <div className="android-question-swipe-stage">
      <div className="android-question-swipe-track">
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-prev" aria-hidden="true">
          <PreviewQuestionPanel question={previous} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} />
        </div>
        <div className="android-question-swipe-page android-question-swipe-current">{children}</div>
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-next" aria-hidden="true">
          <PreviewQuestionPanel question={next} favoriteQuestionSet={favoriteQuestionSet} slashedQuestionSet={slashedQuestionSet} hardQuestionSet={hardQuestionSet} />
        </div>
      </div>
    </div>
  );
}
