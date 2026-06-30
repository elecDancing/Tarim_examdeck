import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const root = process.cwd();
const exportedAt = "2026-06-29T17:46:00.000Z";

const seedDecks = [
  { id: "deck_gas_purification_junior", name: "天然气净化工初级工", file: "gas-purification-junior.xlsx" },
  { id: "deck_gas_purification_intermediate", name: "天然气净化工中级工", file: "gas-purification-intermediate.xlsx" },
  { id: "deck_gas_purification_senior", name: "天然气净化工高级工", file: "gas-purification-senior.xlsx" },
  { id: "deck_tech", name: "天然气净化工技师", file: "tech.xlsx", source: "技师题" },
  { id: "deck_light_hydrocarbon_senior_technician", name: "轻烃操作工高级工及技师", file: "light-hydrocarbon-senior-technician.xlsx" },
  { id: "deck_oilfield_risk_control", name: "油气田开发危害因素辨识与风险防控", file: "oilfield-risk-control.xlsx" },
  { id: "deck_oil_production_junior", name: "采油工初级", file: "oil-production-junior.xlsx" },
  { id: "deck_oil_production_intermediate", name: "采油工中级", file: "oil-production-intermediate.xlsx" },
  { id: "deck_oil_production_senior", name: "采油工高级", file: "oil-production-senior.xlsx" },
  { id: "deck_oil_production_technician", name: "采油工技师", file: "oil-production-technician.xlsx" },
  { id: "deck_gathering_transportation_junior", name: "集输工初级", file: "gathering-transportation-junior.xlsx" },
  { id: "deck_gathering_transportation_intermediate", name: "集输工中级", file: "gathering-transportation-intermediate.xlsx" },
  { id: "deck_gathering_transportation_senior", name: "集输工高级", file: "gathering-transportation-senior.xlsx" },
  { id: "deck_gathering_transportation_technician", name: "集输工技师", file: "gathering-transportation-technician.xlsx" }
];

const bundledSafetyImagePaths = {
  "0010": "/question-images/safety/safety-0010-image-01.png",
  "0011": "/question-images/safety/safety-0011-image-02.png",
  "0015": "/question-images/safety/safety-0015-image-03.png",
  "0148": "/question-images/safety/safety-0148-image-04.png",
  "0192": "/question-images/safety/safety-0192-image-05.png",
  "0220": "/question-images/safety/safety-0220-image-06.png",
  "0242": "/question-images/safety/safety-0242-image-07.png",
  "0593": "/question-images/safety/safety-0593-image-08.png",
  "0594": "/question-images/safety/safety-0594-image-09.png",
  "0598": "/question-images/safety/safety-0598-image-10.png",
  "0599": "/question-images/safety/safety-0599-image-11.png",
  "0602": "/question-images/safety/safety-0602-image-12.png",
  "0603": "/question-images/safety/safety-0603-image-13.png",
  "0605": "/question-images/safety/safety-0605-image-14.png",
  "0606": "/question-images/safety/safety-0606-image-15.png",
  "0608": "/question-images/safety/safety-0608-image-16.png",
  "0609": "/question-images/safety/safety-0609-image-17.png",
  "0611": "/question-images/safety/safety-0611-image-18.png",
  "0614": "/question-images/safety/safety-0614-image-19.png",
  "0615": "/question-images/safety/safety-0615-image-20.png",
  "0849": "/question-images/safety/safety-0849-image-21.png",
  "0861": "/question-images/safety/safety-0861-image-22.png",
  "0871": "/question-images/safety/safety-0871-image-23.png",
  "0877": "/question-images/safety/safety-0877-image-24.png",
  "0881": "/question-images/safety/safety-0881-image-25.png",
  "0917": "/question-images/safety/safety-0917-image-26.png",
  "0986": "/question-images/safety/safety-0986-image-27.png",
  "0993": "/question-images/safety/safety-0993-image-28.png"
};

const questions = [];
const decks = [];
const reports = [];

for (const seed of seedDecks) {
  const source = seed.source ?? seed.name;
  const workbookPath = path.join(root, "seed-source", seed.file);
  const parsed = await parseWorkbook(workbookPath, source);
  questions.push(...parsed.questions);
  decks.push({
    id: seed.id,
    name: seed.name,
    questionIds: parsed.questions.map((question) => question.id),
    createdAt: exportedAt,
    updatedAt: exportedAt,
    isSeed: true
  });
  reports.push({ name: seed.name, ...parsed.report });
}

