import JSZip from "jszip";
import type { ChoiceOption, ImportReport, Question, QuestionType } from "../types";
import { buildStoredImageRef, saveQuestionImage } from "./imageStore";
import { normalizeCellText, normalizeQuestionContentText } from "./textCleanup";

const TYPE_NAMES: QuestionType[] = ["判断题", "单选题", "多选题"];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const MAX_USER_EXCEL_BYTES = 80 * 1024 * 1024;
const MAX_WORKBOOK_ROWS = 30_000;
const MAX_SINGLE_EMBEDDED_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_TOTAL_EMBEDDED_IMAGE_BYTES = 120 * 1024 * 1024;
const XML_PREFIX = String.raw`(?:[\w.-]+:)?`;

type ExcelRow = {
  序号?: string | number;
  题目?: string;
  选项?: string;
  正确答案?: string;
  题型?: string;
  图片?: string;
  图片路径?: string;
  图片地址?: string;
  图片URL?: string;
};

type ParsedExcelRow = ExcelRow & {
  __rowNumber: number;
};

type ParsedQuestion = Question & {
  __rowNumber: number;
  __serial?: string;
};

export async function parseExcelFile(file: File) {
  validateUserExcelFile(file);
  const buffer = await file.arrayBuffer();
  const source = file.name.replace(/\.xlsx$/i, "");
  const embeddedImages = await extractEmbeddedImages(buffer, source);
  return parseExcelWorkbook(buffer, source, embeddedImages);
}

export async function parseExcelWorkbook(buffer: ArrayBuffer, source = "Excel 题库", embeddedImages = new Map<number, string[]>()) {
  const rows = await readWorkbookRows(buffer);
  if (rows.length > MAX_WORKBOOK_ROWS) {
    throw new Error(`Excel 行数过多：${rows.length} 行，最多支持 ${MAX_WORKBOOK_ROWS} 行`);
  }
  const questions: ParsedQuestion[] = [];
  const errors: string[] = [];
  const skippedRows: NonNullable<ImportReport["skippedRows"]> = [];
  let skipped = 0;

  rows.forEach((row, index) => {
    const rowNumber = row.__rowNumber;
    const serial = normalizeText(row.序号);
    const stem = normalizeQuestionContentText(row.题目);
    const type = normalizeType(row.题型);
    const answerText = normalizeQuestionContentText(row.正确答案);
    const imageUrls = [
      ...parseImageUrls(row.图片 || row.图片路径 || row.图片地址 || row.图片URL),
      ...(embeddedImages.get(index) ?? [])
    ];
    const isObjective = type === "判断题" || type === "单选题" || type === "多选题";
    let options = parseOptions(normalizeText(row.选项));
    if (imageUrls.length > 0 && type !== "判断题" && (options.length === 0 || options.some((option) => !option.text))) {
      options = buildImageOptionPlaceholders();
    }
    options = fillBlankOptionPlaceholders(options);
    const answerKeys = isObjective ? parseAnswerKeys(answerText, options) : [];
    const emptyOptionKeys = options.filter((option) => !option.text).map((option) => option.key);
    const emptyAnswerKeys = answerKeys.filter((key) => emptyOptionKeys.includes(key));

    function skipRow(reason: string, detail?: string) {
      skipped += 1;
      const serialText = serial ? `（序号 ${serial}）` : "";
      const message = `第 ${rowNumber} 行${serialText}：${detail ? `${reason}，${detail}` : reason}`;
      errors.push(message);
      skippedRows.push({ rowNumber, serial: serial || undefined, reason, detail });
    }

    if (!stem || !answerText || type === "其他") {
      skipRow("题目、答案为空，或题型不是判断/单选/多选");
      return;
    }

    if (!isObjective || options.length === 0 || answerKeys.length === 0) {
      skipRow("客观题缺少选项或答案");
      return;
    }

    if (emptyOptionKeys.length > 0) {
      skipRow(
        `选项 ${emptyOptionKeys.join("、")} 为空`,
        emptyAnswerKeys.length > 0 ? `正确答案 ${emptyAnswerKeys.join("、")} 指向空选项` : undefined
      );
      return;
    }

    const rowIdentity = normalizeQuestionIdentity(row.序号, rowNumber);
    questions.push({
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
      rawBack: "",
      __rowNumber: rowNumber,
      __serial: serial || undefined
    });
  });

  const deduped = new Map<string, ParsedQuestion>();
  for (const question of questions) {
    const existing = deduped.get(question.id);
    if (existing) {
      const serialText = question.__serial ? `（序号 ${question.__serial}）` : "";
      const reason = `与第 ${existing.__rowNumber} 行重复`;
      errors.push(`第 ${question.__rowNumber} 行${serialText}：${reason}`);
      skippedRows.push({
        rowNumber: question.__rowNumber,
        serial: question.__serial,
        reason
      });
    }
    deduped.set(question.id, question);
  }
  const dedupedQuestions = [...deduped.values()].map((question) => {
    const { __rowNumber, __serial, ...cleanQuestion } = question;
    void __rowNumber;
    void __serial;
    return cleanQuestion;
  });

  const report: ImportReport = {
    totalRows: rows.length,
    imported: dedupedQuestions.length,
    skipped: skippedRows.length,
    images: dedupedQuestions.reduce((sum, question) => sum + (question.imageUrls?.length ?? 0), 0),
    errors,
    skippedRows
  };

  return { questions: dedupedQuestions, report };
}

