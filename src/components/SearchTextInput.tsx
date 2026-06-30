import { useEffect, useRef, useState } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(value);
  const composingRef = useRef(false);
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    lastEmittedRef.current = value;
    setDraft(value);
  }, [value]);

  const emitValue = (nextValue: string) => {
    setDraft(nextValue);
    if (composingRef.current || nextValue === lastEmittedRef.current) return;
    lastEmittedRef.current = nextValue;
    onChange(nextValue);
  };

  return (
    <input
      ref={inputRef}
      inputMode="search"
      enterKeyHint="search"
      autoComplete="off"
      value={draft}
      onCompositionStart={() => { composingRef.current = true; }}
      onCompositionEnd={(event) => {
        composingRef.current = false;
        emitValue(event.currentTarget.value);
      }}
      onInput={(event) => {
        emitValue(event.currentTarget.value);
      }}
      onChange={(event) => {
        emitValue(event.currentTarget.value);
      }}
      placeholder={placeholder}
    />
  );
}
