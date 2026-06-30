#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="塔里木刷题王"
RELEASE_DIR="${ROOT_DIR}/release"
APP_DIR="${RELEASE_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
ZIP_PATH="${RELEASE_DIR}/${APP_NAME}-mac.zip"
DMG_STAGING_DIR="${RELEASE_DIR}/dmg-staging"
DMG_PATH="${RELEASE_DIR}/${APP_NAME}.dmg"

if [[ ! -d "${ROOT_DIR}/dist" ]]; then
  echo "dist 不存在，请先运行 npm run build" >&2
  exit 1
fi

rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}"

swiftc \
  "${ROOT_DIR}/macos/TarimExamdeckApp.swift" \
  -o "${MACOS_DIR}/${APP_NAME}" \
  -framework Cocoa \
  -framework WebKit

cp "${ROOT_DIR}/macos/Info.plist" "${CONTENTS_DIR}/Info.plist"
if [[ -f "${ROOT_DIR}/macos/AppIcon.icns" ]]; then
  cp "${ROOT_DIR}/macos/AppIcon.icns" "${RESOURCES_DIR}/AppIcon.icns"
fi
rsync -a --delete "${ROOT_DIR}/dist/" "${RESOURCES_DIR}/dist/"
chmod -R u+rwX,go+rX "${RESOURCES_DIR}/dist"

chmod +x "${MACOS_DIR}/${APP_NAME}"

if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep --sign - "${APP_DIR}" >/dev/null
fi

rm -f "${ZIP_PATH}"
ditto -c -k --sequesterRsrc --keepParent "${APP_DIR}" "${ZIP_PATH}"

rm -rf "${DMG_STAGING_DIR}"
mkdir -p "${DMG_STAGING_DIR}"
cp -R "${APP_DIR}" "${DMG_STAGING_DIR}/"
ln -s /Applications "${DMG_STAGING_DIR}/Applications"
rm -f "${DMG_PATH}"
hdiutil create \
  -volname "${APP_NAME}" \
  -srcfolder "${DMG_STAGING_DIR}" \
  -ov \
  -format UDZO \
  "${DMG_PATH}" >/dev/null
rm -rf "${DMG_STAGING_DIR}"

echo "已生成：${APP_DIR}"
echo "已生成：${ZIP_PATH}"
echo "已生成：${DMG_PATH}"
