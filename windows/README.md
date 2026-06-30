# Windows 版构建说明

在 Windows 10/11 构建机安装：

- Node.js 20 或更新版本
- .NET 8 SDK
- NSIS 3（用于生成 `setup.exe`；也兼容 Inno Setup 6）
- WebView2 Runtime（用户机器通常已随 Edge 安装）

在 `examdeck` 目录运行：

```powershell
npm run desktop:pack:windows
```

脚本会执行：

1. 使用 `VITE_DISABLE_QUESTION_BANK_EXPORT=1` 构建用户版前端，禁用题库 Excel/ZIP 导出。
2. 发布 self-contained WPF + WebView2 Windows 应用，用户无需额外安装 .NET。
3. 如果检测到 NSIS `makensis`，生成安装包：`release/塔里木刷题王-setup.exe`。

内置学习数据来自 `public/bootstrap/progress.json`。该文件只包含干净题库，不包含测试答题进度。
