import { useEffect, useState } from "react";

export const ANSWER_SEARCH_CLOSE_EVENT = "android-answer-search-close";

export function useAnswerSearchState() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement && activeElement.closest(".practice-answer-search")) activeElement.blur();
      setOpen(false);
    };
    window.addEventListener(ANSWER_SEARCH_CLOSE_EVENT, close);
    return () => window.removeEventListener(ANSWER_SEARCH_CLOSE_EVENT, close);
  }, []);

  useEffect(() => {
    if (!open || !document.documentElement.classList.contains("native-android")) return;
    const timer = window.setTimeout(() => {
      document.querySelector<HTMLInputElement>(".practice-answer-search.open input")?.focus({ preventScroll: true });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (open) return;
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && activeElement.closest(".practice-answer-search")) activeElement.blur();
  }, [open]);

  return [open, setOpen] as const;
}
