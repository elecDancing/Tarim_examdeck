# 塔里木刷题王 Windows 版

Windows 版使用 `.NET 8 WPF + WebView2` 承载同一套 React/Vite 前端。刷题业务、题库规则、每日复习、错题、收藏、模拟考试和学习进度协议均复用主项目。

## 环境要求

| 依赖 | 用途 |
| --- | --- |
| Windows 10/11 | 构建与运行目标系统 |
| Node.js 20+ | 安装依赖并构建 Vite 前端 |
| .NET 8 SDK | 发布 WPF 桌面应用 |
| NSIS 3 | 生成 `setup.exe` 安装包 |
| WebView2 Runtime | 运行桌面 WebView，用户机器通常已随 Edge 安装 |

## 一键构建

在 `examdeck` 根目录执行：

```powershell
npm run desktop:pack:windows
```

脚本会依次完成：

1. 使用 `VITE_DISABLE_QUESTION_BANK_EXPORT=1` 构建用户版前端。
2. 发布 self-contained WPF + WebView2 Windows 应用。
3. 检测 `makensis`，存在时生成安装包。

## 构建产物

```text
release/
└── 塔里木刷题王-setup.exe
```

安装包面向普通用户分发。self-contained 发布模式会把 .NET 运行时打进应用，用户无需额外安装 .NET SDK。

## 内置数据

用户版内置学习数据来自：

```text
public/bootstrap/progress.json
```

该文件应只包含干净题库，不应包含开发机测试答题进度。

## 数据兼容

Windows 版继续使用主项目的学习进度协议：

```json
{
  "kind": "examdeck-progress-backup",
  "version": 6
}
```

macOS、Windows、Android 之间迁移学习记录时，应通过应用内导入/导出的 JSON 备份文件完成，不要直接复制 WebView2 的 IndexedDB 目录。

## 发布前检查

```powershell
npm test
npm run build
npm run desktop:pack:windows
```

建议手动验证：

- 应用可离线打开。
- 内置题库能正常加载。
- 每日复习、错题、收藏、已斩题状态可写入并在重启后保留。
- 学习进度 JSON 可以导出后重新导入。
- 用户版不暴露题库 Excel/ZIP 导出入口。

## 深入文档

架构细节见 [../docs/windows-version-architecture.md](../docs/windows-version-architecture.md)。
