const LIST_LINE_START = /^(?:[（(]?\d{1,3}[）).、]|[①-⑳]|[A-Z][.．、]|[a-z][.．、]|[•·●○\-—])/;
const SENTENCE_END = /[。！？!?；;：:]$/;

export function normalizeCellText(value: unknown) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t\f\v]*\n[ \t\f\v]*/g, "\n")
    .trim();
}

export function normalizeQuestionContentText(value: unknown) {
  return collapseSoftLineBreaks(normalizeCellText(value));
}

export function collapseSoftLineBreaks(value: string) {
  if (!value.includes("\n")) return value.trim();

  const output: string[] = [];
  const lines = value.split("\n").map((line) => line.trim());

  for (const line of lines) {
    if (!line) {
      if (output.length > 0 && output[output.length - 1] !== "") output.push("");
      continue;
    }

    const previous = output[output.length - 1];
    if (previous === undefined || previous === "" || shouldPreserveLineBreak(previous, line)) {
      output.push(line);
      continue;
    }

    output[output.length - 1] = `${previous}${needsJoinSpace(previous, line) ? " " : ""}${line}`;
  }

  return output.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function shouldPreserveLineBreak(previousLine: string, nextLine: string) {
  if (SENTENCE_END.test(previousLine)) return true;
  if (LIST_LINE_START.test(nextLine)) return true;
  if (previousLine.trim().endsWith("$$") || nextLine.trim().startsWith("$$")) return true;
  return false;
}

function needsJoinSpace(previousLine: string, nextLine: string) {
  return /[A-Za-z0-9%）)\]}]$/.test(previousLine) && /^[A-Za-z0-9$（(\[{]/.test(nextLine);
}
