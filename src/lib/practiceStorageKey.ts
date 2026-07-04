import type { Deck, PracticeState } from "../types";

export const HARD_QUESTION_DECK_ID = "deck_hard_low_accuracy";
export const HARD_QUESTION_PRACTICE_KEY = `${HARD_QUESTION_DECK_ID}:practice`;

function isHardQuestionDeckStorage(deck: Deck) {
  return deck.id === HARD_QUESTION_DECK_ID;
}

export function getDeckPracticeStorageKey(deck: Deck | null | undefined) {
  if (!deck) return null;
  return isHardQuestionDeckStorage(deck) ? HARD_QUESTION_PRACTICE_KEY : deck.id;
}

export function getStoredDeckPracticeKey(practices: Record<string, PracticeState>, deck: Deck | null | undefined) {
  const storageKey = getDeckPracticeStorageKey(deck);
  if (!storageKey || !deck) return null;
  if (practices[storageKey]) return storageKey;
  if (isHardQuestionDeckStorage(deck) && practices[deck.id]) return deck.id;
  return storageKey;
}

export function getStoredDeckPractice(practices: Record<string, PracticeState>, deck: Deck | null | undefined) {
  const storageKey = getStoredDeckPracticeKey(practices, deck);
  return storageKey ? practices[storageKey] : undefined;
}

export function withMigratedHardPractice(practices: Record<string, PracticeState>, sourceKey: string | null, practice: PracticeState | undefined) {
  if (!sourceKey || sourceKey === HARD_QUESTION_PRACTICE_KEY || !practice) return practices;
  const nextPractices: Record<string, PracticeState> = { ...practices, [HARD_QUESTION_PRACTICE_KEY]: practice };
  delete nextPractices[sourceKey];
  return nextPractices;
}

export function migrateHardPracticeStorage(practices: Record<string, PracticeState>) {
  const legacyPractice = practices[HARD_QUESTION_DECK_ID];
  if (!legacyPractice) return practices;

  const nextPractices: Record<string, PracticeState> = { ...practices };
  delete nextPractices[HARD_QUESTION_DECK_ID];

  if (!nextPractices[HARD_QUESTION_PRACTICE_KEY]) {
    nextPractices[HARD_QUESTION_PRACTICE_KEY] = {
      ...legacyPractice,
      deckId: HARD_QUESTION_DECK_ID,
      mode: "answer",
      shuffleOptions: false,
      shuffleQuestions: false
    };
  }

  return nextPractices;
}
