import JSZip from "jszip";
import type { Question } from "../types";
import { saveBlob } from "./fileExport";
import { isStoredImageRef, resolveQuestionImageUrl } from "./imageStore";

const EXPORT_HEADERS = ["序号", "题型", "题目", "选项", "正确答案", "笔记", "图片"];
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ZIP_MIME = "application/zip";
const RELATIONSHIPS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";
const DRAWING_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing";
const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const DRAWING_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.drawing+xml";
const EMU_PER_PIXEL = 9525;

type ExportDeck = {
  deckName: string;
  questions: Question[];
  notes?: Record<string, string>;
};

type EmbeddedImage = {
  rowNumber: number;
  colIndex: number;
  colOffsetPx: number;
  bytes: ArrayBuffer;
  extension: string;
  mimeType: string;
  widthPx: number;
  heightPx: number;
};

export async function exportQuestionsToExcel(deckName: string, questions: Question[], notes: Record<string, string> = {}) {
  const blob = await buildQuestionsWorkbookBlob(deckName, questions, notes);
  await saveBlob(blob, `${sanitizeFileName(deckName || "题库")}.xlsx`, XLSX_MIME);
}

export async function exportQuestionDecksToZip(decks: ExportDeck[]) {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const deck of decks) {
    const blob = await buildQuestionsWorkbookBlob(deck.deckName, deck.questions, deck.notes ?? {});
    const fileName = uniqueFileName(`${sanitizeFileName(deck.deckName || "题库")}.xlsx`, usedNames);
    zip.file(fileName, await blob.arrayBuffer());
  }

  const today = new Date().toISOString().slice(0, 10);
  const zipBlob = await zip.generateAsync({ type: "blob", mimeType: ZIP_MIME });
  await saveBlob(zipBlob, `全部题库Excel导出-${today}.zip`, ZIP_MIME);
}

async function buildQuestionsWorkbookBlob(deckName: string, questions: Question[], notes: Record<string, string>) {
  const imageRows = new Map<number, EmbeddedImage[]>();
  const fallbackImageUrls = new Map<number, string[]>();

  for (let index = 0; index < questions.length; index += 1) {
    const rowNumber = index + 2;
    const { images, fallbackUrls } = await collectEmbeddedImages(questions[index], rowNumber);
    if (images.length > 0) imageRows.set(rowNumber, images);
    if (fallbackUrls.length > 0) fallbackImageUrls.set(rowNumber, fallbackUrls);
  }

  const rows = [
    EXPORT_HEADERS,
    ...questions.map((question, index) => {
    const rowNumber = index + 2;
    return [
      String(index + 1),
      question.type,
      question.stemText,
      formatExportOptions(question),
      question.answerKeys.join(""),
      notes[question.id] ?? "",
      (fallbackImageUrls.get(rowNumber) ?? []).join("\n")
    ];
  })
  ];

  const zip = buildBaseWorkbookZip(rows, buildRowHeights(questions, imageRows, notes));

  await applyWorkbookFormatting(zip);
  if (imageRows.size > 0) {
    await injectImages(zip, [...imageRows.values()].flat());
  }

  return zip.generateAsync({ type: "blob", mimeType: XLSX_MIME });
}

