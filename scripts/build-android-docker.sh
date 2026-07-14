#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

die() {
  echo "Android Docker 构建失败：$*" >&2
  exit 1
}

command -v docker >/dev/null 2>&1 || die "未安装 Docker Desktop 或 Docker Engine"
docker info >/dev/null 2>&1 || die "Docker 服务未启动"

MODE="${1:-release}"
case "$MODE" in
  info|validate|release|shell) ;;
  *) die "不支持的模式：$MODE（可用：info、validate、release、shell）" ;;
esac

IMAGE_NAME="${TARIM_ANDROID_DOCKER_IMAGE:-tarim-examdeck/android-builder:node22-jdk21-sdk36}"
CACHE_DIR="$ROOT_DIR/.docker-cache/android"
mkdir -p "$CACHE_DIR/gradle" "$CACHE_DIR/npm" "$CACHE_DIR/node_modules" "$ROOT_DIR/release"

BUILD_ARGS=(
  --platform linux/amd64
  --file docker/android/Dockerfile
  --tag "$IMAGE_NAME"
  --build-arg "BUILDER_UID=$(id -u)"
  --build-arg "BUILDER_GID=$(id -g)"
)

for proxy_name in HTTP_PROXY HTTPS_PROXY NO_PROXY; do
  proxy_value="${!proxy_name:-}"
  if [[ -n "$proxy_value" ]]; then
    BUILD_ARGS+=(--build-arg "$proxy_name=$proxy_value")
  fi
done

echo "==> Building pinned Android toolchain image"
docker build "${BUILD_ARGS[@]}" .

RUN_ARGS=(
  --rm
  --init
  --platform linux/amd64
  --volume "$ROOT_DIR:/workspace"
  --volume "$CACHE_DIR/gradle:/home/android-builder/.gradle"
  --volume "$CACHE_DIR/npm:/home/android-builder/.npm"
  --volume "$CACHE_DIR/node_modules:/workspace/node_modules"
)

if [[ "$MODE" == "release" ]]; then
  KEYSTORE="$ROOT_DIR/android/keystores/tarim-android-release.jks"
  PROPERTIES="$ROOT_DIR/android/keystores/release.properties"
  [[ -f "$KEYSTORE" ]] || die "找不到正式签名文件：$KEYSTORE"
  [[ -f "$PROPERTIES" ]] || die "找不到签名配置：$PROPERTIES"
  # Overlay the sensitive files as read-only mounts. They are available to the
  # build process but can never be copied into the toolchain image.
  RUN_ARGS+=(
    --volume "$KEYSTORE:/workspace/android/keystores/tarim-android-release.jks:ro"
    --volume "$PROPERTIES:/workspace/android/keystores/release.properties:ro"
  )
fi

if [[ "$MODE" == "shell" ]]; then
  RUN_ARGS+=(--interactive --tty)
fi

echo "==> Running Android $MODE inside pinned container"
docker run "${RUN_ARGS[@]}" "$IMAGE_NAME" "$MODE"
