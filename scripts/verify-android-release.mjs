import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getAndroidReleaseInfo, validateBundledData } from "./lib/android-release.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const info = getAndroidReleaseInfo(packageJson);
const apkPath = path.resolve(process.argv[2] ?? path.join(root, "release", info.apkName));
const bootstrapPath = path.join(root, "public", "bootstrap", "progress.json");

function fail(message) {
  console.error(`Android 发布校验失败：${message}`);
  process.exit(1);
}

function ensureJavaHome() {
  if (process.env.JAVA_HOME && fs.existsSync(path.join(process.env.JAVA_HOME, "bin", "java"))) return;
  if (process.platform === "darwin") {
    const macJavaHome = spawnSync("/usr/libexec/java_home", ["-v", "21"], { encoding: "utf8" });
    if (macJavaHome.status === 0 && macJavaHome.stdout.trim()) {
      process.env.JAVA_HOME = macJavaHome.stdout.trim();
      return;
    }
  }
  const candidates = [
    "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
    "/usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
  ];
  const javaHome = candidates.find((candidate) => fs.existsSync(path.join(candidate, "bin", "java")));
  if (javaHome) process.env.JAVA_HOME = javaHome;
}

function findSdkTool(name) {
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    process.env.HOME ? path.join(process.env.HOME, "Library", "Android", "sdk") : "",
    "/opt/homebrew/share/android-commandlinetools",
    "/usr/local/lib/android/sdk"
  ].filter(Boolean);
  for (const sdkRoot of [...new Set(sdkRoots)]) {
    const buildTools = path.join(sdkRoot, "build-tools");
    if (fs.existsSync(buildTools)) {
      const versions = fs.readdirSync(buildTools).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const version of versions) {
        const candidate = path.join(buildTools, version, name);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  const lookup = spawnSync("sh", ["-lc", `command -v ${name}`], { encoding: "utf8" });
  return lookup.status === 0 ? lookup.stdout.trim() : "";
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (result.status !== 0) fail(`${path.basename(command)} 执行失败：${result.stderr || result.stdout}`);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`;
}

if (!fs.existsSync(apkPath)) fail(`找不到 APK：${apkPath}`);
if (!fs.existsSync(bootstrapPath)) fail("找不到内置题库数据");

const bundled = validateBundledData(JSON.parse(fs.readFileSync(bootstrapPath, "utf8")));
if (bundled.failures.length > 0) fail(bundled.failures.join("；"));

const aapt = findSdkTool("aapt");
const apksigner = findSdkTool("apksigner");
if (!aapt) fail("找不到 Android SDK 的 aapt");
if (!apksigner) fail("找不到 Android SDK 的 apksigner");
ensureJavaHome();

const badging = run(aapt, ["dump", "badging", apkPath]);
const packageMatch = /package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'/.exec(badging);
if (!packageMatch) fail("无法读取 APK 包信息");
const [, applicationId, versionCode, versionName] = packageMatch;
if (applicationId !== info.applicationId) fail(`包名不一致：${applicationId} != ${info.applicationId}`);
if (Number(versionCode) !== info.versionCode) fail(`versionCode 不一致：${versionCode} != ${info.versionCode}`);
if (versionName !== info.versionName) fail(`versionName 不一致：${versionName} != ${info.versionName}`);

const signing = run(apksigner, ["verify", "--verbose", "--print-certs", apkPath]);
if (!/Verified using v2 scheme \(APK Signature Scheme v2\): true/.test(signing)) {
  fail("APK 未通过 v2 签名校验");
}

const archive = run("unzip", ["-l", apkPath]);
if (!archive.includes("assets/public/bootstrap/progress.json")) fail("APK 中缺少内置题库");

console.log("Android 发布校验通过");
console.log(JSON.stringify({
  apk: apkPath,
  ...info,
  decks: bundled.deckCount,
  questions: bundled.questionCount
}, null, 2));
