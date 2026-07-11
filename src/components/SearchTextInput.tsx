import { useEffect, useRef } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const lastCommittedValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const commitFrameRef = useRef<number | null>(null);
  const valueWatchFrameRef = useRef<number | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || value === lastCommittedValueRef.current) return;
    lastCommittedValueRef.current = value;
    if (!composingRef.current && input.value !== value) input.value = value;
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const commitCurrentValue = () => {
      const nextValue = input.value;
      reopenCollapsedSearchResults(input);
      if (lastCommittedValueRef.current === nextValue) return;
      lastCommittedValueRef.current = nextValue;
      onChangeRef.current(nextValue);
    };
    const scheduleCommit = () => {
      if (commitFrameRef.current !== null) window.cancelAnimationFrame(commitFrameRef.current);
      commitFrameRef.current = window.requestAnimationFrame(() => {
        commitFrameRef.current = null;
        commitCurrentValue();
      });
    };
    const stopValueWatch = () => {
      if (valueWatchFrameRef.current === null) return;
      window.cancelAnimationFrame(valueWatchFrameRef.current);
      valueWatchFrameRef.current = null;
    };
    const startValueWatch = () => {
      stopValueWatch();
      const watch = () => {
        commitCurrentValue();
        if (document.activeElement === input) valueWatchFrameRef.current = window.requestAnimationFrame(watch);
        else valueWatchFrameRef.current = null;
      };
      valueWatchFrameRef.current = window.requestAnimationFrame(watch);
    };
    const handleInput = () => {
      reopenCollapsedSearchResults(input);
      commitCurrentValue();
    };
    const handleCompositionStart = () => {
      composingRef.current = true;
    };
    const handleCompositionEnd = () => {
      composingRef.current = false;
      scheduleCommit();
    };
    const handleCompositionUpdate = () => {
      scheduleCommit();
    };
    const handleFocus = () => {
      if (input.value.trim()) reopenCollapsedSearchResults(input);
      startValueWatch();
    };
    const handleBlur = () => {
      composingRef.current = false;
      stopValueWatch();
      commitCurrentValue();
    };

    input.addEventListener("input", handleInput);
    input.addEventListener("compositionstart", handleCompositionStart);
    input.addEventListener("compositionupdate", handleCompositionUpdate);
    input.addEventListener("compositionend", handleCompositionEnd);
    input.addEventListener("change", commitCurrentValue);
    input.addEventListener("focus", handleFocus);
    input.addEventListener("blur", handleBlur);
    return () => {
      if (commitFrameRef.current !== null) {
        window.cancelAnimationFrame(commitFrameRef.current);
        commitFrameRef.current = null;
      }
      stopValueWatch();
      input.removeEventListener("input", handleInput);
      input.removeEventListener("compositionstart", handleCompositionStart);
      input.removeEventListener("compositionupdate", handleCompositionUpdate);
      input.removeEventListener("compositionend", handleCompositionEnd);
      input.removeEventListener("change", commitCurrentValue);
      input.removeEventListener("focus", handleFocus);
      input.removeEventListener("blur", handleBlur);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      className="search-text-input"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      defaultValue={value}
      placeholder={placeholder}
    />
  );
}

function reopenCollapsedSearchResults(input: HTMLInputElement | null) {
  input?.closest(".search-panel")?.classList.remove("mobile-search-results-collapsed", "mobile-search-results-closing");
}
