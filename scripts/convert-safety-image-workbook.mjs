import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const XLSX = require("xlsx");

const inputPath = "/Users/xuepengzhang/Documents/国赛测试/图片格式题库/安全题_图片格式_已校验_含图片.xlsx";
const outputPath = "/Users/xuepengzhang/Documents/国赛测试/图片格式题库/安全题_ExamDeck导入格式_含图片列.xlsx";
const imageDir = path.resolve("public/question-images/safety");
const imageUrlPrefix = "/question-images/safety";

fs.mkdirSync(imageDir, { recursive: true });

const workbook = XLSX.readFile(inputPath);
const sheetName = workbook.SheetNames.includes("题库") ? "题库" : workbook.SheetNames[0];
const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "", raw: false });
const anchors = readImageAnchors(inputPath);
const imageUrlsByExcelRow = new Map();

anchors.forEach((anchor, index) => {
  const excelRow = anchor.row + 1;
  const dataIndex = excelRow - 2;
  const row = rows[dataIndex];
  if (!row || !anchor.target) return;

  const sequence = String(row["序号"] || dataIndex + 1).padStart(4, "0");
  const extension = path.extname(anchor.target) || ".png";
  const fileName = `safety-${sequence}-image-${String(index + 1).padStart(2, "0")}${extension}`;
  const targetPath = path.join(imageDir, fileName);
  const zipEntry = anchor.target.replace(/^\/+/, "");
  const bytes = execFileSync("unzip", ["-p", inputPath, zipEntry], { maxBuffer: 20 * 1024 * 1024 });
  fs.writeFileSync(targetPath, bytes);

  const urls = imageUrlsByExcelRow.get(excelRow) ?? [];
  urls.push(`${imageUrlPrefix}/${fileName}`);
  imageUrlsByExcelRow.set(excelRow, urls);
});

const headers = ["序号", "题型", "题目", "选项", "正确答案", "图片"];
const outputRows = rows.map((row, index) => {
  const excelRow = index + 2;
  const embeddedImageUrls = imageUrlsByExcelRow.get(excelRow) ?? [];
  const existingImageText = normalizeText(row["图片"]);
  return {
    "序号": row["序号"],
    "题型": row["题型"],
    "题目": row["题目"],
    "选项": row["选项"],
    "正确答案": row["正确答案"],
    "图片": embeddedImageUrls.length > 0 ? embeddedImageUrls.join("\n") : existingImageText
  };
});

const outputWorkbook = XLSX.utils.book_new();
const outputSheet = XLSX.utils.json_to_sheet(outputRows, { header: headers });
outputSheet["!cols"] = [
  { wch: 8 },
  { wch: 10 },
  { wch: 64 },
  { wch: 34 },
  { wch: 12 },
  { wch: 46 }
];
XLSX.utils.book_append_sheet(outputWorkbook, outputSheet, "题库");
XLSX.writeFile(outputWorkbook, outputPath);

console.log(JSON.stringify({
  inputPath,
  outputPath,
  imageDir,
  rowCount: rows.length,
  imageCount: anchors.length,
  rowsWithImages: imageUrlsByExcelRow.size
}, null, 2));

function readImageAnchors(xlsxPath) {
  const drawingXml = unzipText(xlsxPath, "xl/drawings/drawing1.xml");
  const relsXml = unzipText(xlsxPath, "xl/drawings/_rels/drawing1.xml.rels");
  if (!drawingXml || !relsXml) return [];

  const rels = new Map();
  for (const relationship of relsXml.matchAll(/<Relationship\b([^>]+)>/g)) {
    const attrs = relationship[1];
    const id = getXmlAttr(attrs, "Id");
    const target = getXmlAttr(attrs, "Target");
    if (id && target) rels.set(id, target);
  }

  const anchors = [];
  for (const anchor of drawingXml.matchAll(/<oneCellAnchor>([\s\S]*?)<\/oneCellAnchor>/g)) {
    const xml = anchor[1];
    const row = Number(xml.match(/<from>[\s\S]*?<row>(\d+)<\/row>/)?.[1]);
    const col = Number(xml.match(/<from>[\s\S]*?<col>(\d+)<\/col>/)?.[1]);
    const rid = xml.match(/r:embed="([^"]+)"/)?.[1];
    if (Number.isFinite(row) && Number.isFinite(col) && rid) {
      anchors.push({ row, col, rid, target: rels.get(rid) });
    }
  }
  return anchors;
}

function unzipText(xlsxPath, zipEntry) {
  try {
    return execFileSync("unzip", ["-p", xlsxPath, zipEntry], { encoding: "utf8" });
  } catch {
    return "";
  }
}

function getXmlAttr(xml, attrName) {
  return xml.match(new RegExp(`${attrName}="([^"]+)"`))?.[1] ?? "";
}

function normalizeText(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00A0/g, " ")
    .trim();
}
