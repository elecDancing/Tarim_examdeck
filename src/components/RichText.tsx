import { useMemo } from "react";
import type { ReactNode } from "react";
import type { ProficiencyLevel } from "../types";
import { buildHighlightRegex, getProficiencyClass, parseRichText } from "../lib/appRules";

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

export function HighlightedRichText({ text, terms, className = "" }: { text: string; terms: string[]; className?: string }) {
  const parts = useMemo(() => parseRichText(text), [text]);
  return (
    <span className={["rich-text", className].filter(Boolean).join(" ")}>
      {parts.map((part, index) => {
        if (part.kind === "text") return <HighlightedPlainText key={index} value={part.value} terms={terms} />;
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

function HighlightedPlainText({ value, terms }: { value: string; terms: string[] }) {
  const regex = buildHighlightRegex(terms);
  if (!regex) return <span className="rich-text-plain">{value}</span>;
  const nodes: ReactNode[] = [];
  let cursor = 0;
  value.replace(regex, (match, _term, offset: number) => {
    if (offset > cursor) nodes.push(<span key={`text-${cursor}`}>{value.slice(cursor, offset)}</span>);
    nodes.push(<mark key={`mark-${offset}`} className="search-highlight">{match}</mark>);
    cursor = offset + match.length;
    return match;
  });
  if (cursor < value.length) nodes.push(<span key={`text-${cursor}`}>{value.slice(cursor)}</span>);
  return <span className="rich-text-plain">{nodes}</span>;
}

export function ProficiencyBadge({ level, compact = false }: { level: ProficiencyLevel; compact?: boolean }) {
  return <span className={`proficiency-badge proficiency-${getProficiencyClass(level)} ${compact ? "compact" : ""}`}>{level}</span>;
}
