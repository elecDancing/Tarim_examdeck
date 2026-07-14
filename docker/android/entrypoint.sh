#!/usr/bin/env bash
set -euo pipefail

cd /workspace

die() {
  echo "Android Docker 构建失败：$*" >&2
  exit 1
}

[[ -f package.json ]] || die "请把 examdeck 项目挂载到 /workspace"

show_info() {
  echo "Node: $(node --version)"
  echo "npm: $(npm --version)"
  echo "Java: $(java -version 2>&1 | head -n 1)"
  echo "Android SDK: ${ANDROID_HOME}"
  sdkmanager --list_installed | sed -n '/Installed packages:/,/Available Packages:/p'
}

run_validation() {
  npm ci
  TZ=UTC npm test
  VITE_DISABLE_QUESTION_BANK_EXPORT=1 npm run build
  npm run check:quality
  npx cap sync android
  (
    cd android
    ./gradlew --no-daemon testDebugUnitTest assembleDebug assembleDebugAndroidTest
  )
}

case "${1:-info}" in
  info)
    show_info
    ;;
  validate)
    run_validation
    ;;
  release)
    npm ci
    npm run android:pack
    ;;
  shell)
    exec bash
    ;;
  *)
    exec "$@"
    ;;
esac