export function mergeQuestions(existing: Question[], incoming: Question[]) {
  const map = new Map(existing.map((question) => [question.id, question]));
  for (const question of incoming) {
    map.set(question.id, question);
  }
  return [...map.values()];
}

async function readWorkbookRows(buffer: ArrayBuffer): Promise<ParsedExcelRow[]> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error("Excel 文件无法读取，请确认是标准 .xlsx 文件");
  }
  const sheetPath = await getQuestionSheetPath(zip);
  if (!sheetPath) throw new Error("Excel 文件中未找到工作表");
  const sharedStrings = await readSharedStrings(zip);
  const sheetXml = await readZipText(zip, sheetPath);
  return parseSheetRows(sheetXml, sharedStrings);
}

async function readSharedStrings(zip: JSZip) {
  const xml = await readZipText(zip, "xl/sharedStrings.xml");
  if (!xml) return [];
  return [...xml.matchAll(new RegExp(`<${XML_PREFIX}si\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}si>`, "g"))].map((match) => (
    [...match[1].matchAll(new RegExp(`<${XML_PREFIX}t\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}t>`, "g"))]
      .map((textMatch) => decodeXml(textMatch[1]))
      .join("")
  ));
}

function parseSheetRows(sheetXml: string, sharedStrings: string[]): ParsedExcelRow[] {
  const rowEntries = [...sheetXml.matchAll(new RegExp(`<${XML_PREFIX}row\\b([^>]*)>([\\s\\S]*?)<\\/${XML_PREFIX}row>`, "g"))]
    .map((match, index) => ({
      rowNumber: Number(getXmlAttr(match[1], "r")) || index + 1,
      cells: parseSheetCells(match[2], sharedStrings)
    }))
    .sort((a, b) => a.rowNumber - b.rowNumber);
  const headerRow = rowEntries[0];
  if (!headerRow) return [];
  const headers = headerRow.cells;
  return rowEntries.slice(1).map((row) => {
    const item: ParsedExcelRow = { __rowNumber: row.rowNumber };
    headers.forEach((header, index) => {
      const key = normalizeText(header) as keyof ExcelRow;
      if (!key) return;
      item[key] = row.cells[index] ?? "";
    });
    return item;
  });
}

function parseSheetCells(rowXml: string, sharedStrings: string[]) {
  const values: string[] = [];
  for (const match of rowXml.matchAll(new RegExp(`<${XML_PREFIX}c\\b([^>]*?)(?:\\/|>([\\s\\S]*?)<\\/${XML_PREFIX}c)>`, "g"))) {
    const attrs = match[1];
    const cellXml = match[2] ?? "";
    const ref = getXmlAttr(attrs, "r");
    const colIndex = ref ? columnNameToIndex(ref.match(/[A-Z]+/)?.[0] ?? "") : values.length;
    values[colIndex] = parseCellValue(attrs, cellXml, sharedStrings);
  }
  return values.map((value) => value ?? "");
}

function parseCellValue(attrs: string, cellXml: string, sharedStrings: string[]) {
  const type = getXmlAttr(attrs, "t");
  if (type === "s") {
    const index = Number(cellXml.match(new RegExp(`<${XML_PREFIX}v\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}v>`))?.[1] ?? -1);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") {
    return [...cellXml.matchAll(new RegExp(`<${XML_PREFIX}t\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}t>`, "g"))]
      .map((match) => decodeXml(match[1]))
      .join("");
  }
  return decodeXml(cellXml.match(new RegExp(`<${XML_PREFIX}v\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}v>`))?.[1] ?? "");
}

