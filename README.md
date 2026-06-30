<h1 align="center">塔里木刷题王</h1>

<p align="center">
  面向油气田岗位取证、技能竞赛与日常复习的离线题库训练应用。
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white">
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-macOS%20%7C%20Windows-24292F">
  <img alt="Android" src="https://img.shields.io/badge/Android-Capacitor-34A853?logo=android&logoColor=white">
  <img alt="Offline" src="https://img.shields.io/badge/Mode-Offline-0E9F6E">
</p>

---

## 为什么做这个项目

塔里木刷题王是一套围绕“刷题、复习、错题、统计、模拟考试、进度迁移”设计的本地学习工具。

设计初衷是让甲方、乙方员工都能使用同一套完整题库备考，减少不同单位、不同管理区之间的信息差，避免恶意竞争。

## 功能亮点

| 模块 | 能力 |
| --- | --- |
| 全量题库 | 内置天然气净化、轻烃操作、采油、集输、安全风险等取证考试和技能竞赛所需 **100% 全量题库**，重点解决**题库不全导致赛场失分、难以冲击满分**的问题 |
| 题库导入导出 | 支持 **Excel 题库导入、题库导出和备份**，便于补充新题、校对题库和跨设备迁移 |
| 多题型练习 | 支持判断题、单选题、多选题等常见考试题型 |
| 每日复习 | 按答题记录、错误情况、连续答对次数和到期时间生成复习队列 |
| 全题库复习 | 自动合并普通题库并去重，不需要在多个题库间反复切换 |
| 错题强化 | 错得多、正确率低、掌握不稳定的题会被优先拉回 |
| 重难题管理 | 低正确率题目集中归档，便于考前突破 |
| 斩题机制 | 已稳定掌握的题可标记为已斩，减少重复消耗 |
| 模拟考试 | 支持按题型配置题量，进行接近实战的考前训练 |
| 学习统计 | 记录每日答题量、正确率、熟练度和复习进度 |
| 本地离线 | 题库和学习记录保存在本机，适合现场和离线环境 |

## 适用场景

- 员工取证考试、岗位等级考试、技能竞赛备考。
- 管理区、班站、项目部组织集中学习和考前训练。
- 个人长期刷题、错题复盘、每日复习和模拟考试。
- macOS、Windows、Android 之间通过学习进度文件手动迁移。

## 技术栈

```text
React 19 + TypeScript + Vite
IndexedDB 本地存储
KaTeX 公式渲染
JSZip / Excel 导入导出
macOS WKWebView 桌面壳
Windows WPF + WebView2 桌面壳
Android Capacitor 壳
```

## 快速开始

```bash
npm ci
npm run dev
```

默认开发服务运行在：

```text
http://127.0.0.1:5173
```

构建前端资源：

```bash
npm run build
```

运行测试：

```bash
npm test
```

质量检查：

```bash
npm run check:quality
npm run check:import
```

## 发布构建

| 平台 | 命令 | 产物 |
| --- | --- | --- |
| macOS arm64 | `npm run desktop:pack` | `release/塔里木刷题王.app` / `.dmg` |
| Windows 10/11 | `npm run desktop:pack:windows` | `release/塔里木刷题王-setup.exe` |
| Android | `npm run android:pack` | `.apk` 安装包 |

Windows 版本需要在 Windows 构建环境执行；Android 版本需要配置 JDK、Android SDK 和签名环境。

## 学习数据

应用使用 IndexedDB 保存本机学习记录，导出的学习进度文件格式为：

```json
{
  "app": "塔里木刷题王",
  "kind": "examdeck-progress-backup",
  "version": 6
}
```

跨设备迁移时只建议使用应用内导入/导出的 JSON 备份文件，不建议直接复制浏览器或 WebView 的 IndexedDB 目录。

## 每日复习策略

每日复习不是固定顺序刷题，而是按学习状态动态生成。系统会优先安排：

- 已学习且到期需要复习的题。
- 错误次数较多的题。
- 正确率较低的题。
- 连续答对次数较少的题。
- 逾期时间较长的题。

完整策略见 [docs/daily-review-strategy.md](docs/daily-review-strategy.md)。

## 项目结构

```text
examdeck/
├── src/                 # React 界面、业务逻辑和测试
├── public/              # 内置题库、图片和静态资源
├── macos/               # macOS WKWebView 封装
├── windows/             # Windows WPF + WebView2 工程
├── android/             # Android / Capacitor 工程
├── installer/           # Windows 安装包脚本
├── scripts/             # 多平台构建脚本
├── docs/                # 复习策略和平台架构文档
├── package.json         # 依赖、脚本和版本信息
└── README.md
```
