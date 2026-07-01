import sharp from "sharp";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const width = 1080;
const height = 1440;
const outDir = path.resolve("mockups");
const outFile = path.join(outDir, "tarim-examdeck-main-promo.png");

const esc = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

const featureTags = ["全量题库", "错题强化", "每日复习", "模拟考试", "学习进度备份", "适合取证/竞赛备考"];
const decks = ["采油工初级/中级/高级/技师", "集输工初级/中级/高级/技师", "天然气净化操作工", "轻烃操作工", "安全风险控制", "技能竞赛专项题库"];

const tagNodes = featureTags.map((tag, index) => {
  const cols = 2;
  const gapX = 24;
  const gapY = 18;
  const cardW = 450;
  const cardH = 88;
  const x = 66 + (index % cols) * (cardW + gapX);
  const y = 1016 + Math.floor(index / cols) * (cardH + gapY);
  const color = index % 3 === 0 ? "#f6b83f" : index % 3 === 1 ? "#38bdf8" : "#34d399";
  return `
    <g transform="translate(${x} ${y})">
      <rect width="${cardW}" height="${cardH}" rx="18" fill="rgba(255,255,255,0.94)" stroke="rgba(255,255,255,0.62)" />
      <circle cx="48" cy="44" r="18" fill="${color}" />
      <path d="M39 44 L46 51 L59 36" fill="none" stroke="#0f2742" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" />
      <text x="84" y="56" font-size="${tag.length > 8 ? 31 : 36}" font-weight="800" fill="#10243d">${esc(tag)}</text>
    </g>`;
}).join("");

const deckNodes = decks.map((deck, index) => {
  const x = index % 2 === 0 ? 0 : 304;
  const y = Math.floor(index / 2) * 46;
  return `
    <g transform="translate(${x} ${y})">
      <rect width="18" height="18" rx="5" fill="${index % 2 === 0 ? "#f6b83f" : "#38bdf8"}"/>
      <text x="30" y="17" font-size="${deck.length > 10 ? 18 : 20}" font-weight="650" fill="#17314f">${esc(deck)}</text>
    </g>`;
}).join("");

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#123d5d"/>
      <stop offset="0.42" stop-color="#0f5d75"/>
      <stop offset="1" stop-color="#17314f"/>
    </linearGradient>
    <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe08a"/>
      <stop offset="1" stop-color="#f2a922"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#07182a" flood-opacity="0.28"/>
    </filter>
    <style>
      text { font-family: "Hiragino Sans GB", "STHeiti", "PingFang SC", "Noto Sans CJK SC", sans-serif; letter-spacing: 0; }
    </style>
  </defs>

  <rect width="${width}" height="${height}" fill="url(#bg)"/>
  <path d="M0 238 C190 180 308 214 474 132 C648 46 832 26 1080 82 L1080 0 L0 0 Z" fill="#1e7f93" opacity="0.42"/>
  <path d="M0 1410 C246 1328 384 1392 578 1304 C770 1218 900 1212 1080 1268 L1080 1440 L0 1440 Z" fill="#0b2139" opacity="0.54"/>

  <g transform="translate(64 74)">
    <rect width="96" height="96" rx="24" fill="url(#gold)"/>
    <text x="48" y="64" text-anchor="middle" font-size="46" font-weight="900" fill="#10243d">塔</text>
    <text x="124" y="42" font-size="28" font-weight="800" fill="#f8fbff">塔里木刷题王</text>
    <text x="124" y="82" font-size="23" font-weight="650" fill="#cfe8f6">油气田岗位取证 · 技能竞赛 · 日常复习</text>
  </g>

  <g transform="translate(64 212)">
    <text x="0" y="80" font-size="76" font-weight="900" fill="#ffffff">备考刷题</text>
    <text x="0" y="160" font-size="76" font-weight="900" fill="#ffd36b">一套就够</text>
    <text x="0" y="218" font-size="30" font-weight="650" fill="#d7edf8">离线可用，本机保存学习记录，按掌握情况安排复习。</text>
  </g>

  <g transform="translate(58 464)" filter="url(#shadow)">
    <rect width="964" height="522" rx="32" fill="#f7fbff"/>
    <rect width="238" height="522" rx="32" fill="#163f62"/>
    <rect x="238" width="726" height="522" rx="32" fill="#f7fbff"/>
    <rect x="238" width="726" height="82" rx="32" fill="#ffffff"/>
    <text x="286" y="54" font-size="30" font-weight="850" fill="#13243a">题库首页</text>
    <text x="776" y="54" font-size="22" font-weight="700" fill="#52667f">今日已练 186 题</text>

    <g transform="translate(28 34)">
      <rect width="66" height="66" rx="18" fill="#f6b83f"/>
      <text x="33" y="45" text-anchor="middle" font-size="32" font-weight="900" fill="#112843">塔</text>
      <text x="84" y="28" font-size="24" font-weight="900" fill="#ffffff">里木刷题王</text>
      <text x="84" y="62" font-size="17" font-weight="650" fill="#cfe8f6">大盘鸡时间到</text>
    </g>
    ${["每日复习", "顺序刷题", "模拟考试", "题库", "错题", "导出备份"].map((item, index) => `
      <g transform="translate(30 ${138 + index * 55})">
        <rect width="178" height="40" rx="12" fill="${index === 0 ? "#2d83b7" : "rgba(255,255,255,0.08)"}"/>
        <text x="48" y="27" font-size="20" font-weight="760" fill="#ffffff">${item}</text>
        <circle cx="25" cy="20" r="6" fill="${index === 0 ? "#f6b83f" : "#9fc4dc"}"/>
      </g>`).join("")}

    <g transform="translate(278 118)">
      <rect width="310" height="144" rx="22" fill="#fff7e7" stroke="#f0c36d"/>
      <text x="24" y="42" font-size="24" font-weight="850" fill="#17314f">每日复习</text>
      <text x="24" y="82" font-size="20" font-weight="650" fill="#5c6d82">按错题、连对次数、到期时间</text>
      <text x="24" y="114" font-size="20" font-weight="650" fill="#5c6d82">自动生成今日复习队列</text>
    </g>
    <g transform="translate(624 118)">
      <rect width="286" height="144" rx="22" fill="#eefcff" stroke="#83d5eb"/>
      <text x="24" y="42" font-size="24" font-weight="850" fill="#17314f">模拟考试</text>
      <text x="24" y="82" font-size="20" font-weight="650" fill="#5c6d82">按题型组卷，交卷统计</text>
      <text x="24" y="114" font-size="20" font-weight="650" fill="#5c6d82">考前检验掌握情况</text>
    </g>

    <rect x="278" y="296" width="632" height="182" rx="22" fill="#ffffff" stroke="#d7e4ef"/>
    <text x="306" y="340" font-size="26" font-weight="850" fill="#17314f">内置岗位题库</text>
    <g transform="translate(306 370)">${deckNodes}</g>
  </g>

  <g>
    ${tagNodes}
  </g>

  <g transform="translate(64 1342)">
    <rect width="952" height="1.5" fill="rgba(255,255,255,0.22)"/>
    <text x="0" y="52" font-size="25" font-weight="700" fill="#d7edf8">刷题 · 复习 · 错题 · 模考 · 进度备份</text>
    <text x="952" y="52" text-anchor="end" font-size="25" font-weight="800" fill="#ffd36b">需要安装/演示可私信</text>
  </g>
</svg>`;

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, "tarim-examdeck-main-promo.svg"), svg);
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(outFile);
console.log(outFile);
