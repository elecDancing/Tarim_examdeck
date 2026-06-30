import type { AppData } from "../types";
import { saveBlob } from "./fileExport";
import { exportStoredQuestionImages } from "./imageStore";

const STORAGE_KEY = "examdeck:v3";
const STORAGE_BACKUP_KEY = "examdeck:v3:backup:last";
const STORAGE_META_KEY = "examdeck:v4:meta";
const INDEXED_DB_STATIC_KEY = "examdeck:v4:static";
const INDEXED_DB_PROGRESS_KEY = "examdeck:v4:progress";
const INDEXED_DB_NAME = "examdeck-storage";
const INDEXED_DB_STORE = "records";
const TECH_DECK_ID = "deck_tech";
const TECH_DECK_NAME = "天然气净化工技师";
const LEGACY_TECH_DECK_NAMES = new Set(["技师题", "技师题_图片格式", "技师题_ExamDeck导入格式"]);

type StaticData = Pick<AppData, "questions" | "decks" | "seedImported">;
type ProgressData = Omit<AppData, keyof StaticData>;

export type SaveDataResult = {
  ok: boolean;
  target?: "indexeddb";
  error?: string;
};

let lastStaticSignature = "";

export const emptyData: AppData = {
  questions: [],
  decks: [],
  stats: {},
  dailyStats: {},
  notes: {},
  favoriteQuestionIds: [],
  slashedQuestionIds: [],
  autoHardQuestionIds: [],
  studyPlanDeckIds: [],
  sessions: [],
  activeSession: null,
  practices: {},
  dailyReviewSessions: {},
  dailyReviewSession: null,
  dailyMistakeSummary: null,
  dailyReviewCompletion: null,
  seedImported: false
};

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyData;
    backupRawData(raw);
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalizeStoredData(parsed);
  } catch {
    return emptyData;
  }
}

export async function loadDataFromPersistentStorage(): Promise<AppData | null> {
  const indexedData = await readIndexedDbData();
  if (indexedData) return indexedData;
  const localData = loadData();
  return hasStoredContent(localData) ? localData : null;
}

function backupRawData(raw: string) {
  try {
    localStorage.setItem(STORAGE_BACKUP_KEY, JSON.stringify({
      createdAt: new Date().toISOString(),
      storageKey: STORAGE_KEY,
      raw
    }));
  } catch {
    // Storage can be full or unavailable; loading should continue either way.
  }
}

function shouldRenameTechDeck(deckId: string, deckName: string) {
  return deckId === TECH_DECK_ID || LEGACY_TECH_DECK_NAMES.has(deckName);
}

function uniqueStoredIds(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0))]
    : [];
}

export async function saveData(data: AppData): Promise<SaveDataResult> {
  const normalized = normalizeStoredData(data);
  try {
    await writeIndexedDbData(normalized);
    try {
      localStorage.setItem(STORAGE_META_KEY, JSON.stringify({
        version: 4,
        updatedAt: new Date().toISOString(),
        questions: normalized.questions.length,
        decks: normalized.decks.length
      }));
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // localStorage 只保存元信息；不可写不影响 IndexedDB 主存储。
    }
    return { ok: true, target: "indexeddb" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "学习数据保存失败"
    };
  }
}

export async function buildProgressBackup(data: AppData) {
  const exportedAt = new Date().toISOString();
  const backupData: AppData = {
    ...normalizeStoredData(data),
    notes: data.notes ?? {},
    sessions: dedupeExamSessions(data.sessions ?? [])
  };
  const imageRefs = backupData.questions.flatMap((question) => question.imageUrls ?? []);
  const images = await exportStoredQuestionImages(imageRefs);
  const payload = {
    app: "塔里木刷题王",
    kind: "examdeck-progress-backup",
    version: 6,
    exportedAt,
    data: backupData,
    images
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const filename = `塔里木刷题王-学习进度-${exportedAt.slice(0, 19).replace(/[:T]/g, "-")}.json`;
  return { blob, filename };
}

function normalizeStoredData(parsed: Partial<AppData>): AppData {
  const legacySession = parsed.dailyReviewSession ?? null;
  const dailyReviewSessions = normalizeDailyReviewSessions(parsed.dailyReviewSessions, legacySession);
  const decks = (parsed.decks ?? []).map((deck) => ({
    ...deck,
    name: shouldRenameTechDeck(deck.id, deck.name) ? TECH_DECK_NAME : deck.name
  }));
  const deckIds = new Set(decks.map((deck) => deck.id));
  return {
    questions: parsed.questions ?? [],
    decks,
    stats: parsed.stats ?? {},
    dailyStats: parsed.dailyStats ?? {},
    notes: parsed.notes ?? {},
    favoriteQuestionIds: parsed.favoriteQuestionIds ?? [],
    slashedQuestionIds: parsed.slashedQuestionIds ?? [],
    autoHardQuestionIds: uniqueStoredIds(parsed.autoHardQuestionIds),
    studyPlanDeckIds: uniqueStoredIds(parsed.studyPlanDeckIds).filter((deckId) => deckIds.has(deckId)),
    sessions: dedupeExamSessions(parsed.sessions ?? []),
    activeSession: normalizeStoredActiveSession(parsed.activeSession),
    practices: parsed.practices ?? {},
    dailyReviewSessions,
    dailyReviewSession: legacySession,
    dailyMistakeSummary: parsed.dailyMistakeSummary ?? null,
    dailyReviewCompletion: parsed.dailyReviewCompletion ?? null,
    seedImported: parsed.seedImported ?? false
  };
}

function normalizeDailyReviewSessions(
  sessions: Partial<AppData>["dailyReviewSessions"],
  legacySession: Partial<AppData>["dailyReviewSession"]
) {
  const normalized: AppData["dailyReviewSessions"] = {};
  if (sessions && typeof sessions === "object" && !Array.isArray(sessions)) {
    Object.entries(sessions).forEach(([deckId, session]) => {
      if (!session || session.deckId !== deckId || !Array.isArray(session.items) || session.items.length === 0) return;
      normalized[deckId] = session;
    });
  }
  if (legacySession && Array.isArray(legacySession.items) && legacySession.items.length > 0) {
    normalized[legacySession.deckId] = legacySession;
  }
  return normalized;
}

function dedupeExamSessions(sessions: AppData["sessions"]) {
  const byId = new Map<string, AppData["sessions"][number]>();
  for (const session of sessions) {
    if (!session?.id) continue;
    if (!byId.has(session.id)) {
      byId.set(session.id, session);
      continue;
    }
    const current = byId.get(session.id);
    const currentTime = current?.submittedAt ? new Date(current.submittedAt).getTime() : 0;
    const nextTime = session.submittedAt ? new Date(session.submittedAt).getTime() : 0;
    if (nextTime >= currentTime) byId.set(session.id, session);
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const bTime = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return bTime - aTime;
  }).slice(0, 100);
}