const payload = {
  app: "塔里木刷题王",
  kind: "examdeck-progress-backup",
  version: 7,
  exportedAt,
  data: {
    questions,
    decks,
    stats: {},
    dailyStats: {},
    notes: {},
    favoriteQuestionIds: [],
    slashedQuestionIds: [],
    autoHardQuestionIds: [],
    studyPlanDeckIds: [],
    sessions: [],
    activeSession: null,
    practices: {},
    dailyReviewSessions: {},
    dailyReviewSession: null,
    dailyMistakeSummary: null,
    dailyReviewCompletion: null,
    seedImported: true
  }
};

const outputPath = path.join(root, "public", "bootstrap", "progress.json");
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`);

console.log(JSON.stringify({
  outputPath,
  decks: decks.length,
  questions: questions.length,
  reports
}, null, 2));

async function parseWorkbook(workbookPath, source) {
  const rows = await readWorkbookRows(fs.readFileSync(workbookPath));
  const parsedQuestions = [];
  const errors = [];
  const skippedRows = [];

  rows.forEach((row) => {
    const rowNumber = row.__rowNumber;
    const serial = normalizeText(row.序号);
    const stem = normalizeQuestionContentText(row.题目);
    const type = normalizeType(row.题型);
    const answerText = normalizeQuestionContentText(row.正确答案);
    const imageUrls = parseImageUrls(row.图片 || row.图片路径 || row.图片地址 || row.图片URL);
    const bundledImageUrl = getBundledSafetyImageUrl(source, serial);
    if (bundledImageUrl && !imageUrls.includes(bundledImageUrl)) imageUrls.push(bundledImageUrl);
    const options = fillBlankOptionPlaceholders(parseOptions(normalizeText(row.选项)));
    const answerKeys = parseAnswerKeys(answerText, options);
    const isObjective = type === "判断题" || type === "单选题" || type === "多选题";

    function skip(reason, detail = "") {
      const serialText = serial ? `（序号 ${serial}）` : "";
      const message = `第 ${rowNumber} 行${serialText}：${detail ? `${reason}，${detail}` : reason}`;
      errors.push(message);
      skippedRows.push({ rowNumber, serial: serial || undefined, source, reason, detail: detail || undefined });
    }

    if (!stem || !answerText || !isObjective) {
      skip("题目、答案为空，或题型不是判断/单选/多选");
      return;
    }
    if (options.length === 0 || answerKeys.length === 0) {
      skip("客观题缺少选项或答案");
      return;
    }

    const emptyOptionKeys = options.filter((option) => !option.text).map((option) => option.key);
    if (emptyOptionKeys.length > 0) {
      skip(`选项 ${emptyOptionKeys.join("、")} 为空`);
      return;
    }

    const rowIdentity = serial || `row_${rowNumber}`;
    parsedQuestions.push({
      id: stableId(`${source}|${rowIdentity}|${type}`),
      uid: `${source} #${String(row.序号 || rowNumber - 1).padStart(4, "0")}`,
      type,
      stemHtml: escapeHtml(stem).replace(/\n/g, "<br>"),
      stemText: stem,
      imageUrls,
      options,
      answerKeys,
      answerText,
      explanationHtml: escapeHtml(answerText).replace(/\n/g, "<br>"),
      tags: [source, type],
      source,
      rawFront: "",
      rawBack: ""
    });
  });

  const deduped = new Map();
  for (const question of parsedQuestions) deduped.set(question.id, question);
  const dedupedQuestions = [...deduped.values()];

  return {
    questions: dedupedQuestions,
    report: {
      totalRows: rows.length,
      imported: dedupedQuestions.length,
      skipped: skippedRows.length,
      images: dedupedQuestions.reduce((sum, question) => sum + (question.imageUrls?.length ?? 0), 0),
      errors,
      skippedRows
    }
  };
}

async function readWorkbookRows(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const sheetPath = await getQuestionSheetPath(zip);
  const sharedStrings = await readSharedStrings(zip);
  const sheetXml = await readZipText(zip, sheetPath);
  return parseSheetRows(sheetXml, sharedStrings);
}

