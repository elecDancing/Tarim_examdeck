#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

die() {
  echo "Android 构建失败：$*" >&2
  exit 1
}

resolve_java_home() {
  if [[ -n "${JAVA_HOME:-}" && -x "${JAVA_HOME}/bin/java" ]]; then
    return
  fi
  if [[ "$(uname -s)" == "Darwin" ]] && /usr/libexec/java_home -v 21 >/dev/null 2>&1; then
    JAVA_HOME="$(/usr/libexec/java_home -v 21)"
    export JAVA_HOME
    return
  fi
  if command -v brew >/dev/null 2>&1; then
    local brew_java
    brew_java="$(brew --prefix openjdk@21 2>/dev/null || true)"
    if [[ -n "$brew_java" && -x "$brew_java/bin/java" ]]; then
      JAVA_HOME="$brew_java/libexec/openjdk.jdk/Contents/Home"
      export JAVA_HOME
      return
    fi
  fi
  die "需要 JDK 21；请设置 JAVA_HOME"
}

resolve_android_home() {
  local candidates=(
    "${ANDROID_HOME:-}"
    "${ANDROID_SDK_ROOT:-}"
    "$HOME/Library/Android/sdk"
    "/opt/homebrew/share/android-commandlinetools"
    "/usr/local/lib/android/sdk"
  )
  local candidate
  for candidate in "${candidates[@]}"; do
    if [[ -n "$candidate" && -d "$candidate" ]]; then
      ANDROID_HOME="$candidate"
      ANDROID_SDK_ROOT="$candidate"
      export ANDROID_HOME ANDROID_SDK_ROOT
      return
    fi
  done
  die "找不到 Android SDK；请设置 ANDROID_HOME"
}

resolve_java_home
resolve_android_home
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

command -v node >/dev/null 2>&1 || die "找不到 Node.js"
command -v npm >/dev/null 2>&1 || die "找不到 npm"
command -v unzip >/dev/null 2>&1 || die "找不到 unzip"

RELEASE_DIR="$ROOT_DIR/release"
KEYSTORE_PATH="${TARIM_ANDROID_KEYSTORE_PATH:-$ROOT_DIR/android/keystores/tarim-android-release.jks}"
SIGNING_PROPERTIES_PATH="${TARIM_ANDROID_SIGNING_PROPERTIES:-$ROOT_DIR/android/keystores/release.properties}"

if [[ -f "$SIGNING_PROPERTIES_PATH" ]]; then
  # shellcheck disable=SC1090
  source "$SIGNING_PROPERTIES_PATH"
fi

KEY_ALIAS="${TARIM_ANDROID_KEY_ALIAS:-}"
KEYSTORE_PASSWORD="${TARIM_ANDROID_KEYSTORE_PASSWORD:-}"
KEY_PASSWORD="${TARIM_ANDROID_KEY_PASSWORD:-$KEYSTORE_PASSWORD}"
[[ -f "$KEYSTORE_PATH" ]] || die "找不到正式签名文件：$KEYSTORE_PATH（为防止升级签名失效，不会自动生成新证书）"
[[ -n "$KEY_ALIAS" ]] || die "未设置 TARIM_ANDROID_KEY_ALIAS"
[[ -n "$KEYSTORE_PASSWORD" ]] || die "未设置 TARIM_ANDROID_KEYSTORE_PASSWORD"
[[ -n "$KEY_PASSWORD" ]] || die "未设置 TARIM_ANDROID_KEY_PASSWORD"

APP_VERSION="$(node scripts/android-release-info.mjs versionName)"
APK_NAME="$(node scripts/android-release-info.mjs apkName)"
APK_OUTPUT="$RELEASE_DIR/$APK_NAME"
GRADLE_APK="$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk"

mkdir -p "$RELEASE_DIR"

echo "==> 1/7 Running regression tests"
npm test

echo "==> 2/7 Building Android-only web assets"
VITE_DISABLE_QUESTION_BANK_EXPORT=1 npm run build

echo "==> 3/7 Running release quality gates"
npm run check:quality

echo "==> 4/7 Syncing Capacitor Android project"
npx cap sync android

echo "==> 5/7 Assembling signed Android release v$APP_VERSION"
(
  cd android
  ./gradlew --no-daemon clean assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$KEY_PASSWORD"
)

[[ -f "$GRADLE_APK" ]] || die "Gradle 没有生成 release APK"

echo "==> 6/7 Copying versioned APK"
TEMP_APK="$APK_OUTPUT.tmp"
rm -f "$TEMP_APK"
cp "$GRADLE_APK" "$TEMP_APK"
mv "$TEMP_APK" "$APK_OUTPUT"

echo "==> 7/7 Verifying package metadata, bundled decks and signature"
node scripts/verify-android-release.mjs "$APK_OUTPUT"

if command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$APK_OUTPUT"
elif command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$APK_OUTPUT"
fi

echo "==> Generated $APK_OUTPUT"
