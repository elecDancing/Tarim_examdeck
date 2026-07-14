# Android Docker 固化构建环境

本文说明如何使用 Docker 在 macOS、Windows（WSL2）或 Linux 上复现“塔里木刷题王”Android 构建环境。Docker 只负责固定工具链和执行构建，不会把 APK 变成服务器，也不会改变应用的单机离线运行方式。

## 1. 固化范围

镜像固定以下关键环境：

| 组件 | 固定版本 |
| --- | --- |
| 基础镜像 | `eclipse-temurin:21.0.7_6-jdk-jammy`，同时锁定镜像摘要 |
| CPU/系统 | `linux/amd64` |
| JDK | Temurin 21.0.7 |
| Node.js | 22.17.0 |
| Android Command-line Tools | 13114758 |
| Android Platform | API 36 |
| Android Build Tools | 35.0.0（Capacitor 子模块兼容）与 36.0.0（主应用） |
| Gradle | 8.14.3，由项目 wrapper 固定 |
| Android Gradle Plugin | 8.13.0，由项目固定 |
| npm 依赖 | `package-lock.json` + `npm ci` |

这样可以避免开发电脑升级 Node、JDK 或 Android Studio 后造成“同一份代码在不同电脑构建结果不同”。Gradle 和 npm 下载缓存保存在项目的 `.docker-cache/` 中，但缓存不参与版本控制，也不改变依赖版本。

主应用在 Gradle 中明确使用 Build Tools 36.0.0；部分 Capacitor Android 子模块仍按 Android Gradle Plugin 的默认值请求 35.0.0，因此镜像同时固定安装这两个明确版本。两者都是镜像的一部分，构建期间不会临时修改 Android SDK。

## 2. 安全原则

- 正式 keystore 和密码配置不复制进镜像。
- 正式构建时，keystore 与 `release.properties` 以只读文件挂载进入临时容器。
- 容器退出后自动删除；镜像中只保留公开工具链。
- Docker 构建上下文由 `.dockerignore` 限制，仅包含 Dockerfile 与容器入口脚本。
- 不要把 keystore、密码、APK 或 `.docker-cache/` 提交到 Git。

## 3. 前置条件

安装并启动 Docker Desktop 或 Docker Engine，建议：

```text
Docker Desktop 4.40 或更新版本
至少 12 GB 可用磁盘空间
至少 8 GB 内存
稳定网络（首次需下载约数 GB 工具和 Gradle 依赖）
```

Apple Silicon Mac 也使用 `linux/amd64` 镜像，由 Docker Desktop 自动模拟，从而与 GitHub Actions 的 Linux x64 环境保持一致。

检查 Docker：

```bash
docker version
docker info
```

## 4. 查看固化环境

在项目根目录执行：

```bash
bash scripts/build-android-docker.sh info
```

首次执行会构建工具链镜像，随后输出 Node、npm、Java 与已安装 Android SDK 组件。

默认镜像名：

```text
tarim-examdeck/android-builder:node22-jdk21-sdk36
```

## 5. 无签名回归验证

修改代码后先运行：

```bash
npm run android:docker:validate
```

容器会依次执行：

```text
npm ci
→ 业务/规则/端到端/发布测试
→ Android 用户版前端构建
→ 题库和发布质量检查
→ Capacitor 同步
→ Android 原生单元测试
→ Debug APK 与 Android Test APK 构建
```

任何一步失败，命令都会以非零状态退出。

## 6. 正式签名构建

本机准备以下两个被 Git 忽略的文件：

```text
android/keystores/tarim-android-release.jks
android/keystores/release.properties
```

`release.properties` 格式：

```bash
TARIM_ANDROID_KEY_ALIAS=your-alias
TARIM_ANDROID_KEYSTORE_PASSWORD=your-store-password
TARIM_ANDROID_KEY_PASSWORD=your-key-password
```

执行：

```bash
npm run android:docker
```

输出仍位于宿主机的 `release/`：

```text
release/tarim-examdeck-android-v<版本号>.apk
```

构建脚本会再次检查版本、包名、v2 签名、9 个内置题库与 APK 内容。缺少签名文件或任意校验失败时，不会产出新的正式 APK。

## 7. 代理配置

Docker 会自动接收标准代理环境变量。需要使用本机 `7897` 代理时，Docker Desktop for Mac/Windows 推荐使用：

```bash
export HTTP_PROXY=http://host.docker.internal:7897
export HTTPS_PROXY=http://host.docker.internal:7897
npm run android:docker:validate
```

Linux 环境把 `host.docker.internal` 换成宿主机可被容器访问的地址，或在 Docker daemon 中统一配置代理。

## 8. 缓存与清理

容器缓存目录：

```text
.docker-cache/android/gradle
.docker-cache/android/npm
.docker-cache/android/node_modules
```

清空依赖缓存：

```bash
rm -rf .docker-cache/android
```

删除工具链镜像：

```bash
docker image rm tarim-examdeck/android-builder:node22-jdk21-sdk36
```

下次执行脚本会重新创建干净环境。

## 9. 交互排查

需要进入容器检查时：

```bash
bash scripts/build-android-docker.sh shell
```

常见问题：

- `Docker 服务未启动`：启动 Docker Desktop 后重试。
- 下载超时：配置代理，或稍后重试；下载命令内置四次重试。
- Apple Silicon 构建较慢：这是 x64 模拟的正常开销，GitHub Actions 使用原生 x64 会更快。
- 签名失败：确认 keystore、alias 和三个密码来自同一正式签名证书。
- 升级后无法覆盖安装：检查包名仍为 `com.tarim.examdeck`，并确认使用同一正式 keystore。

## 10. 升级工具链

不要直接使用 `latest`。升级时应单独提交并完成以下步骤：

1. 修改 `docker/android/Dockerfile` 中的明确版本及基础镜像摘要。
2. 同步 Android Gradle Plugin、Gradle wrapper 或 SDK 配置（仅在需要时）。
3. 运行 `npm test` 与 `npm run android:docker:validate`。
4. 构建正式 APK并执行 `npm run android:verify -- <APK路径>`。
5. 等待 GitHub Actions 的 Docker 与模拟器任务全部通过。

只有上述验证全部通过，才能把新工具链用于正式 Release。
