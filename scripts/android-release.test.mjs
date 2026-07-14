import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  REQUIRED_BUNDLED_DECKS,
  getAndroidReleaseInfo,
  parseAndroidVersion,
  validateBundledData
} from "./lib/android-release.mjs";

describe("Android release metadata", () => {
  it("derives a monotonically structured version code and English APK name", () => {
    expect(parseAndroidVersion("1.0.51")).toEqual({ versionName: "1.0.51", versionCode: 1_000_051 });
    expect(getAndroidReleaseInfo({ version: "1.2.3" })).toEqual({
      applicationId: "com.tarim.examdeck",
      versionName: "1.2.3",
      versionCode: 1_002_003,
      apkName: "tarim-examdeck-android-v1.2.3.apk"
    });
  });

  it("rejects versions that cannot safely map to Android versionCode", () => {
    expect(() => parseAndroidVersion("1.0")).toThrow(/x\.y\.z/);
    expect(() => parseAndroidVersion("1.0.1000")).toThrow(/小于 1000/);
  });

  it("excludes obsolete Kotlin split stdlibs for every Android subproject", () => {
    const rootGradle = readFileSync(new URL("../android/build.gradle", import.meta.url), "utf8");
    expect(rootGradle).toMatch(/allprojects\s*\{[\s\S]*configurations\.configureEach/);
    expect(rootGradle).toContain("module: 'kotlin-stdlib-jdk7'");
    expect(rootGradle).toContain("module: 'kotlin-stdlib-jdk8'");
  });
});

describe("Android bundled question banks", () => {
  it("accepts exactly the nine supported bundled decks", () => {
    const decks = REQUIRED_BUNDLED_DECKS.map((name, index) => ({ name, questionIds: [`q${index}`] }));
    const questions = REQUIRED_BUNDLED_DECKS.map((_, index) => ({ id: `q${index}` }));
    expect(validateBundledData({ data: { decks, questions } }).failures).toEqual([]);
  });

  it("rejects extra, missing, orphaned and dangling bundled data", () => {
    const result = validateBundledData({
      data: {
        decks: [{ name: "额外题库", questionIds: ["missing"] }],
        questions: [{ id: "orphan" }]
      }
    });
    expect(result.failures).toEqual(expect.arrayContaining([
      expect.stringMatching(/必须正好为 9 个/),
      expect.stringMatching(/包含非发布题库/),
      expect.stringMatching(/未被题库引用/),
      expect.stringMatching(/不存在的题目/)
    ]));
  });
});
