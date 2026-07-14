<h1 align="center">塔里木刷题王 · Android</h1>

<p align="center">
  面向油气田岗位取证、技能竞赛与日常复习的离线 Android 刷题应用。
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Capacitor" src="https://img.shields.io/badge/Android-Capacitor-34A853?logo=android&logoColor=white">
  <img alt="Offline" src="https://img.shields.io/badge/Mode-Offline-0E9F6E">
</p>

## 维护范围

`codex/android-only` 是 Android 单平台维护分支。桌面端最后的多平台基线保存在 Git 标签：

```text
desktop-final-v1.0.50
```

当前分支不再提供 macOS、Windows 或 iOS 构建入口。共享业务代码中的兼容分支会在有测试保护的前提下逐步清理。

## 主要功能

- 判断题、单选题和多选题练习。
- 顺序刷题、每日复习、错题、收藏、重难题和已斩题目。
- 模拟考试、学习统计、复习预测和热力图。
- Excel 自定义题库导入。
- 本机离线保存学习进度、笔记和题目图片。
- 学习进度手动导入、导出和恢复。
- KaTeX 公式渲染与题目图片显示。

正式安装包固定包含 9 个内置题库。发布校验会拒绝缺少题库、额外题库、孤立题目或无效题目引用。

## 技术栈

```text
React 19 + TypeScript + Vite
Capacitor Android
IndexedDB 本地持久化
KaTeX 公式渲染
JSZip / Excel 导入
Vitest + jsdom
```

## 本地开发

需要 Node.js 22：

```bash
npm ci
npm run dev
```

运行全部回归测试：

```bash
npm test
```

构建前端并执行质量检查：

```bash
VITE_DISABLE_QUESTION_BANK_EXPORT=1 npm run build
npm run check:quality
```

## Android 正式构建

需要：

- JDK 21
- Android SDK 36
- Android Build Tools
- 正式发布 keystore

本机签名配置保存在被 Git 忽略的文件：

```text
android/keystores/release.properties
```

格式：

```bash
TARIM_ANDROID_KEY_ALIAS=your-alias
TARIM_ANDROID_KEYSTORE_PASSWORD=your-store-password
TARIM_ANDROID_KEY_PASSWORD=your-key-password
```

keystore 默认路径：

```text
android/keystores/tarim-android-release.jks
```

执行正式构建：

```bash
npm run android:pack
```

该命令固定执行：

```text
全部回归测试
→ Android 用户版前端构建
→ 质量与内置题库检查
→ Capacitor 同步
→ Gradle 签名构建
→ 包名、版本、v2 签名和 APK 内容校验
```

任何一步失败都不会产出新的正式 APK。签名文件缺失时构建会直接失败，不会自动创建新证书。

APK 输出格式：

```text
release/tarim-examdeck-android-v1.0.51.apk
```

## 版本规则

`package.json` 是 Android 版本的唯一来源。Gradle 自动派生：

```text
versionName = package.json version
versionCode = major × 1,000,000 + minor × 1,000 + patch
```

不要再手工修改 `android/app/build.gradle` 中的版本号。

## GitHub Actions

`.github/workflows/android.yml` 会在 Android 分支和 Pull Request 上执行测试、质量检查并构建 Debug APK。

推送与版本一致的 `v*` 标签时会构建签名 APK并发布 GitHub Release。仓库需要配置：

```text
TARIM_ANDROID_KEYSTORE_BASE64
TARIM_ANDROID_KEY_ALIAS
TARIM_ANDROID_KEYSTORE_PASSWORD
TARIM_ANDROID_KEY_PASSWORD
```

## 学习数据

应用使用 IndexedDB 保存本机学习记录。覆盖安装和升级时必须保留相同包名与签名。换手机或清理应用数据前，使用应用内“导出学习进度”生成备份；恢复时使用“导入学习进度”。

完整每日复习规则见 [docs/daily-review-strategy.md](docs/daily-review-strategy.md)。Android 架构和验收清单见 [docs/android-version-architecture.md](docs/android-version-architecture.md)。

## 项目结构

```text
examdeck/
├── src/                 # React 界面、业务逻辑和测试
├── public/              # 9 个内置题库、图片和静态资源
├── android/             # Capacitor Android 工程
├── scripts/             # Android 构建、版本和发布校验
├── docs/                # Android 架构与复习规则
├── .github/workflows/   # Android CI / Release
├── package.json         # 唯一应用版本源
└── README.md
```
