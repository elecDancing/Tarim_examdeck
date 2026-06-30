import { useEffect } from "react";
import { AlertTriangle, CalendarCheck, CheckCircle2, XCircle } from "lucide-react";
import type { DailyReviewSession } from "../types";

type DailyReviewFinishDialogProps = {
  session: DailyReviewSession;
  slashedQuestionSet: Set<string>;
  onFinish: () => void;
  onRequeueMistakes: () => void;
  onClose: () => void;
};

export function DailyReviewFinishDialog({ session, slashedQuestionSet, onFinish, onRequeueMistakes, onClose }: DailyReviewFinishDialogProps) {
  const finishedCount = session.items.filter((item) => item.isCorrect !== undefined).length;
  const wrongItems = session.items.filter((item) => item.isCorrect === false);
  const wrongCount = wrongItems.length;
  const requeueableWrongCount = wrongItems.filter((item) => !slashedQuestionSet.has(item.questionId)).length;
  const slashedWrongCount = wrongCount - requeueableWrongCount;
  const correctCount = session.items.filter((item) => item.isCorrect === true).length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop review-finish-backdrop" onMouseDown={onClose}>
      <article className="daily-review-finish-dialog" role="dialog" aria-modal="true" aria-label="完成每日复习" onMouseDown={(event) => event.stopPropagation()}>
        <header className="daily-review-finish-header">
          <span className="daily-review-finish-icon">
            <CalendarCheck size={24} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow">每日复习</span>
            <h2>这轮复习怎么处理？</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <XCircle size={20} />
          </button>
        </header>
        <div className="daily-review-finish-stats">
          <span><strong>{finishedCount}</strong> 已判定</span>
          <span><strong>{correctCount}</strong> 正确</span>
          <span className={wrongCount > 0 ? "has-wrong" : ""}><strong>{wrongCount}</strong> 错题</span>
        </div>
        <p className="daily-review-finish-copy">
          可以直接完成今天的复习；也可以把本轮错题重新配置成新的今日复习队列，再刷一遍。已斩错题会自动跳过。
          {slashedWrongCount > 0 ? ` 本轮有 ${slashedWrongCount} 道错题已斩题。` : ""}
        </p>
        <div className="daily-review-finish-actions">
          <button className="secondary-button daily-review-requeue-button" type="button" onClick={onRequeueMistakes} disabled={requeueableWrongCount === 0}>
            <AlertTriangle size={18} />
            错题重新进入今日复习
          </button>
          <button className="primary-button" type="button" onClick={onFinish}>
            <CheckCircle2 size={18} />
            完成复习
          </button>
        </div>
      </article>
    </div>
  );
}
