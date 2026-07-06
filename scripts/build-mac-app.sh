#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="塔里木刷题王"
RELEASE_DIR="${ROOT_DIR}/release"
APP_VERSION="$(node -p "require('${ROOT_DIR}/package.json').version")"
APP_ARCH="$(uname -m)"
BUILD_ROOT="${RELEASE_DIR}/macos-build"

build_web() {
  local variant="$1"

  if [[ "${variant}" == "user" ]]; then
    echo "==> Building macOS user web assets"
    VITE_DISABLE_QUESTION_BANK_EXPORT=1 npm run build
  else
    echo "==> Building macOS developer web assets"
    npm run build
  fi
}

package_app() {
  local variant="$1"
  local artifact_name="$2"
  local bundle_name="${APP_NAME}"

  if [[ "${variant}" == "developer" ]]; then
    bundle_name="Tarim ExamDeck Developer"
  fi

  local app_dir="${BUILD_ROOT}/${variant}/${bundle_name}.app"
  local release_app_dir="${RELEASE_DIR}/${bundle_name}.app"
  local contents_dir="${app_dir}/Contents"
  local macos_dir="${contents_dir}/MacOS"
  local resources_dir="${contents_dir}/Resources"
  local zip_path="${RELEASE_DIR}/${artifact_name}.zip"
  local dmg_staging_dir="${BUILD_ROOT}/${variant}/dmg-staging"
  local dmg_path="${RELEASE_DIR}/${artifact_name}.dmg"

  rm -rf "${BUILD_ROOT:?}/${variant}"
  mkdir -p "${macos_dir}" "${resources_dir}"

  swiftc \
    "${ROOT_DIR}/macos/TarimExamdeckApp.swift" \
    -o "${macos_dir}/${APP_NAME}" \
    -framework Cocoa \
    -framework WebKit

  cp "${ROOT_DIR}/macos/Info.plist" "${contents_dir}/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString ${APP_VERSION}" "${contents_dir}/Info.plist"
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion ${APP_VERSION}" "${contents_dir}/Info.plist"
  if [[ "${variant}" == "developer" ]]; then
    /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName Tarim ExamDeck Developer" "${contents_dir}/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleName Tarim ExamDeck Developer" "${contents_dir}/Info.plist"
    /usr/libexec/PlistBuddy -c "Set :CFBundleIdentifier com.tarim.examdeck.developer" "${contents_dir}/Info.plist"
  fi
  if [[ -f "${ROOT_DIR}/macos/AppIcon.icns" ]]; then
    cp "${ROOT_DIR}/macos/AppIcon.icns" "${resources_dir}/AppIcon.icns"
  fi
  rsync -a --delete "${ROOT_DIR}/dist/" "${resources_dir}/dist/"
  chmod -R u+rwX,go+rX "${resources_dir}/dist"
  chmod +x "${macos_dir}/${APP_NAME}"

  if command -v codesign >/dev/null 2>&1; then
    codesign --force --deep --sign - "${app_dir}" >/dev/null
  fi

  rm -rf "${release_app_dir}"
  cp -R "${app_dir}" "${release_app_dir}"

  rm -f "${zip_path}"
  ditto -c -k --sequesterRsrc --keepParent "${app_dir}" "${zip_path}"

  rm -rf "${dmg_staging_dir}"
  mkdir -p "${dmg_staging_dir}"
  cp -R "${app_dir}" "${dmg_staging_dir}/"
  ln -s /Applications "${dmg_staging_dir}/Applications"
  rm -f "${dmg_path}"
  hdiutil create \
    -volname "${bundle_name}" \
    -srcfolder "${dmg_staging_dir}" \
    -ov \
    -format UDZO \
    "${dmg_path}" >/dev/null
  rm -rf "${dmg_staging_dir}"

  echo "已生成：${release_app_dir}"
  echo "已生成：${zip_path}"
  echo "已生成：${dmg_path}"
}

mkdir -p "${RELEASE_DIR}"

build_web "user"
package_app "user" "tarim-examdeck-macos-${APP_ARCH}-v${APP_VERSION}"

build_web "developer"
package_app "developer" "tarim-examdeck-macos-developer-v${APP_VERSION}"
