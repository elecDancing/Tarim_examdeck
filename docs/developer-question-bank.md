# 开发者题库维护说明

## 结论

当前开发者桌面版仍然可以修改用于构建各端版本的内置题库。

应用实际打包到 macOS、Windows、Android 的内置题库文件是：

```text
public/bootstrap/progress.json
```

各端构建都会先执行 Vite 构建，`public/` 目录会进入 `dist/`，因此这个文件会被同步打进对应版本。

## App 内编辑链路

开发者版没有设置 `VITE_DISABLE_QUESTION_BANK_EXPORT=1`，所以题目编辑保存后会调用原生桌面桥接：

- macOS：`macos/TarimExamdeckApp.swift`
- Windows：`windows/MainWindow.xaml.cs`

原生桥接会按题目 `id` 更新：

```text
public/bootstrap/progress.json
```

普通浏览器环境没有本地写文件能力，只会跳过题库源写回。因此要验证写回能力，应使用开发者桌面版，而不是只在浏览器里跑 `npm run dev`。

## Excel 源和 Bootstrap 的关系

`seed-source/*.xlsx` 是题库的 Excel 源文件。只有手动执行下面命令时，才会从 Excel 重新生成 `public/bootstrap/progress.json`：

```bash
npm run question-bank:rebuild
```

注意：这个命令会覆盖 `public/bootstrap/progress.json`。如果开发者已经在 App 内编辑过题目，但没有同步回 Excel 源，再执行该命令会丢失这些 App 内编辑。

## 推荐流程

### 直接用开发者桌面版改题

1. 打开开发者桌面版。
2. 在题目编辑界面修改题目并保存。
3. 看到“题目已更新，并已写回内置题库源”后，重新构建各端版本。

构建命令：

```bash
npm run desktop:pack
npm run desktop:pack:windows
npm run android:pack
```

### 从 Excel 统一重建

1. 修改 `seed-source/*.xlsx`。
2. 执行：

```bash
npm run question-bank:rebuild
```

3. 再构建各端版本。

## 用户版限制

Windows 和 Android 用户版构建脚本会设置：

```text
VITE_DISABLE_QUESTION_BANK_EXPORT=1
```

因此用户版不会导出题库，也不会写回内置题库源。这个限制不影响学习进度的手动导入导出。
