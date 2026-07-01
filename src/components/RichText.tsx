import { useMemo } from "react";
import { parseRichText } from "../lib/appRules";

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  const parts = useMemo(() => parseRichText(text), [text]);
  return (
    <span className={["rich-text", className].filter(Boolean).join(" ")}>
      {parts.map((part, index) => {
        if (part.kind === "text") {
          return <span key={index} className="rich-text-plain">{part.value}</span>;
        }
        return (
          <span
            key={index}
            className={part.displayMode ? "rich-formula rich-formula-block" : "rich-formula rich-formula-inline"}
            dangerouslySetInnerHTML={{ __html: part.html }}
          />
        );
      })}
    </span>
  );
}