function buildBaseWorkbookZip(rows: string[][], rowHeights: Array<{ hpt: number }>) {
  const zip = new JSZip();
  zip.file("[Content_Types].xml", buildContentTypesXml());
  zip.file("_rels/.rels", buildRootRelationshipsXml());
  zip.file("xl/workbook.xml", buildWorkbookXml());
  zip.file("xl/_rels/workbook.xml.rels", buildWorkbookRelationshipsXml());
  zip.file("xl/styles.xml", buildStylesXml());
  zip.file("xl/worksheets/sheet1.xml", buildSheetXml(rows, rowHeights));
  zip.file("xl/worksheets/_rels/sheet1.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}"></Relationships>`);
  return zip;
}

async function collectEmbeddedImages(question: Question, rowNumber: number) {
  const images: EmbeddedImage[] = [];
  const fallbackUrls: string[] = [];
  const urls = question.imageUrls ?? [];

  for (let index = 0; index < urls.length; index += 1) {
    const url = urls[index];
    const resolvedUrl = await resolveQuestionImageUrl(url);
    if (!resolvedUrl) continue;

    try {
      const response = await fetch(resolvedUrl);
      if (!response.ok) throw new Error(`图片读取失败：${response.status}`);
      const blob = await response.blob();
      const dimensions = await measureImage(blob);
      const size = fitImage(dimensions.width, dimensions.height);
      const mimeType = blob.type || getMimeTypeFromUrl(resolvedUrl);
      images.push({
        rowNumber,
        colIndex: 6 + index * 2,
        colOffsetPx: 0,
        bytes: await blob.arrayBuffer(),
        extension: getImageExtension(mimeType, resolvedUrl),
        mimeType,
        widthPx: size.width,
        heightPx: size.height
      });
    } catch {
      if (!isStoredImageRef(url)) fallbackUrls.push(url);
    }
  }

  return { images, fallbackUrls };
}

function buildRowHeights(questions: Question[], imageRows: Map<number, EmbeddedImage[]>, notes: Record<string, string>) {
  const rows: Array<{ hpt: number }> = [{ hpt: 26 }];
  for (let index = 0; index < questions.length; index += 1) {
    const rowNumber = index + 2;
    const question = questions[index];
    const optionLines = Math.max(1, question.options.length);
    const stemLines = Math.max(1, Math.ceil(question.stemText.length / 34));
    const noteLines = Math.max(1, Math.ceil((notes[question.id] ?? "").length / 24));
    const textHeight = Math.min(180, Math.max(34, Math.max(optionLines, stemLines, noteLines) * 18 + 8));
    const imageHeight = Math.max(0, ...(imageRows.get(rowNumber) ?? []).map((image) => image.heightPx * 0.75 + 12));
    rows.push({ hpt: Math.max(textHeight, imageHeight) });
  }
  return rows;
}

function buildContentTypesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
    '</Types>'
  ].join("");
}

function buildRootRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<Relationships xmlns="${RELATIONSHIPS_NS}">`,
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
    '</Relationships>'
  ].join("");
}

function buildWorkbookXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    '<sheets><sheet name="题库" sheetId="1" r:id="rId1"/></sheets>',
    '</workbook>'
  ].join("");
}

function buildWorkbookRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<Relationships xmlns="${RELATIONSHIPS_NS}">`,
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>',
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
    '</Relationships>'
  ].join("");
}

function buildStylesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
    '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>',
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    '</styleSheet>'
  ].join("");
}

function buildSheetXml(rows: string[][], rowHeights: Array<{ hpt: number }>) {
  const rowXml = rows.map((row, rowIndex) => {
    const rowNumber = rowIndex + 1;
    const height = rowHeights[rowIndex]?.hpt ?? 24;
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex)}${rowNumber}`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowNumber}" ht="${height}" customHeight="1">${cells}</row>`;
  }).join("");
  const lastRef = `${columnName(Math.max(0, EXPORT_HEADERS.length - 1))}${Math.max(1, rows.length)}`;
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    `<dimension ref="A1:${lastRef}"/>`,
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>',
    '<sheetFormatPr defaultRowHeight="24"/>',
    '<cols>',
    '<col min="1" max="1" width="8" customWidth="1"/>',
    '<col min="2" max="2" width="10" customWidth="1"/>',
    '<col min="3" max="3" width="64" customWidth="1"/>',
    '<col min="4" max="4" width="58" customWidth="1"/>',
    '<col min="5" max="5" width="12" customWidth="1"/>',
    '<col min="6" max="6" width="42" customWidth="1"/>',
    '<col min="7" max="9" width="34" customWidth="1"/>',
    '</cols>',
    `<sheetData>${rowXml}</sheetData>`,
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
    '</worksheet>'
  ].join("");
}

function columnName(index: number) {
  let dividend = index + 1;
  let name = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    name = String.fromCharCode(65 + modulo) + name;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return name;
}

