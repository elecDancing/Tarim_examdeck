import { useEffect, useRef } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const lastEmittedRef = useRef(value);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const input = inputRef.current;
    lastEmittedRef.current = value;
    if (!input || input.value === value) return;
    if (document.activeElement === input && value !== "") return;
    input.value = value;
  }, [value]);

  const emitValue = (nextValue: string, force = false) => {
    if (!force && composingRef.current) return;
    reopenCollapsedSearchResults(inputRef.current);
    if (nextValue === lastEmittedRef.current) return;
    lastEmittedRef.current = nextValue;
    onChangeRef.current(nextValue);
  };

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const syncInput = () => emitValue(input.value);
    const finishComposition = () => {
      composingRef.current = false;
      emitValue(input.value, true);
    };
    input.addEventListener("input", syncInput);
    input.addEventListener("keyup", syncInput);
    input.addEventListener("compositionend", finishComposition);
    return () => {
      input.removeEventListener("input", syncInput);
      input.removeEventListener("keyup", syncInput);
      input.removeEventListener("compositionend", finishComposition);
    };
  }, []);

  return (
    <input
      ref={inputRef}
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      defaultValue={value}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        emitValue(event.currentTarget.value, true);
      }}
      onInput={(event) => {
        emitValue(event.currentTarget.value);
      }}
      onChange={(event) => {
        emitValue(event.currentTarget.value);
      }}
      onFocus={(event) => {
        if (event.currentTarget.value.trim()) reopenCollapsedSearchResults(event.currentTarget);
      }}
      placeholder={placeholder}
    />
  );
}

function reopenCollapsedSearchResults(input: HTMLInputElement | null) {
  input?.closest(".search-panel")?.classList.remove("mobile-search-results-collapsed", "mobile-search-results-closing");
}
