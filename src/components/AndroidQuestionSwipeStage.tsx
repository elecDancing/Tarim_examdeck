import type { ReactNode } from "react";
import type { Question } from "../types";

type AndroidQuestionSwipeStageProps = {
  // Kept for call-site compatibility. The Android transition now animates the
  // real rendered question after navigation, so simplified preview cards are
  // intentionally not rendered.
  previous?: Question | null;
  next?: Question | null;
  children: ReactNode;
};

export function AndroidQuestionSwipeStage({ children }: AndroidQuestionSwipeStageProps) {
  return (
    <div className="android-question-swipe-stage">
      <div className="android-question-swipe-current">{children}</div>
    </div>
  );
}