function escapeXml(value: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function applyWorkbookFormatting(zip: JSZip) {
  const stylesPath = "xl/styles.xml";
  const sheetPath = "xl/worksheets/sheet1.xml";
  const stylesXml = await readZipText(zip, stylesPath);
  const { xml: nextStylesXml, styleId } = appendWrapTextStyle(stylesXml);
  zip.file(stylesPath, nextStylesXml);

  const sheetXml = await readZipText(zip, sheetPath);
  zip.file(sheetPath, applyWrapTextStyleToSheet(sheetXml, styleId));
}

async function injectImages(zip: JSZip, images: EmbeddedImage[]) {
  images.forEach((image, index) => {
    const imageNumber = index + 1;
    const extension = normalizeImageExtension(image.extension);
    zip.file(`xl/media/image${imageNumber}.${extension}`, image.bytes);
  });

  zip.file("xl/drawings/drawing1.xml", buildDrawingXml(images));
  zip.file("xl/drawings/_rels/drawing1.xml.rels", buildDrawingRelationshipsXml(images));

  const contentTypesPath = "[Content_Types].xml";
  let contentTypesXml = await readZipText(zip, contentTypesPath);
  contentTypesXml = addContentTypeOverride(contentTypesXml, "/xl/drawings/drawing1.xml", DRAWING_CONTENT_TYPE);
  for (const image of images) {
    contentTypesXml = ensureDefaultContentType(contentTypesXml, normalizeImageExtension(image.extension), image.mimeType);
  }
  zip.file(contentTypesPath, contentTypesXml);

  const sheetRelationshipsPath = "xl/worksheets/_rels/sheet1.xml.rels";
  const sheetRelationshipsXml = await readZipText(zip, sheetRelationshipsPath);
  const relationship = appendRelationship(sheetRelationshipsXml, DRAWING_REL_TYPE, "../drawings/drawing1.xml");
  zip.file(sheetRelationshipsPath, relationship.xml);

  const sheetPath = "xl/worksheets/sheet1.xml";
  const sheetXml = await readZipText(zip, sheetPath);
  if (!sheetXml.includes("<drawing ")) {
    zip.file(sheetPath, sheetXml.replace("</worksheet>", `<drawing r:id="${relationship.id}"/></worksheet>`));
  }
}

function buildDrawingXml(images: EmbeddedImage[]) {
  const anchors = images.map((image, index) => {
    const imageNumber = index + 1;
    const cx = Math.round(image.widthPx * EMU_PER_PIXEL);
    const cy = Math.round(image.heightPx * EMU_PER_PIXEL);
    return [
      "<xdr:oneCellAnchor>",
      "<xdr:from>",
      `<xdr:col>${image.colIndex}</xdr:col>`,
      `<xdr:colOff>${Math.round(image.colOffsetPx * EMU_PER_PIXEL)}</xdr:colOff>`,
      `<xdr:row>${image.rowNumber - 1}</xdr:row>`,
      "<xdr:rowOff>0</xdr:rowOff>",
      "</xdr:from>",
      `<xdr:ext cx="${cx}" cy="${cy}"/>`,
      "<xdr:pic>",
      "<xdr:nvPicPr>",
      `<xdr:cNvPr id="${imageNumber}" name="Picture ${imageNumber}"/>`,
      '<xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr>',
      "</xdr:nvPicPr>",
      `<xdr:blipFill><a:blip r:embed="rId${imageNumber}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>`,
      `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>`,
      "</xdr:pic>",
      "<xdr:clientData/>",
      "</xdr:oneCellAnchor>"
    ].join("");
  }).join("");

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    anchors,
    "</xdr:wsDr>"
  ].join("");
}