async function getQuestionSheetPath(zip) {
  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const workbookRelationshipsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const relationships = new Map(parseRelationships(workbookRelationshipsXml).map((relationship) => [relationship.id, relationship.target]));
  const sheets = [...workbookXml.matchAll(/<(?:[\w.-]+:)?sheet\b([^>]+)>/g)].map((match) => ({
    name: getXmlAttr(match[1], "name"),
    relationshipId: getXmlAttr(match[1], "r:id")
  }));
  const sheet = sheets.find((item) => item.name === "题库") ?? sheets[0];
  if (!sheet) throw new Error("未找到工作表");
  const target = relationships.get(sheet.relationshipId);
  if (!target) throw new Error("未找到工作表路径");
  return resolveZipPath("xl", target);
}

async function readSharedStrings(zip) {
  const xml = await readZipText(zip, "xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.matchAll(/<(?:[\w.-]+:)?si\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?si>/g)].map((match) => (
    [...match[1].matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("")
  ));
}

function parseSheetRows(sheetXml, sharedStrings) {
  const rowEntries = [...sheetXml.matchAll(/<(?:[\w.-]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?row>/g)]
    .map((match, index) => ({
      rowNumber: Number(getXmlAttr(match[1], "r")) || index + 1,
      cells: parseSheetCells(match[2], sharedStrings)
    }))
    .sort((a, b) => a.rowNumber - b.rowNumber);
  const headers = rowEntries[0]?.cells ?? [];
  return rowEntries.slice(1).map((row) => {
    const item = { __rowNumber: row.rowNumber };
    headers.forEach((header, index) => {
      const key = normalizeText(header);
      if (key) item[key] = row.cells[index] ?? "";
    });
    return item;
  });
}

function parseSheetCells(rowXml, sharedStrings) {
  const values = [];
  for (const match of rowXml.matchAll(/<(?:[\w.-]+:)?c\b([^>]*?)(?:\/|>([\s\S]*?)<\/(?:[\w.-]+:)?c)>/g)) {
    const attrs = match[1];
    const cellXml = match[2] ?? "";
    const ref = getXmlAttr(attrs, "r");
    const colIndex = ref ? columnNameToIndex(ref.match(/[A-Z]+/)?.[0] ?? "") : values.length;
    values[colIndex] = parseCellValue(attrs, cellXml, sharedStrings);
  }
  return values.map((value) => value ?? "");
}

function parseCellValue(attrs, cellXml, sharedStrings) {
  const type = getXmlAttr(attrs, "t");
  if (type === "s") {
    const index = Number(cellXml.match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/)?.[1] ?? -1);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<(?:[\w.-]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?t>/g)]
      .map((match) => decodeXml(match[1]))
      .join("");
  }
  return decodeXml(cellXml.match(/<(?:[\w.-]+:)?v\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?v>/)?.[1] ?? "");
}

function parseOptions(value) {
  if (!value) return [];
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const matches = [...normalized.matchAll(/(?:^|\n|[ \t\f\v])([A-Z])[\.\．、][ \t\f\v]*/gi)];
  if (matches.length === 0) {
    return normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => optionFromText("ABCDEFGHIJKLMNOPQRSTUVWXYZ"[index], line));
  }
  return matches.map((match, index) => {
    const key = match[1].toUpperCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    return optionFromText(key, normalized.slice(start, end).trim());
  });
}

function optionFromText(key, value) {
  const text = normalizeQuestionContentText(value);
  return {
    key,
    html: escapeHtml(text).replace(/\n/g, "<br>"),
    text
  };
}

function fillBlankOptionPlaceholders(options) {
  return options.map((option) => (
    option.text
      ? option
      : optionFromText(option.key, `图例${option.key}`)
  ));
}

