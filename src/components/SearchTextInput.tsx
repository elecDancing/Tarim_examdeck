import { useEffect, useRef } from "react";

type SearchTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

export function SearchTextInput({ value, onChange, placeholder }: SearchTextInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || document.activeElement === input || input.value === value) return;
    input.value = value;
  }, [value]);

  const commitValue = () => {
    const input = inputRef.current;
    if (!input) return;
    onChange(input.value);
  };

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
        onChange(event.currentTarget.value);
      }}
      onInput={() => {
        if (!composingRef.current) commitValue();
      }}
      placeholder={placeholder}
    />
  );
}
