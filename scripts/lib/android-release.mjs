export const ANDROID_APPLICATION_ID = "com.tarim.examdeck";

export const REQUIRED_BUNDLED_DECKS = [
  "轻烃操作工初级",
  "轻烃操作工中级",
  "天然气净化工初级工",
  "天然气净化工中级工",
  "采油工初级",
  "采油工中级",
  "集输工初级",
  "集输工中级",
  "油气田开发危害因素辨识与风险防控"
];

export function parseAndroidVersion(version) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(version));
  if (!match) throw new Error(`Android 正式版本必须是 x.y.z：${version}`);

  const [major, minor, patch] = match.slice(1).map(Number);
  if ([major, minor, patch].some((part) => part > 999)) {
    throw new Error(`Android 版本号每一段都必须小于 1000：${version}`);
  }

  return {
    versionName: `${major}.${minor}.${patch}`,
    versionCode: major * 1_000_000 + minor * 1_000 + patch
  };
}

export function getAndroidReleaseInfo(packageJson) {
  const version = parseAndroidVersion(packageJson?.version);
  return {
    applicationId: ANDROID_APPLICATION_ID,
    ...version,
    apkName: `tarim-examdeck-android-v${version.versionName}.apk`
  };
}

export function validateBundledData(payload) {
  const data = payload?.data ?? payload ?? {};
  const questions = Array.isArray(data.questions) ? data.questions : [];
  const decks = Array.isArray(data.decks) ? data.decks : [];
  const failures = [];
  const deckNames = decks.map((deck) => deck?.name).filter(Boolean);
  const questionIds = new Set(questions.map((question) => question?.id).filter(Boolean));
  const referencedIds = new Set(decks.flatMap((deck) => Array.isArray(deck?.questionIds) ? deck.questionIds : []));

  if (decks.length !== REQUIRED_BUNDLED_DECKS.length) {
    failures.push(`内置题库必须正好为 ${REQUIRED_BUNDLED_DECKS.length} 个，当前为 ${decks.length} 个`);
  }
  for (const name of REQUIRED_BUNDLED_DECKS) {
    if (!deckNames.includes(name)) failures.push(`缺少内置题库：${name}`);
  }
  for (const name of deckNames) {
    if (!REQUIRED_BUNDLED_DECKS.includes(name)) failures.push(`包含非发布题库：${name}`);
  }
  if (new Set(deckNames).size !== deckNames.length) failures.push("内置题库名称重复");
  if (questions.length === 0) failures.push("内置题目为空");
  const orphanCount = questions.filter((question) => !referencedIds.has(question.id)).length;
  if (orphanCount > 0) failures.push(`存在 ${orphanCount} 道未被题库引用的题目`);
  const missingReferenceCount = [...referencedIds].filter((id) => !questionIds.has(id)).length;
  if (missingReferenceCount > 0) failures.push(`题库引用了 ${missingReferenceCount} 道不存在的题目`);

  return {
    failures,
    deckCount: decks.length,
    questionCount: questions.length
  };
}
