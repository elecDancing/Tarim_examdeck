import type { ReactNode } from "react";
import type { Question } from "../types";

type AndroidQuestionSwipeStageProps = {
  previous?: Question | null;
  next?: Question | null;
  children: ReactNode;
};

function PreviewQuestionPanel({ question }: { question?: Question | null }) {
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
      </div>
      <div className="question-text">{question.stemText}</div>
      <div className="option-list">
        {question.options.map((option, index) => (
          <div key={option.key} className="option-button">
            <span className="option-key">{String.fromCharCode(65 + index)}</span>
            <span>{option.text}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function AndroidQuestionSwipeStage({ previous, next, children }: AndroidQuestionSwipeStageProps) {
  return (
    <div className="android-question-swipe-stage">
      <div className="android-question-swipe-track">
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-prev" aria-hidden="true">
          <PreviewQuestionPanel question={previous} />
        </div>
        <div className="android-question-swipe-page android-question-swipe-current">{children}</div>
        <div className="android-question-swipe-page android-question-swipe-preview android-question-swipe-preview-next" aria-hidden="true">
          <PreviewQuestionPanel question={next} />
        </div>
      </div>
    </div>
  );
}
