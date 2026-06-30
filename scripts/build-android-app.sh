#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"
export ANDROID_SDK_ROOT="${ANDROID_SDK_ROOT:-$ANDROID_HOME}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"

RELEASE_DIR="$ROOT_DIR/release"
KEYSTORE_DIR="$ROOT_DIR/android/keystores"
KEYSTORE_PATH="$KEYSTORE_DIR/tarim-android-release.jks"
KEY_ALIAS="tarim-release"
KEYSTORE_PASSWORD="${TARIM_ANDROID_KEYSTORE_PASSWORD:-tarim-android-release-2026}"
APK_NAME="塔里木刷题王-android.apk"

mkdir -p "$RELEASE_DIR"

echo "==> Building web assets for Android user release"
VITE_DISABLE_QUESTION_BANK_EXPORT=1 npm run build

if [ ! -d "$ROOT_DIR/android" ]; then
  echo "==> Creating Capacitor Android project"
  npx cap add android
fi

echo "==> Syncing Capacitor Android project"
npx cap sync android

mkdir -p "$KEYSTORE_DIR"
if [ ! -f "$KEYSTORE_PATH" ]; then
  echo "==> Creating local Android release keystore"
  keytool -genkeypair \
    -v \
    -keystore "$KEYSTORE_PATH" \
    -storepass "$KEYSTORE_PASSWORD" \
    -keypass "$KEYSTORE_PASSWORD" \
    -alias "$KEY_ALIAS" \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -dname "CN=Tarim Examdeck, OU=Tarim, O=Tarim, L=Tarim, ST=Xinjiang, C=CN"
fi

echo "==> Assembling signed Android release APK"
(
  cd android
  ./gradlew assembleRelease \
    -Pandroid.injected.signing.store.file="$KEYSTORE_PATH" \
    -Pandroid.injected.signing.store.password="$KEYSTORE_PASSWORD" \
    -Pandroid.injected.signing.key.alias="$KEY_ALIAS" \
    -Pandroid.injected.signing.key.password="$KEYSTORE_PASSWORD"
)

cp "$ROOT_DIR/android/app/build/outputs/apk/release/app-release.apk" "$RELEASE_DIR/$APK_NAME"

echo "==> Generated $RELEASE_DIR/$APK_NAME"