function parseAnswerKeys(value, options) {
  const text = normalizeText(value);
  const upper = text.toUpperCase();
  const optionKeys = new Set(options.map((option) => option.key));
  const compact = upper.replace(/[\s,，、;；/]/g, "");
  const letterRuns = text.match(/[A-Z]+/gi) ?? [];
  const looksLikeAnswerList = /^[\sA-Z,，、;；/]+$/i.test(text)
    && (letterRuns.length <= 1 || letterRuns.every((run) => run.length === 1));
  if (looksLikeAnswerList && compact && compact.split("").every((key) => optionKeys.has(key))) {
    return uniqueLetters(compact);
  }
  const firstKey = upper.match(/^\s*([A-Z])/)?.[1];
  if (firstKey && optionKeys.has(firstKey)) return [firstKey];
  const normalized = text.replace(/[\s()（）]/g, "");
  if (/^(对|正确|√|✓|TRUE)$/i.test(normalized)) return findJudgementOption(options, true);
  if (/^(错|错误|×|✕|X|FALSE)$/i.test(normalized)) return findJudgementOption(options, false);
  return uniqueLetters(upper).filter((key) => optionKeys.has(key));
}

function uniqueLetters(value) {
  return value
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((key, index, list) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(key) && list.indexOf(key) === index);
}

function findJudgementOption(options, expectedTrue) {
  const matcher = expectedTrue ? /(对|正确|√|✓|TRUE)/i : /(错|错误|×|✕|FALSE)/i;
  const match = options.find((option) => matcher.test(option.text));
  if (match) return [match.key];
  const fallbackKey = expectedTrue ? "A" : "B";
  return options.some((option) => option.key === fallbackKey) ? [fallbackKey] : [];
}

function parseImageUrls(value) {
  return normalizeText(value)
    .split(/[\n,;；]+/)
    .map((item) => normalizeImageUrl(item.trim()))
    .filter((item, index, list) => Boolean(item) && list.indexOf(item) === index);
}

function normalizeImageUrl(value) {
  if (!value) return "";
  if (/^(见图|见图片|见嵌入图|嵌入图|内嵌图|嵌入图片|内嵌图片)$/i.test(value.trim())) return "";
  if (/^(https?:|data:image\/|\/)/i.test(value)) return value;
  if (value.startsWith("public/")) return `/${value.slice("public/".length)}`;
  return `/${value.replace(/^\.?\//, "")}`;
}

function getBundledSafetyImageUrl(source, serial) {
  if (source !== "油气田开发危害因素辨识与风险防控") return "";
  const key = String(serial || "").padStart(4, "0");
  return bundledSafetyImagePaths[key] ?? "";
}

function normalizeType(value) {
  const text = normalizeText(value);
  if (text.includes("判断")) return "判断题";
  if (text.includes("多选")) return "多选题";
  if (text.includes("单选")) return "单选题";
  return "其他";
}

function normalizeQuestionContentText(value) {
  return collapseSoftLineBreaks(normalizeText(value));
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u00A0\u3000]/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/[ \t\f\v]*\n[ \t\f\v]*/g, "\n")
    .trim();
}

function collapseSoftLineBreaks(value) {
  if (!value.includes("\n")) return value.trim();
  const output = [];
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

function shouldPreserveLineBreak(previousLine, nextLine) {
  if (/[。！？!?；;：:]$/.test(previousLine)) return true;
  if (/^(?:[（(]?\d{1,3}[）).、]|[①-⑳]|[A-Z][.．、]|[a-z][.．、]|[•·●○\-—])/.test(nextLine)) return true;
  if (previousLine.trim().endsWith("$$") || nextLine.trim().startsWith("$$")) return true;
  return false;
}

function needsJoinSpace(previousLine, nextLine) {
  return /[A-Za-z0-9%）)\]}]$/.test(previousLine) && /^[A-Za-z0-9$（(\[{]/.test(nextLine);
}

function parseRelationships(xml) {
  return [...xml.matchAll(/<(?:[\w.-]+:)?Relationship\b([^>]+)>/g)].map((match) => ({
    id: getXmlAttr(match[1], "Id"),
    target: getXmlAttr(match[1], "Target")
  })).filter((relationship) => relationship.id && relationship.target);
}

async function readZipText(zip, filePath) {
  const file = zip.file(filePath);
  return file ? file.async("text") : "";
}

function getXmlAttr(xml, attrName) {
  return xml.match(new RegExp(`${escapeRegExp(attrName)}=(["'])(.*?)\\1`))?.[2] ?? "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveZipPath(baseDir, target) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const resolved = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

function columnNameToIndex(name) {
  return name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stableId(input) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = Math.imul(hash, 33) ^ input.charCodeAt(index);
  }
  return `q_${(hash >>> 0).toString(36)}`;
}
