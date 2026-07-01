import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { PracticeState } from "../types";
import { getPracticeWrongQuestionIds } from "../lib/appRules";

type MistakePracticeFinishDialogProps = {
  practice: PracticeState;
  label: string;
  onContinueWrong: () => void;
  onExit: () => void;
  onClose: () => void;
};

export function MistakePracticeFinishDialog({ practice, label, onContinueWrong, onExit, onClose }: MistakePracticeFinishDialogProps) {
  const results = practice.results ?? {};
  const finishedCount = practice.questionIds.filter((questionId) => results[questionId] !== undefined).length;
  const correctCount = practice.questionIds.filter((questionId) => results[questionId] === true).length;
  const wrongCount = getPracticeWrongQuestionIds(practice).length;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop review-finish-backdrop" onMouseDown={onClose}>
      <article className="daily-review-finish-dialog" role="dialog" aria-modal="true" aria-label={`完成${label}`} onMouseDown={(event) => event.stopPropagation()}>
        <header className="daily-review-finish-header">
          <span className="daily-review-finish-icon">
            <AlertTriangle size={24} strokeWidth={2.4} />
          </span>
          <div>
            <span className="eyebrow">{label}</span>
            <h2>本轮{label}总结</h2>
          </div>
          <button className="icon-button" type="button" aria-label="关闭" onClick={onClose}>
            <XCircle size={20} />
          </button>
        </header>
        <div className="daily-review-finish-stats">
          <span><strong>{finishedCount}</strong> 已判定</span>
          <span><strong>{correctCount}</strong> 正确</span>
          <span className={wrongCount > 0 ? "has-wrong" : ""}><strong>{wrongCount}</strong> 本轮错题</span>
        </div>
        <p className="daily-review-finish-copy">
          可以直接退出{label}；如果本轮又做错了题，也可以只把这些题继续生成下一轮刷题。
        </p>
        <div className="daily-review-finish-actions">
          <button className="secondary-button daily-review-requeue-button" type="button" onClick={onContinueWrong} disabled={wrongCount === 0}>
            <RotateCcw size={18} />
            继续刷本次错题
          </button>
          <button className="primary-button" type="button" onClick={onExit}>
            <CheckCircle2 size={18} />
            退出{label}
          </button>
        </div>
      </article>
    </div>
  );
}
