import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";

const xlsxPath = path.resolve("seed-source/tech.xlsx");
const zip = await JSZip.loadAsync(fs.readFileSync(xlsxPath));
const sheetPath = await getQuestionSheetPath(zip);
const sharedStrings = await readSharedStrings(zip);
const sheetXml = await readZipText(zip, sheetPath);
const rows = parseSheetRows(sheetXml, sharedStrings);
const counts = {};

for (const row of rows) {
  const type = String(row["题型"] || "其他").trim();
  counts[type] = (counts[type] || 0) + 1;
}

console.log(JSON.stringify({ rows: rows.length, counts }, null, 2));

async function getQuestionSheetPath(zip) {
  const workbookXml = await readZipText(zip, "xl/workbook.xml");
  const workbookRelationshipsXml = await readZipText(zip, "xl/_rels/workbook.xml.rels");
  const relationships = new Map(parseRelationships(workbookRelationshipsXml).map((relationship) => [relationship.id, relationship.target]));
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]+)>/g)].map((match) => ({
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
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((match) => (
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((textMatch) => decodeXml(textMatch[1])).join("")
  ));
}

function parseSheetRows(sheetXml, sharedStrings) {
  const rowEntries = [...sheetXml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)].map((match, index) => ({
    rowNumber: Number(getXmlAttr(match[1], "r")) || index + 1,
    cells: parseSheetCells(match[2], sharedStrings)
  })).sort((a, b) => a.rowNumber - b.rowNumber);
  const headers = rowEntries[0]?.cells ?? [];
  return rowEntries.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [String(header).trim(), row.cells[index] ?? ""])));
}

function parseSheetCells(rowXml, sharedStrings) {
  const values = [];
  for (const match of rowXml.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
    const attrs = match[1];
    const ref = getXmlAttr(attrs, "r");
    const colIndex = ref ? columnNameToIndex(ref.match(/[A-Z]+/)?.[0] ?? "") : values.length;
    values[colIndex] = parseCellValue(attrs, match[2], sharedStrings);
  }
  return values.map((value) => value ?? "");
}

function parseCellValue(attrs, cellXml, sharedStrings) {
  const type = getXmlAttr(attrs, "t");
  if (type === "s") {
    const index = Number(cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? -1);
    return sharedStrings[index] ?? "";
  }
  if (type === "inlineStr") {
    return [...cellXml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1])).join("");
  }
  return decodeXml(cellXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "");
}

function parseRelationships(xml) {
  return [...xml.matchAll(/<Relationship\b([^>]+)>/g)].map((match) => ({
    id: getXmlAttr(match[1], "Id"),
    target: getXmlAttr(match[1], "Target")
  })).filter((relationship) => relationship.id && relationship.target);
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

async function readZipText(zip, filePath) {
  const file = zip.file(filePath);
  return file ? file.async("text") : "";
}

function getXmlAttr(xml, attrName) {
  return xml.match(new RegExp(`${attrName}="([^"]*)"`))?.[1] ?? "";
}

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