function columnNameToIndex(name: string) {
  return name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

export function questionTypeLabel(type: QuestionType) {
  return TYPE_NAMES.includes(type) ? type : "其他";
}

function parseOptions(value: string): ChoiceOption[] {
  if (!value) return [];
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const matches = [...normalized.matchAll(/(?:^|\n|[ \t\f\v])([A-Z])[\.\．、][ \t\f\v]*/gi)];

  if (matches.length === 0) {
    return normalized
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => optionFromText(LETTERS[index], line));
  }

  return matches.map((match, index) => {
    const key = match[1].toUpperCase();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index ?? normalized.length : normalized.length;
    return optionFromText(key, normalized.slice(start, end).trim());
  });
}

function optionFromText(key: string, value: string): ChoiceOption {
  const text = normalizeQuestionContentText(value);
  return {
    key,
    html: escapeHtml(text).replace(/\n/g, "<br>"),
    text
  };
}

function buildImageOptionPlaceholders() {
  return ["A", "B", "C", "D"].map((key) => optionFromText(key, "图片选项，请补充文字"));
}

function fillBlankOptionPlaceholders(options: ChoiceOption[]) {
  return options.map((option) => (
    option.text
      ? option
      : optionFromText(option.key, `图例${option.key}`)
  ));
}

function parseAnswerKeys(value: string, options: ChoiceOption[]) {
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

function uniqueLetters(value: string) {
  return value
    .replace(/[^A-Z]/g, "")
    .split("")
    .filter((key, index, list) => LETTERS.includes(key) && list.indexOf(key) === index);
}

function findJudgementOption(options: ChoiceOption[], expectedTrue: boolean) {
  const matcher = expectedTrue ? /(对|正确|√|✓|TRUE)/i : /(错|错误|×|✕|FALSE)/i;
  const match = options.find((option) => matcher.test(option.text));
  if (match) return [match.key];
  const fallbackKey = expectedTrue ? "A" : "B";
  return options.some((option) => option.key === fallbackKey) ? [fallbackKey] : [];
}

function parseImageUrls(value: unknown) {
  return normalizeText(value)
    .split(/[\n,;；]+/)
    .map((item) => normalizeImageUrl(item.trim()))
    .filter((item, index, list): item is string => Boolean(item) && list.indexOf(item) === index);
}

function normalizeImageUrl(value: string) {
  if (!value) return "";
  if (/^(见图|见图片|见嵌入图|嵌入图|内嵌图|嵌入图片|内嵌图片)$/i.test(value.trim())) return "";
  if (/^(https?:|data:image\/|\/)/i.test(value)) return value;
  if (value.startsWith("public/")) return `/${value.slice("public/".length)}`;
  return `/${value.replace(/^\.?\//, "")}`;
}

export async function extractEmbeddedImages(buffer: ArrayBuffer, source: string) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    return new Map<number, string[]>();
  }
  const sheetPath = await getQuestionSheetPath(zip);
  if (!sheetPath) return new Map<number, string[]>();

  const sheetRelationshipsPath = getRelationshipPath(sheetPath);
  const sheetRelationshipsXml = await readZipText(zip, sheetRelationshipsPath);
  const drawingRelationship = parseRelationships(sheetRelationshipsXml).find((relationship) => relationship.type.includes("/drawing"));
  if (!drawingRelationship) return new Map<number, string[]>();

  const drawingPath = resolveZipPath(dirname(sheetPath), drawingRelationship.target);
  const drawingXml = await readZipText(zip, drawingPath);
  const drawingRelationshipsXml = await readZipText(zip, getRelationshipPath(drawingPath));
  const imageRelationships = new Map(parseRelationships(drawingRelationshipsXml).map((relationship) => [relationship.id, relationship.target]));
  const imageRefsByRowIndex = new Map<number, string[]>();
  let totalImageBytes = 0;

  for (const anchor of parseDrawingAnchors(drawingXml)) {
    const target = imageRelationships.get(anchor.relationshipId);
    if (!target) continue;
    const imagePath = resolveZipPath(dirname(drawingPath), target);
    const imageFile = zip.file(imagePath);
    if (!imageFile) continue;

    const dataRowIndex = anchor.row - 1;
    if (dataRowIndex < 0) continue;

    const bytes = await imageFile.async("uint8array");
    if (bytes.byteLength > MAX_SINGLE_EMBEDDED_IMAGE_BYTES) continue;
    totalImageBytes += bytes.byteLength;
    if (totalImageBytes > MAX_TOTAL_EMBEDDED_IMAGE_BYTES) break;
    const mimeType = getMimeType(imagePath);
    const imageId = stableId(`${source}|${dataRowIndex}|${anchor.relationshipId}|${imagePath}`);
    const imageBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(imageBuffer).set(bytes);
    await saveQuestionImage(imageId, new Blob([imageBuffer], { type: mimeType }), mimeType);

    const refs = imageRefsByRowIndex.get(dataRowIndex) ?? [];
    refs.push(buildStoredImageRef(imageId));
    imageRefsByRowIndex.set(dataRowIndex, refs);
  }

  return imageRefsByRowIndex;
}

