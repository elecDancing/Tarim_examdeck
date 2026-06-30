import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function filePath(...parts) {
  return path.join(root, ...parts);
}

function exists(...parts) {
  return fs.existsSync(filePath(...parts));
}

function lineCount(...parts) {
  return fs.readFileSync(filePath(...parts), "utf8").split(/\r?\n/).length;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

function sizeOf(dirOrFile) {
  if (!fs.existsSync(dirOrFile)) return 0;
  const stat = fs.statSync(dirOrFile);
  if (stat.isFile()) return stat.size;
  return fs.readdirSync(dirOrFile).reduce((sum, name) => sum + sizeOf(path.join(dirOrFile, name)), 0);
}

const appLines = lineCount("src", "App.tsx");
if (appLines > 6500) fail(`src/App.tsx 行数过高：${appLines} > 6500`);

const stylesEntryLines = lineCount("src", "styles.css");
if (stylesEntryLines > 100) fail(`src/styles.css 入口过大：${stylesEntryLines} > 100`);

const stylePartialsDir = filePath("src", "styles");
const stylePartials = walk(stylePartialsDir).filter((item) => item.endsWith(".css"));
if (stylePartials.length < 2) fail("CSS 未拆分到 src/styles/*.css");
for (const partial of stylePartials) {
  const count = fs.readFileSync(partial, "utf8").split(/\r?\n/).length;
  if (count > 1200) fail(`${path.relative(root, partial)} 行数过高：${count} > 1200`);
}

if (exists("public", "seed")) fail("public/seed 不应进入发布静态资源");
for (const file of walk(filePath("public"))) {
  const relative = path.relative(root, file);
  if (path.basename(file) === ".DS_Store") fail(`${relative} 不应进入发布资源`);
  if (/backup/i.test(relative)) fail(`${relative} 是备份文件，不应进入发布资源`);
  if (/\.xlsx$/i.test(file)) fail(`${relative} 是 Excel 种子，不应进入发布资源`);
}

const bootstrapPath = filePath("public", "bootstrap", "progress.json");
if (!fs.existsSync(bootstrapPath)) {
  fail("缺少 public/bootstrap/progress.json");
} else {
  const payload = JSON.parse(fs.readFileSync(bootstrapPath, "utf8"));
  const data = payload.data ?? payload;
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const decks = Array.isArray(data.decks) ? data.decks : [];
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const questionIds = new Set(questions.map((question) => question.id));
  const referencedIds = new Set(decks.flatMap((deck) => Array.isArray(deck.questionIds) ? deck.questionIds : []));
  const orphanCount = questions.filter((question) => !referencedIds.has(question.id)).length;
  const duplicateSessionCount = sessions.length - new Set(sessions.map((session) => session.id)).size;
  const missingReferenceCount = [...referencedIds].filter((id) => !questionIds.has(id)).length;

  if (questions.length === 0) fail("bootstrap 题目为空");
  if (decks.length === 0) fail("bootstrap 题库为空");
  if (orphanCount > 0) fail(`bootstrap 存在孤立题目：${orphanCount}`);
  if (duplicateSessionCount > 0) fail(`bootstrap 存在重复考试记录 ID：${duplicateSessionCount}`);
  if (missingReferenceCount > 0) fail(`bootstrap 题库引用了不存在的题目：${missingReferenceCount}`);
}

const distDir = filePath("dist");
if (!fs.existsSync(distDir)) {
  fail("缺少 dist，请先运行 npm run build");
} else {
  const distFiles = walk(distDir);
  const jsFiles = distFiles.filter((file) => file.endsWith(".js"));
  for (const file of jsFiles) {
    const size = fs.statSync(file).size;
    if (size > 500 * 1024) fail(`${path.relative(root, file)} 单块 JS 过大：${Math.round(size / 1024)}KB > 500KB`);
  }
  for (const file of distFiles) {
    const relative = path.relative(distDir, file);
    if (relative.startsWith(`seed${path.sep}`)) fail(`dist 仍包含 seed 目录：${relative}`);
    if (/backup/i.test(relative)) fail(`dist 仍包含备份文件：${relative}`);
    if (path.basename(file) === ".DS_Store") fail(`dist 仍包含 .DS_Store：${relative}`);
  }
  const distSizeMb = sizeOf(distDir) / 1024 / 1024;
  if (distSizeMb > 75) fail(`dist 体积过大：${distSizeMb.toFixed(1)}MB > 75MB`);
}

if (failures.length > 0) {
  console.error(["质量校验失败：", ...failures.map((item) => `- ${item}`)].join("\n"));
  process.exit(1);
}

console.log("质量校验通过");
console.log(JSON.stringify({
  appLines,
  stylesEntryLines,
  stylePartials: stylePartials.length,
  publicSizeMb: Number((sizeOf(filePath("public")) / 1024 / 1024).toFixed(1)),
  distSizeMb: fs.existsSync(distDir) ? Number((sizeOf(distDir) / 1024 / 1024).toFixed(1)) : null
}, null, 2));
