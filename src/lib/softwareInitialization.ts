import type { AppData } from "../types";
import {
  areSeedDecksImported,
  getDeckQuestions,
  isHardQuestionDeck,
  normalizeAppDataForCurrentRules,
  orderSeedDecks,
  parseProgressBackup,
  upsertDeck
} from "./appRules";

export type InitializationSeedDeck = {
  id: string;
  name: string;
  file: string;
  source?: string;
};

export async function loadBootstrapSeedData(baseUrl: string) {
  const response = await fetch(`${baseUrl}bootstrap/progress.json`, { cache: "no-store" });
  if (!response.ok && response.status !== 0) throw new Error("内置固定题库文件未找到");
  return orderSeedDecks(normalizeAppDataForCurrentRules(parseProgressBackup(await response.text())));
}

export function clearPersonalDataForInitialization(data: AppData) {
  return normalizeAppDataForCurrentRules({
    ...data,
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
    decks: data.decks.filter((deck) => !isHardQuestionDeck(deck))
  });
}

export function restoreSeedDecksFromBootstrap(
  data: AppData,
  bootstrapData: AppData,
  seedDecks: readonly InitializationSeedDeck[]
) {
  const bootstrapDeckById = new Map(bootstrapData.decks.map((deck) => [deck.id, deck]));
  let nextData = data;
  let restoredCount = 0;

  for (const seed of seedDecks) {
    const seedDeck = bootstrapDeckById.get(seed.id);
    if (!seedDeck) continue;
    const seedQuestions = getDeckQuestions(bootstrapData.questions, seedDeck);
    if (seedQuestions.length === 0) continue;
    nextData = upsertDeck(nextData, seed.id, seed.name, seedQuestions, true);
    restoredCount += 1;
  }

  const orderedData = orderSeedDecks(nextData);
  return {
    data: normalizeAppDataForCurrentRules({
      ...orderedData,
      seedImported: areSeedDecksImported(orderedData)
    }),
    restoredCount
  };
}
