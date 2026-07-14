import fs from "node:fs";
import path from "node:path";
import { getAndroidReleaseInfo } from "./lib/android-release.mjs";

const root = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const info = getAndroidReleaseInfo(packageJson);
const field = process.argv[2];

if (field) {
  if (!(field in info)) throw new Error(`未知 Android 发布字段：${field}`);
  process.stdout.write(String(info[field]));
} else {
  process.stdout.write(`${JSON.stringify(info, null, 2)}\n`);
}
