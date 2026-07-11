import { useEffect, useRef, useState } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    if (!composingRef.current) setLocalValue(value);
  }, [value]);

  const updateValue = (nextValue: string, force = false) => {
    setLocalValue(nextValue);
    if (!force && composingRef.current) return;
    reopenCollapsedSearchResults(inputRef.current);
    onChange(nextValue);
  };

  return (
    <input
      ref={inputRef}
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      value={localValue}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        updateValue(event.currentTarget.value, true);
      }}
      onChange={(event) => {
        updateValue(event.currentTarget.value);
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
