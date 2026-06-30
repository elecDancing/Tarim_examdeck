import type { MouseEvent } from "react";

type DismissLayerProps = {
  onDismiss: () => void;
};

export function MobileNavDismissLayer({ onDismiss }: DismissLayerProps) {
  return <button className="mobile-nav-dismiss-layer" type="button" tabIndex={-1} aria-label="收起导航" onClick={onDismiss} />;
}

export function AnswerProgressDismissLayer({ onDismiss }: DismissLayerProps) {
  return <button className="answer-progress-dismiss-layer" type="button" tabIndex={-1} aria-label="返回答题页面" onClick={onDismiss} />;
}

export function isAnswerProgressBlankTap(event: MouseEvent<HTMLElement>) {
  if (!document.documentElement.classList.contains("native-android")) return false;
  const target = event.target;
  return target instanceof HTMLElement && !target.closest("button,input,label,a,textarea,select");
}
