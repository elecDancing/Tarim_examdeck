import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const lastEmittedValueRef = useRef(value);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    lastEmittedValueRef.current = value;
    if (!composingRef.current) setLocalValue(value);
  }, [value]);

  const updateValue = (nextValue: string) => {
    setLocalValue(nextValue);
    reopenCollapsedSearchResults(inputRef.current);
    if (lastEmittedValueRef.current === nextValue) return;
    lastEmittedValueRef.current = nextValue;
    onChange(nextValue);
  };

  const handleTextInput = (event: FormEvent<HTMLInputElement>) => {
    updateValue(event.currentTarget.value);
  };

  return (
    <input
      ref={inputRef}
      className="search-text-input"
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      value={localValue}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        updateValue(event.currentTarget.value);
      }}
      onInput={handleTextInput}
      onChange={handleTextInput}
      onFocus={(event) => {
        if (event.currentTarget.value.trim()) reopenCollapsedSearchResults(event.currentTarget);
      }}
      onBlur={(event) => updateValue(event.currentTarget.value)}
      placeholder={placeholder}
    />
  );
}

function reopenCollapsedSearchResults(input: HTMLInputElement | null) {
  input?.closest(".search-panel")?.classList.remove("mobile-search-results-collapsed", "mobile-search-results-closing");
}