function normalizeStoredActiveSession(session: Partial<AppData>["activeSession"]) {
  if (!session || session.submittedAt || !Array.isArray(session.items) || session.items.length === 0) return null;
  const maxIndex = Math.max(0, session.items.length - 1);
  const currentIndex = Math.max(0, Math.min(maxIndex, Number(session.currentIndex ?? 0) || 0));
  return {
    ...session,
    currentIndex
  };
}

function hasStoredContent(data: AppData) {
  return data.questions.length > 0 || data.decks.length > 0 || Object.keys(data.stats).length > 0 || Boolean(data.activeSession);
}

function openIndexedDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB 不可用"));
      return;
    }
    const request = indexedDB.open(INDEXED_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(INDEXED_DB_STORE)) {
        database.createObjectStore(INDEXED_DB_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 打开失败"));
  });
}

async function readIndexedDbData(): Promise<AppData | null> {
  try {
    const database = await openIndexedDb();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(INDEXED_DB_STORE, "readonly");
      const store = transaction.objectStore(INDEXED_DB_STORE);
      const staticRequest = store.get(INDEXED_DB_STATIC_KEY);
      const progressRequest = store.get(INDEXED_DB_PROGRESS_KEY);
      const legacyRequest = store.get(STORAGE_KEY);
      transaction.oncomplete = () => {
        database.close();
        const staticData = staticRequest.result as StaticData | undefined;
        const progressData = progressRequest.result as ProgressData | undefined;
        if (staticData && progressData) {
          resolve(normalizeStoredData({ ...staticData, ...progressData }));
          return;
        }
        const legacyData = legacyRequest.result as Partial<AppData> | undefined;
        resolve(legacyData ? normalizeStoredData(legacyData) : null);
      };
      transaction.onabort = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB 读取中止"));
      };
      transaction.onerror = () => {
        database.close();
        reject(transaction.error ?? new Error("IndexedDB 读取失败"));
      };
    });
  } catch {
    return null;
  }
}

async function writeIndexedDbData(data: AppData): Promise<void> {
  const staticData: StaticData = {
    questions: data.questions,
    decks: data.decks,
    seedImported: data.seedImported
  };
  const progressData: ProgressData = {
    stats: data.stats,
    dailyStats: data.dailyStats,
    notes: data.notes,
    favoriteQuestionIds: data.favoriteQuestionIds,
    slashedQuestionIds: data.slashedQuestionIds,
    autoHardQuestionIds: data.autoHardQuestionIds,
    studyPlanDeckIds: data.studyPlanDeckIds,
    sessions: data.sessions,
    activeSession: data.activeSession,
    practices: data.practices,
    dailyReviewSessions: data.dailyReviewSessions,
    dailyReviewSession: data.dailyReviewSession,
    dailyMistakeSummary: data.dailyMistakeSummary,
    dailyReviewCompletion: data.dailyReviewCompletion
  };
  const staticSignature = buildStaticSignature(staticData);
  const shouldWriteStatic = staticSignature !== lastStaticSignature;
  const database = await openIndexedDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(INDEXED_DB_STORE, "readwrite");
    const store = transaction.objectStore(INDEXED_DB_STORE);
    if (shouldWriteStatic) store.put(staticData, INDEXED_DB_STATIC_KEY);
    store.put(progressData, INDEXED_DB_PROGRESS_KEY);
    store.delete(STORAGE_KEY);
    transaction.oncomplete = () => {
      database.close();
      if (shouldWriteStatic) lastStaticSignature = staticSignature;
      resolve();
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB 写入中止"));
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("IndexedDB 写入失败"));
    };
  });
}

function buildStaticSignature(data: StaticData) {
  const deckSignature = data.decks.map((deck) => `${deck.id}:${deck.updatedAt}:${deck.questionIds.length}`).join("|");
  return `${data.questions.length}|${deckSignature}|${data.seedImported ? 1 : 0}`;
}

export async function exportData(data: AppData) {
  const { blob, filename } = await buildProgressBackup(data);
  await saveBlob(blob, filename, "application/json");
}
