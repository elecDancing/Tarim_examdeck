import type { ReactNode } from "react";
import type { Question } from "../types";

type AndroidQuestionSwipeStageProps = {
  previous?: Question | null;
  next?: Question | null;
  children: ReactNode;
};

function PreviewCard({ label, question }: { label: string; question?: Question | null }) {
  return (
    <div className="android-question-swipe-preview-card">
      <span className="android-swipe-preview-label">{label}</span>
      {question ? (
        <>
          <span className="type-pill">{question.type}</span>
          <p>{question.stemText}</p>
        </>
      ) : (
        <p>没有更多题目</p>
      )}
    </div>
  );
}

export function AndroidQuestionSwipeStage({ previous, next, children }: AndroidQuestionSwipeStageProps) {
  return (
    <div className="android-question-swipe-stage">
      <div className="android-question-swipe-preview android-question-swipe-preview-prev" aria-hidden="true">
        <PreviewCard label="上一题" question={previous} />
      </div>
      <div className="android-question-swipe-preview android-question-swipe-preview-next" aria-hidden="true">
        <PreviewCard label="下一题" question={next} />
      </div>
      <div className="android-question-swipe-current">{children}</div>
    </div>
  );
}