function buildDrawingRelationshipsXml(images: EmbeddedImage[]) {
  const relationships = images.map((image, index) => {
    const imageNumber = index + 1;
    const extension = normalizeImageExtension(image.extension);
    return `<Relationship Id="rId${imageNumber}" Type="${IMAGE_REL_TYPE}" Target="../media/image${imageNumber}.${extension}"/>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}">${relationships}</Relationships>`;
}

function appendWrapTextStyle(stylesXml: string) {
  const match = stylesXml.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/);
  if (!match) return { xml: stylesXml, styleId: 0 };

  const styleId = Number(match[1]);
  const wrapXf = '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>';
  return {
    styleId,
    xml: stylesXml.replace(
      /<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/,
      (_full, count, content) => `<cellXfs count="${Number(count) + 1}">${content}${wrapXf}</cellXfs>`
    )
  };
}

function applyWrapTextStyleToSheet(sheetXml: string, styleId: number) {
  return sheetXml.replace(/<c r="([A-G]\d+)"([^>]*)>/g, (cell, _ref, attrs) => {
    if (attrs.includes(' s="')) return cell.replace(/ s="\d+"/, ` s="${styleId}"`);
    return cell.replace(">", ` s="${styleId}">`);
  });
}

function formatExportOptions(question: Question) {
  return question.options
    .map((option) => `${option.key}. ${option.text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd()}`)
    .join("\n")
    .trimEnd();
}

function appendRelationship(xml: string, type: string, target: string) {
  const baseXml = xml || `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${RELATIONSHIPS_NS}"></Relationships>`;
  const existing = [...baseXml.matchAll(/<Relationship\b([^>]+)>/g)].map((match) => ({
    id: getXmlAttr(match[1], "Id"),
    target: getXmlAttr(match[1], "Target"),
    type: getXmlAttr(match[1], "Type")
  }));
  const found = existing.find((relationship) => relationship.target === target && relationship.type === type);
  if (found) return { xml: baseXml, id: found.id };

  const nextId = `rId${existing.length + 1}`;
  const relationshipXml = `<Relationship Id="${nextId}" Type="${type}" Target="${target}"/>`;
  return { xml: baseXml.replace("</Relationships>", `${relationshipXml}</Relationships>`), id: nextId };
}

function addContentTypeOverride(xml: string, partName: string, contentType: string) {
  if (xml.includes(`PartName="${partName}"`)) return xml;
  return xml.replace("</Types>", `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
}

function ensureDefaultContentType(xml: string, extension: string, mimeType: string) {
  if (!extension || xml.includes(`Extension="${extension}"`)) return xml;
  return xml.replace("</Types>", `<Default Extension="${extension}" ContentType="${mimeType || "application/octet-stream"}"/></Types>`);
}

async function measureImage(blob: Blob) {
  try {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return measureImageWithElement(blob);
  }
}

function measureImageWithElement(blob: Blob) {
  return new Promise<{ width: number; height: number }>((resolve) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth || 220, height: image.naturalHeight || 140 });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ width: 220, height: 140 });
    };
    image.src = url;
  });
}

function fitImage(width: number, height: number) {
  const maxWidth = 220;
  const maxHeight = 150;
  if (!width || !height) return { width: maxWidth, height: 120 };
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  return { width: Math.max(60, Math.round(width * scale)), height: Math.max(50, Math.round(height * scale)) };
}

async function readZipText(zip: JSZip, path: string) {
  const file = zip.file(path);
  return file ? file.async("text") : "";
}

function getXmlAttr(xml: string, attrName: string) {
  return xml.match(new RegExp(`${attrName}="([^"]*)"`))?.[1] ?? "";
}

function getMimeTypeFromUrl(url: string) {
  const extension = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "gif") return "image/gif";
  if (extension === "webp") return "image/webp";
  return "image/png";
}

function getImageExtension(mimeType: string, url: string) {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpeg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("bmp")) return "bmp";
  const extension = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  if (extension && /^[a-z0-9]+$/.test(extension)) return extension === "jpg" ? "jpeg" : extension;
  return "png";
}

function normalizeImageExtension(extension: string) {
  return extension === "jpg" ? "jpeg" : extension;
}

function sanitizeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, "_").trim() || "题库";
}

function uniqueFileName(name: string, usedNames: Set<string>) {
  if (!usedNames.has(name)) {
    usedNames.add(name);
    return name;
  }
  const dotIndex = name.lastIndexOf(".");
  const base = dotIndex > 0 ? name.slice(0, dotIndex) : name;
  const extension = dotIndex > 0 ? name.slice(dotIndex) : "";
  let index = 2;
  while (usedNames.has(`${base}-${index}${extension}`)) index += 1;
  const next = `${base}-${index}${extension}`;
  usedNames.add(next);
  return next;
}