async function getQuestionSheetPath(zip: JSZip) {
  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const workbookRelationshipsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const relationships = new Map(parseRelationships(workbookRelationshipsXml).map((relationship) => [relationship.id, relationship.target]));
  const sheets = [...workbookXml.matchAll(new RegExp(`<${XML_PREFIX}sheet\\b([^>]+)>`, "g"))].map((match) => {
    const attrs = match[1];
    return {
      name: getXmlAttr(attrs, "name"),
      relationshipId: getXmlAttr(attrs, "r:id")
    };
  });
  const sheet = sheets.find((item) => item.name === "题库") ?? sheets[0];
  if (!sheet) return "";
  const target = relationships.get(sheet.relationshipId);
  return target ? resolveZipPath("xl", target) : "";
}

function parseRelationships(xml: string) {
  return [...xml.matchAll(new RegExp(`<${XML_PREFIX}Relationship\\b([^>]+)>`, "g"))].map((match) => {
    const attrs = match[1];
    return {
      id: getXmlAttr(attrs, "Id"),
      type: getXmlAttr(attrs, "Type"),
      target: getXmlAttr(attrs, "Target")
    };
  }).filter((relationship) => relationship.id && relationship.target);
}

function parseDrawingAnchors(xml: string) {
  return [...xml.matchAll(new RegExp(`<${XML_PREFIX}(?:oneCellAnchor|twoCellAnchor)\\b[^>]*>([\\s\\S]*?)<\\/${XML_PREFIX}(?:oneCellAnchor|twoCellAnchor)>`, "g"))].map((match) => {
    const anchorXml = match[1];
    return {
      row: Number(anchorXml.match(new RegExp(`<${XML_PREFIX}from\\b[^>]*>[\\s\\S]*?<${XML_PREFIX}row\\b[^>]*>(\\d+)<\\/${XML_PREFIX}row>`))?.[1]),
      col: Number(anchorXml.match(new RegExp(`<${XML_PREFIX}from\\b[^>]*>[\\s\\S]*?<${XML_PREFIX}col\\b[^>]*>(\\d+)<\\/${XML_PREFIX}col>`))?.[1]),
      relationshipId: anchorXml.match(/(?:r:embed|embed)="([^"]+)"/)?.[1] ?? ""
    };
  }).filter((anchor) => Number.isFinite(anchor.row) && Number.isFinite(anchor.col) && anchor.relationshipId);
}

async function readZipText(zip: JSZip, filePath: string) {
  const file = zip.file(filePath);
  return file ? file.async("text") : "";
}

function getRelationshipPath(filePath: string) {
  const baseName = filePath.split("/").pop() ?? filePath;
  return `${dirname(filePath)}/_rels/${baseName}.rels`;
}

function dirname(filePath: string) {
  return filePath.split("/").slice(0, -1).join("/");
}

function resolveZipPath(baseDir: string, target: string) {
  if (target.startsWith("/")) return target.slice(1);
  const parts = `${baseDir}/${target}`.split("/");
  const resolved: string[] = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") resolved.pop();
    else resolved.push(part);
  }
  return resolved.join("/");
}

function getXmlAttr(xml: string, attrName: string) {
  return xml.match(new RegExp(`${escapeRegExp(attrName)}=(["'])(.*?)\\1`))?.[2] ?? "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getMimeType(filePath: string) {
  const extension = filePath.split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  if (extension === "svg") return "image/svg+xml";
  return "image/png";
}

function normalizeType(value: unknown): QuestionType {
  const text = normalizeText(value);
  if (text.includes("判断")) return "判断题";
  if (text.includes("多选")) return "多选题";
  if (text.includes("单选")) return "单选题";
  return "其他";
}

function validateUserExcelFile(file: File) {
  if (!/\.xlsx$/i.test(file.name)) {
    throw new Error("仅支持导入标准 .xlsx 文件；旧 .xls 请先另存为 .xlsx");
  }
  if (file.size > MAX_USER_EXCEL_BYTES) {
    throw new Error(`Excel 文件过大：最大支持 ${Math.round(MAX_USER_EXCEL_BYTES / 1024 / 1024)}MB`);
  }
}

function normalizeQuestionIdentity(serial: unknown, rowNumber: number) {
  const value = normalizeText(serial);
  return value || `row_${rowNumber}`;
}

function normalizeText(value: unknown) {
  return normalizeCellText(value);
}

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stableId(input: string) {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return `q_${(hash >>> 0).toString(36)}`;
}
